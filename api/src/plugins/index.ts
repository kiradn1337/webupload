import { FastifyInstance } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import fastifyCookie from '@fastify/cookie';
import fastifyWebsocket from '@fastify/websocket';
import config from '../config';
import { logger } from '../utils/logger';

// Database plugin
export const databasePlugin = fastifyPlugin(async (fastify: FastifyInstance) => {
  // Database is already initialized in db.ts
  logger.info('Database plugin registered');
});

// Auth plugin
export const authPlugin = fastifyPlugin(async (fastify: FastifyInstance) => {
  // Register JWT plugin
  await fastify.register(fastifyJwt, {
    secret: config.auth.jwtSecret,
    sign: {
      expiresIn: config.auth.jwtExpiresIn,
    },
  });

  // Register cookie plugin for refresh tokens
  await fastify.register(fastifyCookie, {
    secret: config.auth.refreshTokenSecret,
  });

  // Add authentication hook
  fastify.decorate('authenticate', async (request: any, reply: any) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  // Add admin role check
  fastify.decorate('requireAdmin', async (request: any, reply: any) => {
    if (request.user.role !== 'admin') {
      reply.status(403).send({ error: 'Forbidden' });
    }
  });

  logger.info('Auth plugin registered');
});

// Security plugins
export const securityPlugins = fastifyPlugin(async (fastify: FastifyInstance) => {
  // Register CORS
  await fastify.register(fastifyCors, {
    origin: config.security.corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // Register Helmet for security headers
  await fastify.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false, // Required for swagger-ui to work
  });

  // Register rate limit plugin
  await fastify.register(fastifyRateLimit, {
    global: true,
    max: config.rateLimiting.max,
    timeWindow: config.rateLimiting.window,
    skipOnError: true,
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded, please try again later',
    }),
  });

  logger.info('Security plugins registered');
});

// API documentation plugins
export const documentationPlugins = fastifyPlugin(async (fastify: FastifyInstance) => {
  // Register Swagger
  await fastify.register(fastifySwagger, {
    swagger: {
      info: {
        title: 'Secure File Upload API',
        description: 'API documentation for the Secure File Upload service',
        version: '1.0.0',
      },
      externalDocs: {
        url: 'https://github.com/yourusername/webupload',
        description: 'Find more info here',
      },
      host: 'localhost:8000',
      schemes: ['http', 'https'],
      consumes: ['application/json'],
      produces: ['application/json'],
      securityDefinitions: {
        bearerAuth: {
          type: 'apiKey',
          name: 'Authorization',
          in: 'header',
        },
      },
    },
    hideUntagged: false,
  });

  // Register Swagger UI
  await fastify.register(fastifySwaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });

  logger.info('Documentation plugins registered');
});

// WebSocket plugin
export const websocketPlugin = fastifyPlugin(async (fastify: FastifyInstance) => {
  await fastify.register(fastifyWebsocket);
  logger.info('WebSocket plugin registered');
});

// Register all plugins
export async function setupPlugins(fastify: FastifyInstance): Promise<void> {
  await fastify.register(databasePlugin);
  await fastify.register(authPlugin);
  await fastify.register(securityPlugins);
  await fastify.register(documentationPlugins);
  await fastify.register(websocketPlugin);

  logger.info('All plugins registered successfully');
}
