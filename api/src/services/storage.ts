import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import config from '../config';
import { logger } from '../utils/logger';

// Create S3 client
const s3Client = new S3Client({
  region: config.s3.region,
  endpoint: config.s3.endpoint,
  credentials: {
    accessKeyId: config.s3.accessKey,
    secretAccessKey: config.s3.secretKey,
  },
  forcePathStyle: config.s3.forcePathStyle,
});

/**
 * Generate a presigned URL for uploading a file to S3
 */
export async function generateUploadUrl(
  contentType: string,
  size: number,
  originalFilename: string
): Promise<{ url: string; key: string }> {
  // Generate a unique key for S3 storage
  const key = `${Date.now()}-${randomUUID()}`;
  
  // Create a command to put an object in S3
  const command = new PutObjectCommand({
    Bucket: config.s3.bucket,
    Key: key,
    ContentType: contentType,
    ContentLength: size,
    Metadata: {
      'original-filename': encodeURIComponent(originalFilename),
    },
  });
  
  // Generate a presigned URL for uploading
  const url = await getSignedUrl(s3Client, command, {
    expiresIn: config.fileUpload.presignedUrlExpiry,
  });
  
  return { url, key };
}

/**
 * Generate a presigned URL for downloading a file from S3
 */
export async function generateDownloadUrl(
  key: string,
  originalFilename: string,
  forceAttachment: boolean = true
): Promise<string> {
  // Create a command to get an object from S3
  const command = new GetObjectCommand({
    Bucket: config.s3.bucket,
    Key: key,
    ResponseContentDisposition: forceAttachment
      ? `attachment; filename="${encodeURIComponent(originalFilename)}"`
      : `inline; filename="${encodeURIComponent(originalFilename)}"`,
  });
  
  // Generate a presigned URL for downloading
  const url = await getSignedUrl(s3Client, command, {
    expiresIn: config.fileUpload.presignedUrlExpiry,
  });
  
  return url;
}

/**
 * Download a file from S3 to a local buffer
 */
export async function downloadFileFromS3(key: string): Promise<Buffer> {
  try {
    // Create a command to get an object from S3
    const command = new GetObjectCommand({
      Bucket: config.s3.bucket,
      Key: key,
    });
    
    // Get the object from S3
    const response = await s3Client.send(command);
    
    // Read the object body
    const chunks: Uint8Array[] = [];
    const stream = response.Body as any;
    
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    
    return Buffer.concat(chunks);
  } catch (error) {
    logger.error(`Error downloading file from S3: ${key}`, error);
    throw new Error(`Failed to download file from storage: ${(error as Error).message}`);
  }
}

/**
 * Upload a file to S3
 */
export async function uploadFileToS3(
  key: string,
  buffer: Buffer,
  contentType: string,
  metadata: Record<string, string> = {}
): Promise<void> {
  try {
    // Create a command to put an object in S3
    const command = new PutObjectCommand({
      Bucket: config.s3.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      Metadata: metadata,
    });
    
    // Upload the object to S3
    await s3Client.send(command);
  } catch (error) {
    logger.error(`Error uploading file to S3: ${key}`, error);
    throw new Error(`Failed to upload file to storage: ${(error as Error).message}`);
  }
}
