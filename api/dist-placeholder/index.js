/**
 * Enhanced index.js placeholder that mimics the real application
 * This provides a more complete implementation with JWT authentication
 */

// Import required packages
const Fastify = require('fastify');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cors = require('@fastify/cors');
const cookie = require('@fastify/cookie');

// Create a map to store users (in-memory database)
const users = new Map();
// Add a default admin user
users.set('admin@example.com', {
  id: '1',
  email: 'admin@example.com',
  name: 'Admin User',
  password: '$2b$10$zMsqCH1j3kGTmdk9DKvyseZjW1paMn2dZfi9MFqwNZfITOYQnMahu', // hashed version of "admin123"
  role: 'admin',
  createdAt: new Date().toISOString()
});

// Create a map to store files
const files = new Map();
// Add some sample files
files.set('1', {
  id: '1',
  name: 'example-document.pdf',
  size: 1024 * 1024,
  contentType: 'application/pdf',
  status: 'READY',
  createdAt: '2025-08-01T00:00:00.000Z',
  userId: '1'
});
files.set('2', {
  id: '2',
  name: 'sample-image.jpg',
  size: 512 * 1024,
  contentType: 'image/jpeg',
  status: 'READY',
  createdAt: '2025-08-02T00:00:00.000Z',
  userId: '1'
});

// Create the Fastify instance with logging
const fastify = Fastify({ 
  logger: {
    level: process.env.LOG_LEVEL || 'info'
  }
});

// Register plugins
const setupPlugins = async () => {
  // CORS
  await fastify.register(cors, {
    origin: process.env.CORS_ORIGIN || 'https://webupload-web.onrender.com',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
  });

  // Cookies for refresh tokens
  await fastify.register(cookie, {
    secret: process.env.REFRESH_TOKEN_SECRET || 'refresh-token-secret-placeholder'
  });

  // Authentication decorator
  fastify.decorate('authenticate', async (request, reply) => {
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error('Authorization header missing or invalid');
      }

      const token = authHeader.replace('Bearer ', '');
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'jwt-secret-placeholder');
      request.user = decoded;
    } catch (err) {
      reply.status(401).send({ success: false, error: 'Unauthorized' });
      return;
    }
  });

  fastify.decorate('requireAdmin', async (request, reply) => {
    if (request.user.role !== 'admin') {
      reply.status(403).send({ success: false, error: 'Forbidden - Admin access required' });
      return;
    }
  });
};

