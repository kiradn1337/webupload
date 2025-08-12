import { FastifyInstance } from 'fastify';
import {
  registerHandler,
  loginHandler,
  refreshTokenHandler,
  logoutHandler,
  getMeHandler,
} from '../controllers/authController';
import {
  initiateUploadHandler,
  completeUploadHandler,
  getFilesHandler,
  getFileHandler,
  downloadFileHandler,
  createShareHandler,
  getFileByShareTokenHandler,
  deleteFileHandler,
} from '../controllers/fileController';
import {
  adminListFilesHandler,
  adminFileActionHandler,
  adminListUsersHandler,
  adminGetAuditLogsHandler,
} from '../controllers/adminController';
import * as schemas from '../schemas';
import { logger } from '../utils/logger';

export async function setupRoutes(fastify: FastifyInstance): Promise<void> {
  // Health check routes
  fastify.get('/healthz', async () => {
    return { status: 'ok' };
  });

  fastify.get('/readyz', async () => {
    // Implement readiness checks here
    return { status: 'ready' };
  });

  // WebSocket for real-time updates
  fastify.get('/ws', { websocket: true }, (connection, req) => {
    connection.socket.on('message', (message) => {
      const data = JSON.parse(message.toString());
      
      if (data.type === 'auth') {
        // Authenticate WebSocket connection
        try {
          const decoded = fastify.jwt.verify(data.token);
          connection.socket.send(JSON.stringify({ type: 'auth_success', userId: decoded.id }));
          
          // Store user ID with socket for notifications
          connection.socket.userId = decoded.id;
        } catch (error) {
          connection.socket.send(JSON.stringify({ type: 'auth_error', message: 'Invalid token' }));
          connection.socket.close();
        }
      }
    });

    connection.socket.on('close', () => {
      // Clean up on disconnect
    });
  });

  // Authentication routes
  fastify.post('/auth/register', {
    schema: schemas.registerSchema,
    attachValidation: true,
  }, async (request, reply) => {
    if (request.validationError) {
      return reply.code(400).send({ error: request.validationError.message });
    }
    return registerHandler(request as any, reply);
  });

  fastify.post('/auth/login', {
    schema: schemas.loginSchema,
    attachValidation: true,
  }, async (request, reply) => {
    if (request.validationError) {
      return reply.code(400).send({ error: request.validationError.message });
    }
    return loginHandler(request as any, reply);
  });

  fastify.post('/auth/refresh', async (request, reply) => {
    return refreshTokenHandler(request, reply);
  });

  fastify.post('/auth/logout', {
    preHandler: fastify.auth([fastify.authenticate]),
  }, async (request, reply) => {
    return logoutHandler(request, reply);
  });

  // User routes
  fastify.get('/me', {
    preHandler: fastify.auth([fastify.authenticate]),
  }, async (request, reply) => {
    return getMeHandler(request, reply);
  });

  // File upload routes
  fastify.post('/uploads/initiate', {
    schema: schemas.initiateUploadSchema,
    preHandler: fastify.auth([fastify.authenticate]),
    attachValidation: true,
  }, async (request, reply) => {
    if (request.validationError) {
      return reply.code(400).send({ error: request.validationError.message });
    }
    return initiateUploadHandler(request as any, reply);
  });

  fastify.post('/uploads/complete/:id', {
    schema: schemas.completeUploadSchema,
    preHandler: fastify.auth([fastify.authenticate]),
    attachValidation: true,
  }, async (request, reply) => {
    if (request.validationError) {
      return reply.code(400).send({ error: request.validationError.message });
    }
    return completeUploadHandler(request as any, reply);
  });

  // File management routes
  fastify.get('/files', {
    preHandler: fastify.auth([fastify.authenticate]),
  }, async (request, reply) => {
    return getFilesHandler(request as any, reply);
  });

  fastify.get('/files/:id', {
    schema: schemas.fileIdParamSchema,
    preHandler: fastify.auth([fastify.authenticate]),
    attachValidation: true,
  }, async (request, reply) => {
    if (request.validationError) {
      return reply.code(400).send({ error: request.validationError.message });
    }
    return getFileHandler(request as any, reply);
  });

  fastify.get('/files/:id/download', {
    schema: schemas.fileIdParamSchema,
    preHandler: fastify.auth([fastify.authenticate]),
    attachValidation: true,
  }, async (request, reply) => {
    if (request.validationError) {
      return reply.code(400).send({ error: request.validationError.message });
    }
    return downloadFileHandler(request as any, reply);
  });

  fastify.post('/files/:id/share', {
    schema: schemas.createShareSchema,
    preHandler: fastify.auth([fastify.authenticate]),
    attachValidation: true,
  }, async (request, reply) => {
    if (request.validationError) {
      return reply.code(400).send({ error: request.validationError.message });
    }
    return createShareHandler(request as any, reply);
  });

  fastify.delete('/files/:id', {
    schema: schemas.fileIdParamSchema,
    preHandler: fastify.auth([fastify.authenticate]),
    attachValidation: true,
  }, async (request, reply) => {
    if (request.validationError) {
      return reply.code(400).send({ error: request.validationError.message });
    }
    return deleteFileHandler(request as any, reply);
  });

  // Public shared file route
  fastify.get('/s/:token', {
    schema: schemas.getShareSchema,
    attachValidation: true,
  }, async (request, reply) => {
    if (request.validationError) {
      return reply.code(400).send({ error: request.validationError.message });
    }
    return getFileByShareTokenHandler(request as any, reply);
  });

  // Admin routes
  fastify.get('/admin/files', {
    preHandler: fastify.auth([fastify.authenticate, fastify.requireAdmin]),
  }, async (request, reply) => {
    return adminListFilesHandler(request as any, reply);
  });

  fastify.post('/admin/files/:id/action', {
    schema: schemas.adminFileActionSchema,
    preHandler: fastify.auth([fastify.authenticate, fastify.requireAdmin]),
    attachValidation: true,
  }, async (request, reply) => {
    if (request.validationError) {
      return reply.code(400).send({ error: request.validationError.message });
    }
    return adminFileActionHandler(request as any, reply);
  });

  fastify.get('/admin/users', {
    preHandler: fastify.auth([fastify.authenticate, fastify.requireAdmin]),
  }, async (request, reply) => {
    return adminListUsersHandler(request as any, reply);
  });

  fastify.get('/admin/audit-logs', {
    preHandler: fastify.auth([fastify.authenticate, fastify.requireAdmin]),
  }, async (request, reply) => {
    return adminGetAuditLogsHandler(request as any, reply);
  });

  logger.info('Routes registered successfully');
}
