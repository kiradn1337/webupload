import { Queue } from 'bullmq';
import config from '../config';

// Create a queue for file processing
const fileProcessingQueue = new Queue('fileProcessing', {
  connection: {
    host: new URL(config.redis.url).hostname,
    port: parseInt(new URL(config.redis.url).port || '6379', 10),
  },
  defaultJobOptions: {
    attempts: 3, // Retry up to 3 times
    backoff: {
      type: 'exponential',
      delay: 1000, // 1 second initial delay
    },
    removeOnComplete: true, // Remove jobs after successful completion
    removeOnFail: 100, // Keep the last 100 failed jobs for inspection
  },
});

export { fileProcessingQueue };