// Setup routes
const setupRoutes = async () => {
  // Health check endpoint
  fastify.get('/healthz', async () => {
    return { status: 'ok', message: 'Service is running' };
  });

  // Root endpoint
  fastify.get('/', async () => {
    return { status: 'ok', message: 'WebUpload API is running' };
  });

  // Direct auth endpoints (for backward compatibility)
  fastify.post('/auth/login', async (request, reply) => {
    const { email, password } = request.body;
    
    if (!email || !password) {
      reply.status(400).send({ 
        success: false, 
        error: 'Email and password are required' 
      });
      return;
    }
    
    const user = users.get(email);
    
    if (!user) {
      reply.status(401).send({ 
        success: false, 
        error: 'Invalid credentials' 
      });
      return;
    }
    
    const passwordMatches = await bcrypt.compare(password, user.password);
    
    if (!passwordMatches) {
      reply.status(401).send({ 
        success: false, 
        error: 'Invalid credentials' 
      });
      return;
    }
    
    // Generate JWT token
    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role
    };
    
    const accessToken = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET || 'jwt-secret-placeholder',
      { expiresIn: '1h' }
    );
    
    // Set refresh token as cookie
    const refreshToken = jwt.sign(
      tokenPayload,
      process.env.REFRESH_TOKEN_SECRET || 'refresh-token-secret-placeholder',
      { expiresIn: '7d' }
    );
    
    reply.setCookie('refreshToken', refreshToken, {
      httpOnly: true,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none'
    });
    
    return { 
      success: true, 
      message: 'Login successful',
      data: {
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      }
    };
  });

  // API prefix routes with /api prefix
  fastify.register((instance, opts, done) => {
    // User registration
    instance.post('/auth/register', async (request, reply) => {
    const { email, password, name } = request.body;
    
    if (!email || !password || !name) {
      reply.status(400).send({ 
        success: false, 
        error: 'Email, password, and name are required' 
      });
      return;
    }
    
    if (users.has(email)) {
      reply.status(409).send({ 
        success: false, 
        error: 'User already exists' 
      });
      return;
    }
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create a new user
    const newUser = {
      id: (users.size + 1).toString(),
      email,
      name,
      password: hashedPassword,
      role: 'user',
      createdAt: new Date().toISOString()
    };
    
    users.set(email, newUser);
    
    reply.status(201).send({ 
      success: true, 
      message: 'User registered successfully'
    });
  });

  // User login
  instance.post('/auth/login', async (request, reply) => {
    const { email, password } = request.body;
    
    if (!email || !password) {
      reply.status(400).send({ 
        success: false, 
        error: 'Email and password are required' 
      });
      return;
    }
    
    const user = users.get(email);
    
    if (!user) {
      reply.status(401).send({ 
        success: false, 
        error: 'Invalid credentials' 
      });
      return;
    }
    
    const passwordMatches = await bcrypt.compare(password, user.password);
    
    if (!passwordMatches) {
      reply.status(401).send({ 
        success: false, 
        error: 'Invalid credentials' 
      });
      return;
    }
    
    // Generate JWT token
    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role
    };
    
    const accessToken = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET || 'jwt-secret-placeholder',
      { expiresIn: '1h' }
    );
    
    // Set refresh token as cookie
    const refreshToken = jwt.sign(
      tokenPayload,
      process.env.REFRESH_TOKEN_SECRET || 'refresh-token-secret-placeholder',
      { expiresIn: '7d' }
    );
    
    reply.setCookie('refreshToken', refreshToken, {
      httpOnly: true,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none'
    });
    
    return { 
      success: true, 
      message: 'Login successful',
      data: {
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      }
    };
  });

  // Get user profile
  instance.get('/auth/me', { preHandler: fastify.authenticate }, async (request) => {
    const user = users.get(request.user.email);
    
    if (!user) {
      return { 
        success: false, 
        error: 'User not found' 
      };
    }
    
    // Don't return the password
    const { password, ...userWithoutPassword } = user;
    
    return { 
      success: true, 
      data: userWithoutPassword
    };
  });

  // Get files
  instance.get('/files', { preHandler: fastify.authenticate }, async (request) => {
    const { status, page = 1, pageSize = 20 } = request.query;
    
    let filteredFiles = [...files.values()];
    
    // Filter by status if provided
    if (status) {
      filteredFiles = filteredFiles.filter(file => file.status === status);
    }
    
    // For admin, show all files; for users, show only their files
    if (request.user.role !== 'admin') {
      filteredFiles = filteredFiles.filter(file => file.userId === request.user.id);
    }
    
    // Pagination
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedFiles = filteredFiles.slice(startIndex, endIndex);
    
    return { 
      success: true, 
      data: {
        files: paginatedFiles,
        pagination: {
          totalItems: filteredFiles.length,
          totalPages: Math.ceil(filteredFiles.length / pageSize),
          currentPage: page,
          pageSize
        }
      }
    };
  });
    
    // Signal that we're done setting up the instance
    done();
  }, { prefix: '/api' });
};

// Start server
const start = async () => {
  try {
    // Set up plugins
    await setupPlugins();
    
    // Set up routes
    await setupRoutes();
    
    // Log all registered routes for debugging
    console.log('Registered routes:');
    fastify.routes.forEach(route => {
      console.log(`${route.method} ${route.url}`);
    });
    
    // Start server
    await fastify.listen({ port: process.env.PORT || 8000, host: '0.0.0.0' });
    console.log(`Server listening on ${fastify.server.address().port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

// Handle graceful shutdown
const gracefulShutdown = async () => {
  try {
    console.log('Shutting down server...');
    await fastify.close();
    console.log('Server shut down successfully');
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
};

// Listen for termination signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start the server
start();
