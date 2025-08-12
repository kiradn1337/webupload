import { createHash } from 'crypto';
import { fileTypeFromBuffer } from 'file-type';
import NodeClam from 'clamscan';
import sharp from 'sharp';
import mime from 'mime-types';
import { query } from './db';
import { downloadFileFromS3, uploadFileToS3 } from './storage';
import config from '../config';
import { logger } from '../utils/logger';
import { auditLog } from './audit';

// Initialize ClamAV scanner
const initClamAV = async () => {
  try {
    const clamscan = await new NodeClam().init({
      clamdscan: {
        socket: false,
        host: config.antivirus.host,
        port: config.antivirus.port,
      },
    });
    return clamscan;
  } catch (error) {
    logger.error('Failed to initialize ClamAV:', error);
    throw new Error('Failed to initialize virus scanner');
  }
};

// List of file types safe for preview
const safePreviewTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain',
  'application/pdf',
];

// List of potentially dangerous file types
const dangerousFileTypes = [
  'application/x-msdownload',
  'application/x-executable',
  'application/x-dosexec',
  'application/x-msdos-program',
  'application/x-msdos-windows',
  'application/bat',
  'application/x-bat',
  'application/x-msdownload',
  'application/javascript',
  'text/javascript',
  'application/html',
  'text/html',
  'application/wasm',
  'application/jar',
  'application/java-archive',
  'image/svg+xml', // SVGs can contain malicious code
];

/**
 * Process a file
 */
export async function processFile(fileId: string): Promise<void> {
  logger.info(`Starting to process file: ${fileId}`);

  try {
    // Update file status to scanning
    await query(
      'UPDATE files SET status = $1, updated_at = NOW() WHERE id = $2',
      ['scanning', fileId]
    );

    // Get file from database
    const fileResult = await query('SELECT * FROM files WHERE id = $1', [fileId]);
    if (fileResult.rowCount === 0) {
      throw new Error(`File not found: ${fileId}`);
    }
    const file = fileResult.rows[0];

    // Download file from S3
    const fileBuffer = await downloadFileFromS3(file.storage_key);

    // Calculate SHA-256 hash
    const sha256 = createHash('sha256').update(fileBuffer).digest('hex');

    // Check for duplicate files if deduplication is enabled
    if (config.fileUpload.enableFileDeduplication) {
      const duplicateResult = await query(
        'SELECT id FROM files WHERE sha256 = $1 AND id != $2 AND status = $3 LIMIT 1',
        [sha256, fileId, 'clean']
      );

      if (duplicateResult.rowCount > 0) {
        const duplicateFileId = duplicateResult.rows[0].id;
        logger.info(`Duplicate file found: ${fileId} is a duplicate of ${duplicateFileId}`);

        // Update file record with duplicate information
        await query(
          'UPDATE files SET sha256 = $1, status = $2, updated_at = NOW(), scanned_at = NOW() WHERE id = $3',
          [sha256, 'clean', fileId]
        );

        await auditLog(
          file.owner_id,
          'FILE_DEDUPLICATED',
          'file',
          fileId,
          { originalFileId: fileId, duplicateOfId: duplicateFileId }
        );
        return;
      }
    }

    // Detect MIME type using magic bytes
    const fileTypeResult = await fileTypeFromBuffer(fileBuffer);
    const detectedMime = fileTypeResult?.mime || mime.lookup(file.original_name) || 'application/octet-stream';

    // Scan file with ClamAV
    const clamscan = await initClamAV();
    const scanResult = await clamscan.scanBuffer(fileBuffer);

    let status = 'clean';
    let reason = null;

    // Check if virus detected
    if (scanResult.isInfected) {
      status = 'quarantined';
      reason = `Virus detected: ${scanResult.viruses?.join(', ')}`;
      logger.warn(`Virus detected in file ${fileId}: ${reason}`);
      
      await auditLog(
        file.owner_id,
        'FILE_QUARANTINED',
        'file',
        fileId,
        { reason: reason }
      );
    } 
    // Check if file type is dangerous
    else if (dangerousFileTypes.includes(detectedMime)) {
      status = 'quarantined';
      reason = `Potentially dangerous file type detected: ${detectedMime}`;
      logger.warn(`Dangerous file type in ${fileId}: ${reason}`);
      
      await auditLog(
        file.owner_id,
        'FILE_QUARANTINED',
        'file',
        fileId,
        { reason: reason }
      );
    }

    // For clean files, generate thumbnails for images
    if (status === 'clean' && detectedMime.startsWith('image/') && detectedMime !== 'image/svg+xml') {
      try {
        // Generate thumbnail with stripped metadata
        const thumbnail = await sharp(fileBuffer)
          .resize({
            width: config.fileUpload.thumbnailMaxWidth,
            height: config.fileUpload.thumbnailMaxHeight,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .jpeg({ quality: 80 })
          .toBuffer();

        // Upload thumbnail to S3
        await uploadFileToS3(
          `thumbnails/${file.storage_key}`,
          thumbnail,
          'image/jpeg',
          { originalFileId: fileId }
        );
      } catch (error) {
        logger.error(`Error generating thumbnail for file ${fileId}:`, error);
      }
    }

    // Handle SVG files - convert to PNG for preview
    if (status === 'clean' && detectedMime === 'image/svg+xml') {
      try {
        const pngThumbnail = await sharp(fileBuffer)
          .resize({
            width: config.fileUpload.thumbnailMaxWidth,
            height: config.fileUpload.thumbnailMaxHeight,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .png()
          .toBuffer();

        // Upload PNG thumbnail to S3
        await uploadFileToS3(
          `thumbnails/${file.storage_key}`,
          pngThumbnail,
          'image/png',
          { originalFileId: fileId }
        );
      } catch (error) {
        logger.error(`Error converting SVG to PNG for file ${fileId}:`, error);
      }
    }

    // Update file record with processing results
    await query(
      'UPDATE files SET sha256 = $1, detected_mime = $2, status = $3, reason = $4, updated_at = NOW(), scanned_at = NOW() WHERE id = $5',
      [sha256, detectedMime, status, reason, fileId]
    );

    // Log successful processing
    logger.info(`Successfully processed file ${fileId} - Status: ${status}`);
    
    await auditLog(
      file.owner_id,
      'FILE_PROCESSED',
      'file',
      fileId,
      { status }
    );
  } catch (error) {
    logger.error(`Error processing file ${fileId}:`, error);
    
    // Update file status to rejected on error
    await query(
      'UPDATE files SET status = $1, reason = $2, updated_at = NOW(), scanned_at = NOW() WHERE id = $3',
      ['rejected', `Processing error: ${(error as Error).message}`, fileId]
    );
    
    throw error;
  }
}

/**
 * Check if a file type is safe for preview
 */
export function isFileSafeForPreview(mimeType: string): boolean {
  return safePreviewTypes.includes(mimeType);
}
