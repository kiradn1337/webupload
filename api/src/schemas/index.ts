import { z } from 'zod';

// Authentication schemas
export const registerSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(100, 'Password must be less than 100 characters'),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
  }),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
  }),
});

// File upload schemas
export const initiateUploadSchema = z.object({
  body: z.object({
    fileName: z.string().min(1, 'File name is required').max(255, 'File name too long'),
    fileSize: z.number().int().positive('File size must be positive'),
    contentType: z.string().min(1, 'Content type is required'),
  }),
});

export const completeUploadSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid file ID'),
  }),
});

export const fileIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid file ID'),
  }),
});

export const createShareSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid file ID'),
  }),
  body: z.object({
    expiresInMinutes: z
      .number()
      .int()
      .min(1, 'Expiry must be at least 1 minute')
      .max(10080, 'Expiry must be at most 7 days')
      .optional()
      .default(15),
    oneTimeUse: z.boolean().optional().default(false),
  }),
});

export const getShareSchema = z.object({
  params: z.object({
    token: z.string().min(1, 'Share token is required'),
  }),
});

// Admin schemas
export const adminListFilesSchema = z.object({
  querystring: z.object({
    status: z
      .enum(['pending', 'scanning', 'clean', 'quarantined', 'rejected'])
      .optional(),
    page: z.string().optional().transform(val => (val ? parseInt(val, 10) : 1)),
    pageSize: z.string().optional().transform(val => (val ? parseInt(val, 10) : 20)),
  }),
});

export const adminFileActionSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid file ID'),
  }),
  body: z.object({
    action: z.enum(['allow', 'delete']),
  }),
});

export const adminListUsersSchema = z.object({
  querystring: z.object({
    page: z.string().optional().transform(val => (val ? parseInt(val, 10) : 1)),
    pageSize: z.string().optional().transform(val => (val ? parseInt(val, 10) : 20)),
  }),
});

export const adminListAuditLogsSchema = z.object({
  querystring: z.object({
    userId: z.string().uuid('Invalid user ID').optional(),
    action: z.string().optional(),
    targetType: z.string().optional(),
    targetId: z.string().optional(),
    startDate: z.string().optional().transform(val => (val ? new Date(val) : undefined)),
    endDate: z.string().optional().transform(val => (val ? new Date(val) : undefined)),
    page: z.string().optional().transform(val => (val ? parseInt(val, 10) : 1)),
    pageSize: z.string().optional().transform(val => (val ? parseInt(val, 10) : 20)),
  }),
});
