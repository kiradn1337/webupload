import { randomUUID } from 'crypto';
import { query, getClient } from './db';
import { fileProcessingQueue } from '../queue/fileProcessing';
import { generateUploadUrl, generateDownloadUrl } from './storage';
import { logger } from '../utils/logger';
import { auditLog } from './audit';
import { isFileSafeForPreview } from './fileProcessor';

/**
 * File type
 */
export interface File {
  id: string;
  owner_id: string;
  original_name: string;
  storage_key: string;
  size_bytes: number;
  sha256: string | null;
  detected_mime: string | null;
  status: 'pending' | 'scanning' | 'clean' | 'quarantined' | 'rejected';
  reason: string | null;
  created_at: Date;
  updated_at: Date;
  scanned_at: Date | null;
}

/**
 * Initiate file upload
 */
export async function initiateFileUpload(
  userId: string,
  fileName: string,
  fileSize: number,
  contentType: string
): Promise<{ fileId: string; uploadUrl: string }> {
  // Validate file size
  const maxFileSize = parseInt(process.env.FILE_UPLOAD_MAX_SIZE || '104857600', 10);
  if (fileSize > maxFileSize) {
    throw new Error(`File size exceeds the maximum allowed size (${maxFileSize / 1024 / 1024} MB)`);
  }

  // Check user quota
  const userResult = await query(
    'SELECT storage_quota_bytes, files_quota FROM users WHERE id = $1',
    [userId]
  );
  
  if (userResult.rowCount === 0) {
    throw new Error('User not found');
  }
  
  const user = userResult.rows[0];
  
  // Check storage quota
  const usedStorageResult = await query(
    'SELECT COALESCE(SUM(size_bytes), 0) as used_storage FROM files WHERE owner_id = $1 AND status != $2',
    [userId, 'rejected']
  );
  
  const usedStorage = parseInt(usedStorageResult.rows[0].used_storage, 10);
  if (usedStorage + fileSize > user.storage_quota_bytes) {
    throw new Error('Storage quota exceeded');
  }
  
  // Check files quota
  const filesCountResult = await query(
    'SELECT COUNT(*) as file_count FROM files WHERE owner_id = $1 AND status != $2',
    [userId, 'rejected']
  );
  
  const fileCount = parseInt(filesCountResult.rows[0].file_count, 10);
  if (fileCount >= user.files_quota) {
    throw new Error('Files quota exceeded');
  }

  // Generate presigned URL for S3 upload
  const { url, key } = await generateUploadUrl(contentType, fileSize, fileName);

  // Create file record in database
  const fileId = randomUUID();
  await query(
    'INSERT INTO files (id, owner_id, original_name, storage_key, size_bytes) VALUES ($1, $2, $3, $4, $5)',
    [fileId, userId, fileName, key, fileSize]
  );

  // Log file upload initiation
  await auditLog(
    userId,
    'FILE_UPLOAD_INITIATED',
    'file',
    fileId,
    { fileName, fileSize, contentType }
  );

  return { fileId, uploadUrl: url };
}

/**
 * Complete file upload
 */
