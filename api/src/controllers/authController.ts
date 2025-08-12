import { FastifyRequest, FastifyReply } from 'fastify';
import { registerUser, verifyCredentials, createRefreshToken, verifyRefreshToken, invalidateRefreshToken } from '../services/auth';
import { auditLog } from '../services/audit';
import { logger } from '../utils/logger';

/**
 * Register a new user
 */
export async function registerHandler(
  request: FastifyRequest<{ Body: { email: string; password: string } }>,
  reply: FastifyReply
) {
  const { email, password } = request.body;

  try {
    const user = await registerUser(email, password);
    
    // Generate access token
    const token = await reply.jwtSign({
      id: user.id,
      email: user.email,
      role: user.role,
    });
    
    // Generate refresh token
    const refreshToken = await createRefreshToken(user.id);
    
    // Set refresh token as an HTTP-only cookie
    reply.setCookie('refreshToken', refreshToken, {
      httpOnly: true,
      path: '/auth/refresh',
      sameSite: 'strict',
      secure: request.protocol === 'https',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });
    
    return reply.code(201).send({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerified: user.email_verified,
      },
      token,
    });
  } catch (error) {
    logger.error('Registration error:', error);
    
    if ((error as Error).message === 'Email already in use') {
      return reply.code(409).send({ error: 'Email already in use' });
    }
    
    return reply.code(500).send({ error: 'Failed to register user' });
  }
}

/**
 * Log in a user
 */
export async function loginHandler(
  request: FastifyRequest<{ Body: { email: string; password: string } }>,
  reply: FastifyReply
) {
  const { email, password } = request.body;
  
  try {
    const user = await verifyCredentials(email, password);
    
    if (!user) {
      return reply.code(401).send({ error: 'Invalid email or password' });
    }
    
    // Generate access token
    const token = await reply.jwtSign({
      id: user.id,
      email: user.email,
      role: user.role,
    });
    
    // Generate refresh token
    const refreshToken = await createRefreshToken(user.id);
    
    // Set refresh token as an HTTP-only cookie
    reply.setCookie('refreshToken', refreshToken, {
      httpOnly: true,
      path: '/auth/refresh',
      sameSite: 'strict',
      secure: request.protocol === 'https',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });
    
    // Log login
    await auditLog(
      user.id,
      'USER_LOGIN',
      'user',
      user.id,
      { email: user.email },
      request.ip,
      request.headers['user-agent']
    );
    
    return reply.code(200).send({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerified: user.email_verified,
      },
      token,
    });
  } catch (error) {
    logger.error('Login error:', error);
    return reply.code(500).send({ error: 'Failed to log in' });
  }
}

/**
 * Refresh access token
 */
export async function refreshTokenHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Get refresh token from cookie
  const refreshToken = request.cookies.refreshToken;
  
  if (!refreshToken) {
    return reply.code(401).send({ error: 'Refresh token required' });
  }
  
  try {
    // Verify refresh token
    const userId = await verifyRefreshToken(refreshToken);
    
    if (!userId) {
      return reply.code(401).send({ error: 'Invalid refresh token' });
    }
    
    // Get user data
    const userResult = await request.server.pg.query(
      'SELECT id, email, role, email_verified FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rowCount === 0) {
      return reply.code(401).send({ error: 'User not found' });
    }
    
    const user = userResult.rows[0];
    
    // Generate new access token
    const token = await reply.jwtSign({
      id: user.id,
      email: user.email,
      role: user.role,
    });
    
    // Generate new refresh token
    await invalidateRefreshToken(refreshToken);
    const newRefreshToken = await createRefreshToken(user.id);
    
    // Set new refresh token cookie
    reply.setCookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      path: '/auth/refresh',
      sameSite: 'strict',
      secure: request.protocol === 'https',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });
    
    // Log token refresh
    await auditLog(
      user.id,
      'TOKEN_REFRESHED',
      'user',
      user.id,
      {},
      request.ip,
      request.headers['user-agent']
    );
    
    return reply.code(200).send({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerified: user.email_verified,
      },
      token,
    });
  } catch (error) {
    logger.error('Token refresh error:', error);
    return reply.code(500).send({ error: 'Failed to refresh token' });
  }
}

/**
 * Log out a user
 */
export async function logoutHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Get refresh token from cookie
  const refreshToken = request.cookies.refreshToken;
  
  if (refreshToken) {
    try {
      // Invalidate refresh token
      await invalidateRefreshToken(refreshToken);
    } catch (error) {
      logger.error('Logout error:', error);
    }
  }
  
  // Clear refresh token cookie
  reply.clearCookie('refreshToken', {
    path: '/auth/refresh',
  });
  
  // Log logout
  if (request.user) {
    await auditLog(
      request.user.id,
      'USER_LOGOUT',
      'user',
      request.user.id,
      {},
      request.ip,
      request.headers['user-agent']
    );
  }
  
  return reply.code(200).send({ success: true });
}

/**
 * Get current user
 */
export async function getMeHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const userResult = await request.server.pg.query(
      'SELECT id, email, role, email_verified, storage_quota_bytes, files_quota FROM users WHERE id = $1',
      [request.user.id]
    );
    
    if (userResult.rowCount === 0) {
      return reply.code(404).send({ error: 'User not found' });
    }
    
    const user = userResult.rows[0];
    
    // Get user storage usage
    const storageResult = await request.server.pg.query(
      'SELECT COALESCE(SUM(size_bytes), 0) as used_storage FROM files WHERE owner_id = $1 AND status != $2',
      [request.user.id, 'rejected']
    );
    
    const usedStorage = parseInt(storageResult.rows[0].used_storage, 10);
    
    // Get user files count
    const filesResult = await request.server.pg.query(
      'SELECT COUNT(*) as file_count FROM files WHERE owner_id = $1 AND status != $2',
      [request.user.id, 'rejected']
    );
    
    const fileCount = parseInt(filesResult.rows[0].file_count, 10);
    
    return reply.code(200).send({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerified: user.email_verified,
        storageQuota: user.storage_quota_bytes,
        usedStorage,
        filesQuota: user.files_quota,
        fileCount,
      },
    });
  } catch (error) {
    logger.error('Get me error:', error);
    return reply.code(500).send({ error: 'Failed to get user information' });
  }
}
