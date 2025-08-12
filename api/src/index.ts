import Fastify, { FastifyInstance } from 'fastify';
import config from './config';
import { setupPlugins } from './plugins';
import { setupRoutes } from './routes';
import { logger } from './utils/logger';

// Create Fastify instance
const server: FastifyInstance = Fastify({
  logger,
  trustProxy: true, // Trust proxy headers for proper IP addresses behind proxies
});

// Start server function
const startServer = async () => {
  try {
    // Register plugins
    await setupPlugins(server);

    // Register routes
    await setupRoutes(server);

    // Start listening
    await server.listen({ port: config.server.port, host: config.server.host });

    logger.info(`Server is running on ${config.server.host}:${config.server.port}`);
  } catch (error) {
    logger.error(error);
    process.exit(1);
  }
};

// Handle graceful shutdown
const gracefulShutdown = async () => {
  try {
    logger.info('Shutting down server...');
    await server.close();
    logger.info('Server shut down successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
};

// Listen for termination signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start the server
startServer();

export default server;
