import { query } from './db';
import { logger } from '../utils/logger';

/**
 * Create an audit log entry
 */
export async function auditLog(
  userId: string | null,
  action: string,
  targetType: string,
  targetId: string | null,
  metadata: Record<string, any> = {},
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  try {
    await query(
      'INSERT INTO audit_logs (user_id, action, target_type, target_id, ip_address, user_agent, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [userId, action, targetType, targetId, ipAddress, userAgent, JSON.stringify(metadata)]
    );
  } catch (error) {
    // Log the error but don't throw it - audit log should not break functionality
    logger.error('Failed to create audit log entry:', error);
  }
}

/**
 * Get audit logs
 */
export async function getAuditLogs(
  limit: number = 100,
  offset: number = 0,
  userId?: string,
  action?: string,
  targetType?: string,
  targetId?: string,
  startDate?: Date,
  endDate?: Date
) {
  try {
    // Build query conditions
    const conditions = [];
    const params: any[] = [];

    if (userId) {
      params.push(userId);
      conditions.push(`user_id = $${params.length}`);
    }

    if (action) {
      params.push(action);
      conditions.push(`action = $${params.length}`);
    }

    if (targetType) {
      params.push(targetType);
      conditions.push(`target_type = $${params.length}`);
    }

    if (targetId) {
      params.push(targetId);
      conditions.push(`target_id = $${params.length}`);
    }

    if (startDate) {
      params.push(startDate);
      conditions.push(`created_at >= $${params.length}`);
    }

    if (endDate) {
      params.push(endDate);
      conditions.push(`created_at <= $${params.length}`);
    }

    // Build WHERE clause
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Add pagination parameters
    params.push(limit);
    params.push(offset);

    // Execute query
    const result = await query(
      `SELECT * FROM audit_logs ${whereClause} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    // Get total count for pagination
    const countResult = await query(
      `SELECT COUNT(*) FROM audit_logs ${whereClause}`,
      params.slice(0, params.length - 2)
    );

    return {
      logs: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit,
      offset,
    };
  } catch (error) {
    logger.error('Failed to get audit logs:', error);
    throw new Error('Failed to get audit logs');
  }
}
