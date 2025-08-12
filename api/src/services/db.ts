import { Pool, PoolClient } from 'pg';
import config from '../config';
import { logger } from '../utils/logger';

// Create a pool of PostgreSQL clients
const pool = new Pool({
  connectionString: config.database.url,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: 2000, // How long to wait for a connection to become available
});

// Test the connection on startup
pool.connect()
  .then((client) => {
    logger.info('Connected to PostgreSQL database');
    client.release();
  })
  .catch((err) => {
    logger.error('Error connecting to PostgreSQL database:', err);
    process.exit(1);
  });

// Handle pool errors
pool.on('error', (err) => {
  logger.error('PostgreSQL pool error:', err);
});

// Export database query function
export async function query(text: string, params: any[] = []) {
  const start = Date.now();
  
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    logger.debug({
      query: text,
      params,
      rowCount: result.rowCount,
      duration,
    });
    
    return result;
  } catch (error) {
    logger.error({
      query: text,
      params,
      error,
    });
    throw error;
  }
}

// Get client from the pool for transactions
export async function getClient(): Promise<PoolClient> {
  const client = await pool.connect();
  const originalQuery = client.query.bind(client);
  
  // Add logging to client queries
  client.query = async (text, params) => {
    const start = Date.now();
    
    try {
      const result = await originalQuery(text, params);
      const duration = Date.now() - start;
      
      logger.debug({
        query: text,
        params,
        rowCount: result.rowCount,
        duration,
      });
      
      return result;
    } catch (error) {
      logger.error({
        query: text,
        params,
        error,
      });
      throw error;
    }
  };
  
  return client;
}

// Graceful shutdown
export async function closePool() {
  await pool.end();
  logger.info('Database pool has been closed');
}
