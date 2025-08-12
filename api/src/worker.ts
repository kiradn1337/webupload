import { Worker } from 'bullmq';
import { fileProcessingQueue } from './queue/fileProcessing';
import { processFile } from './services/fileProcessor';
import { logger } from './utils/logger';
import config from './config';

// Create file processing worker
const worker = new Worker(
  'fileProcessing',
  async (job) => {
    logger.info(`Processing file: ${job.data.fileId}`);
    
    try {
      await processFile(job.data.fileId);
      return { success: true, fileId: job.data.fileId };
    } catch (error) {
      logger.error(`Error processing file ${job.data.fileId}:`, error);
      throw error; // This will trigger a retry if configured
    }
  },
  {
    connection: {
      host: new URL(config.redis.url).hostname,
      port: parseInt(new URL(config.redis.url).port || '6379', 10),
    },
    concurrency: 2, // Process 2 files at a time
  }
);

// Handle worker events
worker.on('completed', (job) => {
  logger.info(`File processing completed: ${job.data.fileId}`);
});

worker.on('failed', (job, error) => {
  logger.error(`File processing failed for ${job?.data.fileId}:`, error);
});

logger.info('File processing worker started');

// Handle graceful shutdown
const gracefulShutdown = async () => {
  try {
    logger.info('Shutting down worker...');
    await worker.close();
    logger.info('Worker shut down successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during worker shutdown:', error);
    process.exit(1);
  }
};

// Listen for termination signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

export { worker };
