import { FastifyRequest, FastifyReply } from 'fastify';
import {
  initiateFileUpload,
  completeFileUpload,
  getFilesByOwner,
  getFileById,
  generateFileDownloadUrl,
  createFileShare,
  getFileByShareToken,
  deleteFile
} from '../services/fileManager';
import { isFileSafeForPreview } from '../services/fileProcessor';
import { auditLog } from '../services/audit';
import { logger } from '../utils/logger';

/**
 * Initiate file upload
 */
export async function initiateUploadHandler(
  request: FastifyRequest<{
    Body: {
      fileName: string;
      fileSize: number;
      contentType: string;
    };
  }>,
  reply: FastifyReply
) {
  const { fileName, fileSize, contentType } = request.body;
  const userId = request.user.id;

  try {
    const result = await initiateFileUpload(userId, fileName, fileSize, contentType);
    return reply.code(200).send(result);
  } catch (error) {
    logger.error('Initiate upload error:', error);

    if ((error as Error).message.includes('quota exceeded')) {
      return reply.code(400).send({ error: (error as Error).message });
    }

    return reply.code(500).send({ error: 'Failed to initiate upload' });
  }
}

/**
 * Complete file upload
 */
export async function completeUploadHandler(
  request: FastifyRequest<{
    Params: { id: string };
  }>,
  reply: FastifyReply
) {
  const { id } = request.params;
  const userId = request.user.id;

  try {
    const file = await completeFileUpload(id, userId);
    return reply.code(200).send({ file });
  } catch (error) {
    logger.error(`Complete upload error for file ${id}:`, error);
    return reply.code(500).send({ error: 'Failed to complete upload' });
  }
}

/**
 * Get files list
 */
export async function getFilesHandler(
  request: FastifyRequest<{
    Querystring: {
      status?: string;
      page?: string;
      pageSize?: string;
    };
  }>,
  reply: FastifyReply
) {
  const userId = request.user.id;
  const status = request.query.status;
  const page = request.query.page ? parseInt(request.query.page) : 1;
  const pageSize = request.query.pageSize ? parseInt(request.query.pageSize) : 20;

  try {
    const files = await getFilesByOwner(userId, status, page, pageSize);
    return reply.code(200).send(files);
  } catch (error) {
    logger.error('Get files error:', error);
    return reply.code(500).send({ error: 'Failed to get files' });
  }
}

/**
 * Get file details
 */
export async function getFileHandler(
  request: FastifyRequest<{
    Params: { id: string };
  }>,
  reply: FastifyReply
) {
  const { id } = request.params;
  const userId = request.user.id;

  try {
    const file = await getFileById(id);

    if (!file) {
      return reply.code(404).send({ error: 'File not found' });
    }

    // Check if user owns the file or is an admin
    if (file.owner_id !== userId && request.user.role !== 'admin') {
      return reply.code(403).send({ error: 'Access denied' });
    }

    // Add info about preview safety
    const canPreview = file.status === 'clean' && file.detected_mime && isFileSafeForPreview(file.detected_mime);

    return reply.code(200).send({
      ...file,
      canPreview,
    });
  } catch (error) {
    logger.error(`Get file error for ${id}:`, error);
    return reply.code(500).send({ error: 'Failed to get file details' });
  }
}

/**
 * Download file
 */
export async function downloadFileHandler(
  request: FastifyRequest<{
    Params: { id: string };
  }>,
  reply: FastifyReply
) {
  const { id } = request.params;
  const userId = request.user.id;

  try {
    const { url, filename } = await generateFileDownloadUrl(id, userId);
    
    // Audit log for download
    await auditLog(
      userId,
      'FILE_DOWNLOADED',
      'file',
      id,
      { filename },
      request.ip,
      request.headers['user-agent']
    );
    
    return reply.code(200).send({ url, filename });
  } catch (error) {
    logger.error(`Download file error for ${id}:`, error);
    
    if ((error as Error).message.includes('status')) {
      return reply.code(400).send({ error: (error as Error).message });
    }
    
    if ((error as Error).message.includes('not found') || (error as Error).message.includes('access denied')) {
      return reply.code(404).send({ error: 'File not found or access denied' });
    }
    
    return reply.code(500).send({ error: 'Failed to generate download URL' });
  }
}

/**
 * Create file share
 */
export async function createShareHandler(
  request: FastifyRequest<{
    Params: { id: string };
    Body: {
      expiresInMinutes?: number;
      oneTimeUse?: boolean;
    };
  }>,
  reply: FastifyReply
) {
  const { id } = request.params;
  const { expiresInMinutes = 15, oneTimeUse = false } = request.body;
  const userId = request.user.id;

  try {
    const shareToken = await createFileShare(id, userId, expiresInMinutes, oneTimeUse);
    
    // Generate share URL
    const host = request.headers.host || 'localhost:8000';
    const protocol = request.protocol || 'http';
    const shareUrl = `${protocol}://${host}/s/${shareToken}`;
    
    return reply.code(200).send({
      shareToken,
      shareUrl,
      expiresInMinutes,
      oneTimeUse,
    });
  } catch (error) {
    logger.error(`Create share error for file ${id}:`, error);
    
    if ((error as Error).message.includes('not found') || (error as Error).message.includes('access denied')) {
      return reply.code(404).send({ error: 'File not found or access denied' });
    }
    
    if ((error as Error).message.includes('status')) {
      return reply.code(400).send({ error: (error as Error).message });
    }
    
    return reply.code(500).send({ error: 'Failed to create file share' });
  }
}

/**
 * Get file by share token
 */
export async function getFileByShareTokenHandler(
  request: FastifyRequest<{
    Params: { token: string };
  }>,
  reply: FastifyReply
) {
  const { token } = request.params;

  try {
    const result = await getFileByShareToken(token);
    
    if (!result) {
      return reply.code(404).send({ error: 'Share not found or expired' });
    }
    
    const { file, share } = result;
    
    // Generate download URL for shared file
    const { url } = await generateFileDownloadUrl(file.id, share.created_by);
    
    // Add info about preview safety
    const canPreview = file.detected_mime && isFileSafeForPreview(file.detected_mime);
    
    // Log share access
    await auditLog(
      null,
      'SHARED_FILE_ACCESSED',
      'file_share',
      share.id,
      { fileId: file.id },
      request.ip,
      request.headers['user-agent']
    );
    
    return reply.code(200).send({
      file: {
        id: file.id,
        name: file.original_name,
        size: file.size_bytes,
        mimeType: file.detected_mime,
        createdAt: file.created_at,
      },
      downloadUrl: url,
      canPreview,
    });
  } catch (error) {
    logger.error(`Get shared file error for token ${token}:`, error);
    return reply.code(500).send({ error: 'Failed to get shared file' });
  }
}

/**
 * Delete file
 */
export async function deleteFileHandler(
  request: FastifyRequest<{
    Params: { id: string };
  }>,
  reply: FastifyReply
) {
  const { id } = request.params;
  const userId = request.user.id;
  const isAdmin = request.user.role === 'admin';

  try {
    await deleteFile(id, userId, isAdmin);
    return reply.code(200).send({ success: true });
  } catch (error) {
    logger.error(`Delete file error for ${id}:`, error);
    
    if ((error as Error).message.includes('not found') || (error as Error).message.includes('access denied')) {
      return reply.code(404).send({ error: 'File not found or access denied' });
    }
    
    return reply.code(500).send({ error: 'Failed to delete file' });
  }
}
