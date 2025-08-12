/**
 * Enhanced worker.js placeholder that mimics file processing worker
 */

const { createClient } = require('redis');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const sleep = promisify(setTimeout);

// Connect to Redis
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

// Handle Redis errors
redisClient.on('error', (err) => {
  console.error('Redis error:', err);
});

// Connect to Redis
(async () => {
  try {
    await redisClient.connect();
    console.log('Connected to Redis');
  } catch (err) {
    console.error('Failed to connect to Redis:', err);
  }
})();

// File processing worker
const processFileQueue = async () => {
  console.log('Worker started - checking for file processing jobs');

  // Create placeholder temp directory if it doesn't exist
  const tempDir = path.join(process.cwd(), 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // Worker main loop
  while (true) {
    try {
      console.log(`Worker running at ${new Date().toISOString()}`);
      
      // Try to get a job from Redis
      const jobData = await redisClient.lPop('file-processing-queue');
      
      if (jobData) {
        console.log('Processing job:', jobData);
        const job = JSON.parse(jobData);
        
        // Simulate file processing
        console.log(`Processing file: ${job.fileId}`);
        await sleep(2000); // Simulate processing time
        
        // Log successful processing
        console.log(`File ${job.fileId} processed successfully`);
        
        // Update status in Redis (simulated)
        await redisClient.hSet(`file:${job.fileId}`, 'status', 'READY');
        console.log(`Updated status of file ${job.fileId} to READY`);
      } else {
        // No jobs, wait a bit before checking again
        await sleep(5000);
      }
    } catch (error) {
      console.error('Error processing file:', error);
      await sleep(10000); // Sleep for 10 seconds on error
    }
  }
};

// Handle graceful shutdown
const gracefulShutdown = async () => {
  try {
    console.log('Shutting down worker...');
    await redisClient.quit();
    console.log('Redis connection closed');
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
};

// Listen for termination signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start worker and handle errors
processFileQueue().catch(error => {
  console.error('Fatal worker error:', error);
  process.exit(1);
});
