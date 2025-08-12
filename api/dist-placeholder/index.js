/**
 * Simple index.js placeholder to make the build pass
 * This file will allow the service to start and respond to health checks
 */

const fastify = require('fastify')({ logger: true });

// Basic routes
fastify.get('/healthz', async (request, reply) => {
  return { status: 'ok', message: 'Service is running' };
});

// Root route
fastify.get('/', async (request, reply) => {
  return { status: 'ok', message: 'WebUpload API is running' };
});

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: process.env.PORT || 8000, host: '0.0.0.0' });
    console.log(`Server listening on ${fastify.server.address().port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
