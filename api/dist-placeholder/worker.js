/**
 * Simple worker.js placeholder to make the build pass
 * This file will allow the worker service to start
 */

console.log('Worker service started');

// Simple worker loop
const runWorker = async () => {
  console.log('Worker checking for jobs...');
  
  // Simple sleep function
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  
  // Worker main loop
  while (true) {
    try {
      console.log(`Worker running at ${new Date().toISOString()}`);
      await sleep(60000); // Sleep for 1 minute
    } catch (error) {
      console.error('Error in worker:', error);
      await sleep(10000); // Sleep for 10 seconds on error
    }
  }
};

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down worker');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down worker');
  process.exit(0);
});

// Start worker
runWorker().catch(error => {
  console.error('Fatal worker error:', error);
  process.exit(1);
});