export async function completeFileUpload(fileId: string, userId: string): Promise<File> {
  const client = await getClient();
  
  try {
    // Begin transaction
    await client.query('BEGIN');

    // Get file record
    const fileResult = await client.query(
      'SELECT * FROM files WHERE id = $1 AND owner_id = $2',
      [fileId, userId]
    );

    if (fileResult.rowCount === 0) {
      throw new Error('File not found or not owned by user');
    }

    const file = fileResult.rows[0];

    // Update file status
    await client.query(
      'UPDATE files SET status = $1, updated_at = NOW() WHERE id = $2',
      ['scanning', fileId]
    );

    // Queue file for processing
    await fileProcessingQueue.add(
      `file-${fileId}`,
      { fileId },
      { attempts: 3 }
    );

    // Commit transaction
    await client.query('COMMIT');

    // Log file upload completion
    await auditLog(
      userId,
      'FILE_UPLOAD_COMPLETED',
      'file',
      fileId,
      { fileName: file.original_name }
    );

    return file;
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    logger.error('Error completing file upload:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get files by owner
 */
export async function getFilesByOwner(
  ownerId: string,
  status?: string,
  page: number = 1,
  pageSize: number = 20
): Promise<{ files: File[]; total: number; page: number; pageSize: number }> {
  const offset = (page - 1) * pageSize;
  
  // Build query based on status filter
  let queryText = 'SELECT * FROM files WHERE owner_id = $1';
  const queryParams: any[] = [ownerId];
  
  if (status) {
    queryText += ' AND status = $2';
    queryParams.push(status);
  }
  
  queryText += ' ORDER BY created_at DESC LIMIT $' + (queryParams.length + 1) + ' OFFSET $' + (queryParams.length + 2);
  queryParams.push(pageSize, offset);
  
  // Get files
  const result = await query(queryText, queryParams);
  
  // Get total count for pagination
  let countQueryText = 'SELECT COUNT(*) FROM files WHERE owner_id = $1';
  const countParams = [ownerId];
  
  if (status) {
    countQueryText += ' AND status = $2';
    countParams.push(status);
  }
  
  const countResult = await query(countQueryText, countParams);
  const total = parseInt(countResult.rows[0].count, 10);
  
  return {
    files: result.rows,
    total,
    page,
    pageSize,
  };
}

/**
 * Get file by ID
 */
export async function getFileById(fileId: string): Promise<File | null> {
  const result = await query('SELECT * FROM files WHERE id = $1', [fileId]);
  
  if (result.rowCount === 0) {
    return null;
  }
  
  return result.rows[0] as File;
}

/**
 * Check if user can access file
 */
export async function canAccessFile(
  fileId: string,
  userId: string,
  requireOwnership: boolean = true
): Promise<boolean> {
  // For admin users, skip ownership check if not required
  if (!requireOwnership) {
    const userResult = await query(
      'SELECT role FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rowCount > 0 && userResult.rows[0].role === 'admin') {
      return true;
    }
  }
  
  // Check file ownership
  const result = await query(
    'SELECT id FROM files WHERE id = $1 AND owner_id = $2',
    [fileId, userId]
  );
  
  return result.rowCount > 0;
}

/**
 * Generate download URL for file
 */
export async function generateFileDownloadUrl(
  fileId: string,
  userId: string
): Promise<{ url: string; filename: string }> {
  // Get file record
  const fileResult = await query(
    'SELECT * FROM files WHERE id = $1 AND (owner_id = $2 OR EXISTS (SELECT 1 FROM file_shares WHERE file_id = $1 AND expires_at > NOW()))',
    [fileId, userId]
  );
  
  if (fileResult.rowCount === 0) {
    throw new Error('File not found or access denied');
  }
  
  const file = fileResult.rows[0];
  
  // Check file status
  if (file.status !== 'clean') {
    throw new Error(`Cannot download file with status: ${file.status}`);
  }
  
  // Generate download URL
  const forceAttachment = !isFileSafeForPreview(file.detected_mime);
  const url = await generateDownloadUrl(file.storage_key, file.original_name, forceAttachment);
  
  // Log download request
  await auditLog(
    userId,
    'FILE_DOWNLOAD_REQUESTED',
    'file',
    fileId,
    { fileName: file.original_name }
  );
  
  return {
    url,
    filename: file.original_name,
  };
}

/**
 * Create file share
 */
export async function createFileShare(
  fileId: string,
  userId: string,
  expiresInMinutes: number = 15,
  oneTimeUse: boolean = false
): Promise<string> {
  // Check if user can access file
  const canAccess = await canAccessFile(fileId, userId);
  if (!canAccess) {
    throw new Error('File not found or access denied');
  }
  
  // Get file record
  const fileResult = await query(
    'SELECT * FROM files WHERE id = $1',
    [fileId]
  );
  
  const file = fileResult.rows[0];
  
  // Check file status
  if (file.status !== 'clean') {
    throw new Error(`Cannot share file with status: ${file.status}`);
  }
  
  // Generate share token
  const shareToken = randomUUID();
  
  // Calculate expiry date
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + expiresInMinutes);
  
  // Create share record
  await query(
    'INSERT INTO file_shares (id, file_id, created_by, share_token, expires_at, one_time_use) VALUES ($1, $2, $3, $4, $5, $6)',
    [randomUUID(), fileId, userId, shareToken, expiresAt, oneTimeUse]
  );
  
  // Log share creation
  await auditLog(
    userId,
    'FILE_SHARE_CREATED',
    'file',
    fileId,
    { expiresAt, oneTimeUse }
  );
  
  return shareToken;
}

/**
 * Get file by share token
 */
export async function getFileByShareToken(
  shareToken: string
): Promise<{ file: File; share: any } | null> {
  // Get share record
  const shareResult = await query(
    'SELECT * FROM file_shares WHERE share_token = $1 AND expires_at > NOW() AND (one_time_use = FALSE OR used_at IS NULL)',
    [shareToken]
  );
  
  if (shareResult.rowCount === 0) {
    return null;
  }
  
  const share = shareResult.rows[0];
  
  // Get file record
  const fileResult = await query(
    'SELECT * FROM files WHERE id = $1 AND status = $2',
    [share.file_id, 'clean']
  );
  
  if (fileResult.rowCount === 0) {
    return null;
  }
  
  // If one-time use, mark as used
  if (share.one_time_use) {
    await query(
      'UPDATE file_shares SET used_at = NOW() WHERE id = $1',
      [share.id]
    );
  }
  
  // Log share access
  await auditLog(
    null,
    'FILE_SHARE_ACCESSED',
    'file_share',
    share.id,
    { fileId: share.file_id }
  );
  
  return {
    file: fileResult.rows[0],
    share,
  };
}

/**
 * Delete file
 */
export async function deleteFile(
  fileId: string,
  userId: string,
  isAdmin: boolean = false
): Promise<void> {
  // Check if user can delete file (owner or admin)
  if (!isAdmin) {
    const canAccess = await canAccessFile(fileId, userId);
    if (!canAccess) {
      throw new Error('File not found or access denied');
    }
  }
  
  // Get file record for logging
  const fileResult = await query('SELECT * FROM files WHERE id = $1', [fileId]);
  if (fileResult.rowCount === 0) {
    throw new Error('File not found');
  }
  
  const file = fileResult.rows[0];
  
  // Delete file record (cascade will delete shares)
  await query('DELETE FROM files WHERE id = $1', [fileId]);
  
  // Log file deletion
  await auditLog(
    userId,
    'FILE_DELETED',
    'file',
    fileId,
    { fileName: file.original_name, wasAdmin: isAdmin }
  );
}
