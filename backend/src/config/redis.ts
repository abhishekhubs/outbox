import Redis from 'ioredis';
import logger from '../utils/logger';
import { env } from './env';

function createRedisOptions() {
  return {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
    retryStrategy(times: number) {
      const delay = Math.min(times * 200, 5000);
      logger.warn(`Redis reconnecting in ${delay}ms (attempt ${times})`);
      return delay;
    },
    reconnectOnError(err: Error) {
      const targetErrors = ['READONLY', 'ECONNRESET', 'ECONNREFUSED'];
      return targetErrors.some((e) => err.message.includes(e));
    },
  };
}

function attachListeners(redis: Redis, label: string): void {
  redis.on('connect', () => {
    logger.info(`Redis [${label}] connected`);
  });

  redis.on('ready', () => {
    logger.info(`Redis [${label}] ready`);
  });

  redis.on('error', (err: Error) => {
    logger.error(`Redis [${label}] error: ${err.message}`);
  });

  redis.on('close', () => {
    logger.warn(`Redis [${label}] connection closed`);
  });

  redis.on('reconnecting', () => {
    logger.info(`Redis [${label}] reconnecting...`);
  });
}

/**
 * Factory: create a new Redis connection with event listeners.
 */
export function createRedisConnection(label = 'default'): Redis {
  let redis: Redis;

  if (env.REDIS_URL) {
    redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      retryStrategy(times: number) {
        const delay = Math.min(times * 200, 5000);
        return delay;
      },
    });
  } else {
    redis = new Redis(createRedisOptions());
  }

  attachListeners(redis, label);
  return redis;
}

/**
 * Singleton Redis connection for general use (caching, rate limiting, etc.)
 */
let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (!_redis) {
    _redis = createRedisConnection('singleton');
  }
  return _redis;
}

export async function disconnectRedis(): Promise<void> {
  if (_redis) {
    await _redis.quit();
    _redis = null;
    logger.info('Redis singleton disconnected');
  }
}

export default getRedis;
