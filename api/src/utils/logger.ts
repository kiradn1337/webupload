import pino from 'pino';
import config from '../config';

// Create logger instance
export const logger = pino({
  level: config.server.logLevel,
  transport: config.server.nodeEnv === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  } : undefined,
  redact: {
    paths: ['req.headers.authorization', '*.password', '*.passwordHash', '*.secret*', '*.cookie'],
    remove: true,
  },
});
