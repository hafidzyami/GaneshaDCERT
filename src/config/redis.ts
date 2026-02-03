import Redis, { RedisOptions } from 'ioredis';
import { env } from './env';
import logger from './logger';

/**
 * Redis Configuration
 * Manages Redis connection with automatic reconnection and error handling
 */

/**
 * Build Redis options from environment variables
 */
function buildRedisOptions(): RedisOptions {
  // If REDIS_URL is provided, parse it
  if (env.REDIS_URL) {
    return {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        if (times > 10) {
          logger.error('[Redis] Max retry attempts reached, giving up');
          return null;
        }
        const delay = Math.min(times * 100, 3000);
        logger.warn(`[Redis] Retry attempt ${times}, next retry in ${delay}ms`);
        return delay;
      },
      reconnectOnError: (err) => {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          return true;
        }
        return false;
      },
    };
  }

  // Otherwise use individual config
  return {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => {
      if (times > 10) {
        logger.error('[Redis] Max retry attempts reached, giving up');
        return null;
      }
      const delay = Math.min(times * 100, 3000);
      logger.warn(`[Redis] Retry attempt ${times}, next retry in ${delay}ms`);
      return delay;
    },
    reconnectOnError: (err) => {
      const targetError = 'READONLY';
      if (err.message.includes(targetError)) {
        return true;
      }
      return false;
    },
  };
}

/**
 * Create Redis client instance
 */
function createRedisClient(): Redis {
  const options = buildRedisOptions();

  let client: Redis;

  if (env.REDIS_URL) {
    client = new Redis(env.REDIS_URL, options);
  } else {
    client = new Redis(options);
  }

  // Event handlers
  client.on('connect', () => {
    logger.info('[Redis] Connecting to Redis server...');
  });

  client.on('ready', () => {
    logger.success('[Redis] Connected and ready');
  });

  client.on('error', (err) => {
    logger.error('[Redis] Connection error:', err);
  });

  client.on('close', () => {
    logger.warn('[Redis] Connection closed');
  });

  client.on('reconnecting', () => {
    logger.info('[Redis] Reconnecting...');
  });

  return client;
}

// Create singleton Redis client
const redisClient = createRedisClient();

/**
 * Connect to Redis
 * Call this during application startup
 */
export async function connectRedis(): Promise<void> {
  try {
    await redisClient.connect();
  } catch (error) {
    // If already connected, ignore
    if ((error as Error).message?.includes('already')) {
      return;
    }
    throw error;
  }
}

/**
 * Disconnect from Redis
 * Call this during application shutdown
 */
export async function disconnectRedis(): Promise<void> {
  try {
    await redisClient.quit();
    logger.info('[Redis] Disconnected');
  } catch (error) {
    logger.error('[Redis] Error during disconnect:', error);
  }
}

/**
 * Check Redis connection health
 */
export async function isRedisHealthy(): Promise<boolean> {
  try {
    const pong = await redisClient.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}

export default redisClient;
export { redisClient };
