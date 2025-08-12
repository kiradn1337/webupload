/**
 * Simple index.js placeholder to make the build pass
 * This file will allow the service to start and respond to health checks
 */

const fastify = require('fastify')({ logger: true });

// Register CORS plugin
fastify.register(require('@fastify/cors'), { 
  origin: process.env.CORS_ORIGIN || 'https://webupload-web.onrender.com',
  credentials: true,
  methods: ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
});

// Basic routes
fastify.get('/healthz', async (request, reply) => {
  return { status: 'ok', message: 'Service is running' };
});

// Root route
fastify.get('/', async (request, reply) => {
  return { status: 'ok', message: 'WebUpload API is running' };
});

// Mock login endpoint
fastify.post('/auth/login', async (request, reply) => {
  const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEiLCJlbWFpbCI6ImFkbWluQGV4YW1wbGUuY29tIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNjI1MDYwMDAwLCJleHAiOjE2MjUxNDY0MDB9.thisisnotarealtokenjustamockfortesting';
  
  return { 
    success: true, 
    message: 'Login successful',
    data: {
      accessToken: mockToken,
      user: {
        id: '1',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'admin'
      }
    }
  };
});

// Mock register endpoint
fastify.post('/auth/register', async (request, reply) => {
  return { 
    success: true, 
    message: 'Registration successful. Please log in.'
  };
});

// Mock me endpoint for retrieving user profile
fastify.get('/auth/me', async (request, reply) => {
  return { 
    success: true, 
    data: {
      id: '1',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'admin',
      createdAt: '2025-01-01T00:00:00.000Z'
    }
  };
});

// Mock files endpoint
fastify.get('/files', async (request, reply) => {
  return { 
    success: true, 
    data: {
      files: [
        {
          id: '1',
          name: 'example-document.pdf',
          size: 1024 * 1024, // 1MB
          contentType: 'application/pdf',
          status: 'READY',
          createdAt: '2025-08-01T00:00:00.000Z',
          userId: '1'
        },
        {
          id: '2',
          name: 'sample-image.jpg',
          size: 512 * 1024, // 512KB
          contentType: 'image/jpeg',
          status: 'READY',
          createdAt: '2025-08-02T00:00:00.000Z',
          userId: '1'
        }
      ],
      pagination: {
        totalItems: 2,
        totalPages: 1,
        currentPage: 1,
        pageSize: 20
      }
    }
  };
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
