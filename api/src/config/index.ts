import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

interface Config {
  server: {
    port: number;
    host: string;
    nodeEnv: string;
    logLevel: string;
  };
  database: {
    url: string;
  };
  redis: {
    url: string;
  };
  s3: {
    endpoint: string;
    accessKey: string;
    secretKey: string;
    bucket: string;
    region: string;
    forcePathStyle: boolean;
  };
  auth: {
    jwtSecret: string;
    refreshTokenSecret: string;
    jwtExpiresIn: string;
    refreshTokenExpiresIn: string;
    passwordSaltRounds: number;
  };
  security: {
    corsOrigin: string;
    requireEmailVerification: boolean;
    enable2fa: boolean;
  };
  fileUpload: {
    maxSize: number;
    thumbnailMaxWidth: number;
    thumbnailMaxHeight: number;
    presignedUrlExpiry: number;
    enableFileDeduplication: boolean;
  };
  rateLimiting: {
    window: number;
    max: number;
    authWindow: number;
    authMax: number;
  };
  antivirus: {
    host: string;
    port: number;
  };
}

// Default configuration
const config: Config = {
  server: {
    port: parseInt(process.env.PORT || '8000', 10),
    host: process.env.HOST || '0.0.0.0',
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
  },
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/webupload',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  s3: {
    endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
    accessKey: process.env.S3_ACCESS_KEY || 'minio',
    secretKey: process.env.S3_SECRET_KEY || 'minio123',
    bucket: process.env.S3_BUCKET || 'webupload',
    region: process.env.S3_REGION || 'us-east-1',
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'development_jwt_secret_change_in_production',
    refreshTokenSecret:
      process.env.REFRESH_TOKEN_SECRET || 'development_refresh_token_secret_change_in_production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
    passwordSaltRounds: parseInt(process.env.PASSWORD_SALT_ROUNDS || '10', 10),
  },
  security: {
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION === 'true',
    enable2fa: process.env.ENABLE_2FA === 'true',
  },
  fileUpload: {
    maxSize: parseInt(process.env.FILE_UPLOAD_MAX_SIZE || '104857600', 10), // 100MB default
    thumbnailMaxWidth: parseInt(process.env.THUMBNAIL_MAX_WIDTH || '300', 10),
    thumbnailMaxHeight: parseInt(process.env.THUMBNAIL_MAX_HEIGHT || '300', 10),
    presignedUrlExpiry: parseInt(process.env.PRESIGNED_URL_EXPIRY || '900', 10), // 15 minutes
    enableFileDeduplication: process.env.ENABLE_FILE_DEDUPLICATION === 'true',
  },
  rateLimiting: {
    window: parseInt(process.env.RATE_LIMIT_WINDOW || '60000', 10), // 1 minute
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10), // 100 requests per window
    authWindow: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW || '60000', 10), // 1 minute
    authMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '10', 10), // 10 auth requests per window
  },
  antivirus: {
    host: process.env.CLAMAV_HOST || 'localhost',
    port: parseInt(process.env.CLAMAV_PORT || '3310', 10),
  },
};

export default config;
