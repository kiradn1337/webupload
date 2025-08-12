import { FastifyRequest, FastifyReply } from 'fastify';
import { getFileById, deleteFile } from '../services/fileManager';
import { getAuditLogs } from '../services/audit';
import { query } from '../services/db';
import { logger } from '../utils/logger';

/**
 * List files for admin
 */
export async function adminListFilesHandler(
  request: FastifyRequest<{
    Querystring: {
      status?: string;
      page?: number;
      pageSize?: number;
    };
  }>,
  reply: FastifyReply
) {
  const { status, page = 1, pageSize = 20 } = request.query;

  try {
    // Build query based on status filter
    let queryText = 'SELECT f.*, u.email as owner_email FROM files f JOIN users u ON f.owner_id = u.id';
    const queryParams: any[] = [];
    
    if (status) {
      queryText += ' WHERE f.status = $1';
      queryParams.push(status);
    }
    
    queryText += ' ORDER BY f.created_at DESC LIMIT $' + (queryParams.length + 1) + ' OFFSET $' + (queryParams.length + 2);
    queryParams.push(pageSize, (page - 1) * pageSize);
    
    // Get files
    const result = await query(queryText, queryParams);
    
    // Get total count for pagination
    let countQueryText = 'SELECT COUNT(*) FROM files';
    const countParams: any[] = [];
    
    if (status) {
      countQueryText += ' WHERE status = $1';
      countParams.push(status);
    }
    
    const countResult = await query(countQueryText, countParams);
    const total = parseInt(countResult.rows[0].count, 10);
    
    return reply.code(200).send({
      files: result.rows,
      total,
      page,
      pageSize,
    });
  } catch (error) {
    logger.error('Admin list files error:', error);
    return reply.code(500).send({ error: 'Failed to list files' });
  }
}

/**
 * Admin action on file (allow or delete)
 */
export async function adminFileActionHandler(
  request: FastifyRequest<{
    Params: { id: string };
    Body: { action: 'allow' | 'delete' };
  }>,
  reply: FastifyReply
) {
  const { id } = request.params;
  const { action } = request.body;
  const adminId = request.user.id;

  try {
    // Get file details
    const file = await getFileById(id);
    
    if (!file) {
      return reply.code(404).send({ error: 'File not found' });
    }
    
    if (action === 'allow') {
      // Update file status to clean
      await query(
        'UPDATE files SET status = $1, reason = NULL, updated_at = NOW() WHERE id = $2',
        ['clean', id]
      );
      
      return reply.code(200).send({ success: true });
    } else if (action === 'delete') {
      // Delete the file
      await deleteFile(id, adminId, true);
      return reply.code(200).send({ success: true });
    } else {
      return reply.code(400).send({ error: 'Invalid action' });
    }
  } catch (error) {
    logger.error(`Admin file action error for ${id}:`, error);
    return reply.code(500).send({ error: 'Failed to perform action on file' });
  }
}

/**
 * List users for admin
 */
export async function adminListUsersHandler(
  request: FastifyRequest<{
    Querystring: {
      page?: number;
      pageSize?: number;
    };
  }>,
  reply: FastifyReply
) {
  const { page = 1, pageSize = 20 } = request.query;

  try {
    // Get users with basic stats
    const result = await query(
      `SELECT 
        u.id, 
        u.email, 
        u.role, 
        u.email_verified, 
        u.storage_quota_bytes, 
        u.files_quota, 
        u.created_at,
        COUNT(f.id) as file_count,
        COALESCE(SUM(f.size_bytes), 0) as used_storage
      FROM 
        users u
      LEFT JOIN 
        files f ON u.id = f.owner_id AND f.status != 'rejected'
      GROUP BY 
        u.id
      ORDER BY 
        u.created_at DESC
      LIMIT $1 OFFSET $2`,
      [pageSize, (page - 1) * pageSize]
    );
    
    // Get total count for pagination
    const countResult = await query('SELECT COUNT(*) FROM users');
    const total = parseInt(countResult.rows[0].count, 10);
    
    return reply.code(200).send({
      users: result.rows,
      total,
      page,
      pageSize,
    });
  } catch (error) {
    logger.error('Admin list users error:', error);
    return reply.code(500).send({ error: 'Failed to list users' });
  }
}

/**
 * Get audit logs for admin
 */
export async function adminGetAuditLogsHandler(
  request: FastifyRequest<{
    Querystring: {
      userId?: string;
      action?: string;
      targetType?: string;
      targetId?: string;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      pageSize?: number;
    };
  }>,
  reply: FastifyReply
) {
  const {
    userId,
    action,
    targetType,
    targetId,
    startDate,
    endDate,
    page = 1,
    pageSize = 20,
  } = request.query;

  try {
    const result = await getAuditLogs(
      pageSize,
      (page - 1) * pageSize,
      userId,
      action,
      targetType,
      targetId,
      startDate,
      endDate
    );
    
    return reply.code(200).send(result);
  } catch (error) {
    logger.error('Admin audit logs error:', error);
    return reply.code(500).send({ error: 'Failed to get audit logs' });
  }
}
