import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { query } from './db';
import { logger } from '../utils/logger';
import { auditLog } from './audit';

/**
 * User type
 */
export interface User {
  id: string;
  email: string;
  role: 'user' | 'admin';
  email_verified: boolean;
  totp_enabled: boolean;
  storage_quota_bytes: number;
  files_quota: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * Register a new user
 */
export async function registerUser(email: string, password: string): Promise<User> {
  // Hash password with Argon2id
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  try {
    // Insert new user into database
    const result = await query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, role, email_verified, totp_enabled, storage_quota_bytes, files_quota, created_at, updated_at',
      [email.toLowerCase(), passwordHash]
    );

    const user = result.rows[0];

    // Log registration
    await auditLog(
      user.id,
      'USER_REGISTERED',
      'user',
      user.id,
      { email: user.email }
    );

    return user;
  } catch (error: any) {
    logger.error('Error registering user:', error);

    // Handle duplicate email
    if (error.code === '23505') { // PostgreSQL unique violation code
      throw new Error('Email already in use');
    }

    throw new Error('Failed to register user');
  }
}

/**
 * Verify user credentials
 */
export async function verifyCredentials(email: string, password: string): Promise<User | null> {
  // Get user from database
  const result = await query(
    'SELECT id, email, password_hash, role, email_verified, totp_enabled, storage_quota_bytes, files_quota, created_at, updated_at FROM users WHERE email = $1',
    [email.toLowerCase()]
  );

  // User not found
  if (result.rowCount === 0) {
    return null;
  }

  const user = result.rows[0];

  // Verify password
  try {
    const passwordValid = await argon2.verify(user.password_hash, password);
    if (!passwordValid) {
      return null;
    }
  } catch (error) {
    logger.error('Error verifying password:', error);
    return null;
  }

  // Log login attempt
  await auditLog(
    user.id,
    'USER_LOGIN',
    'user',
    user.id,
    { email: user.email }
  );

  // Return user without password_hash
  const { password_hash, ...userWithoutPassword } = user;
  return userWithoutPassword as User;
}

/**
 * Get user by ID
 */
export async function getUserById(id: string): Promise<User | null> {
  const result = await query(
    'SELECT id, email, role, email_verified, totp_enabled, storage_quota_bytes, files_quota, created_at, updated_at FROM users WHERE id = $1',
    [id]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return result.rows[0] as User;
}

/**
 * Create refresh token
 */
export async function createRefreshToken(userId: string): Promise<string> {
  // Generate a random token
  const token = randomUUID();

  // Store token in database
  await query(
    'INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES ($1, $2, NOW() + interval \'7 days\')',
    [token, userId]
  );

  return token;
}

/**
 * Verify refresh token
 */
export async function verifyRefreshToken(token: string): Promise<string | null> {
  // Get token from database
  const result = await query(
    'SELECT user_id FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()',
    [token]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return result.rows[0].user_id;
}

/**
 * Invalidate refresh token
 */
export async function invalidateRefreshToken(token: string): Promise<void> {
  await query('DELETE FROM refresh_tokens WHERE token = $1', [token]);
}

/**
 * Invalidate all refresh tokens for a user
 */
export async function invalidateAllRefreshTokens(userId: string): Promise<void> {
  await query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
}
