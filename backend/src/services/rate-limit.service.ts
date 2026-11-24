import { getRedis } from '../config/redis';
import { env } from '../config/env';
import type { RateLimitResult } from '../types';
import logger from '../utils/logger';

/**
 * Lua script for atomic check-and-increment rate limiting.
 * Returns [allowed(1|0), currentCount, ttlSeconds]
 */
const RATE_LIMIT_LUA = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local windowSec = tonumber(ARGV[2])
local current = tonumber(redis.call('GET', key) or '0')
if current >= limit then
  return {0, current, tonumber(redis.call('TTL', key))}
end
local newCount = redis.call('INCR', key)
if newCount == 1 then
  redis.call('EXPIRE', key, windowSec)
end
return {1, newCount, tonumber(redis.call('TTL', key))}
`;

/**
 * Lua script for minimum delay enforcement.
 * Returns 0 if allowed, or elapsed time since last send if too soon.
 */
const MIN_DELAY_LUA = `
local key = KEYS[1]
local minDelay = tonumber(ARGV[1])
local now = tonumber(ARGV[2])
local lastSend = tonumber(redis.call('GET', key) or '0')
if now - lastSend < minDelay then
  return now - lastSend
end
redis.call('SET', key, now, 'PX', minDelay * 2)
return 0
`;

/**
 * Get the current window key based on the hour.
 */
function getWindowKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}-${String(now.getUTCHours()).padStart(2, '0')}`;
}

/**
 * Check if a sender is within their rate limit.
 * Uses atomic Lua script for check-and-increment.
 */
export async function checkRateLimit(
  senderId: string,
  limit?: number
): Promise<RateLimitResult> {
  const redis = getRedis();
  const windowKey = getWindowKey();
  const redisKey = `rate:${senderId}:${windowKey}`;
  const maxPerHour = limit || env.MAX_EMAILS_PER_HOUR_PER_SENDER;
  const windowSec = env.RATE_LIMIT_WINDOW_SECONDS;

  try {
    const result = (await redis.eval(
      RATE_LIMIT_LUA,
      1,
      redisKey,
      maxPerHour.toString(),
      windowSec.toString()
    )) as [number, number, number];

    const [allowed, currentCount, ttl] = result;
    const resetAt = new Date(Date.now() + (ttl > 0 ? ttl * 1000 : windowSec * 1000));

    return {
      allowed: allowed === 1,
      remaining: Math.max(0, maxPerHour - currentCount),
      resetAt,
      currentCount,
    };
  } catch (error) {
    logger.error('Rate limit check failed, allowing by default', { senderId, error });
    return {
      allowed: true,
      remaining: maxPerHour,
      resetAt: new Date(Date.now() + env.RATE_LIMIT_WINDOW_SECONDS * 1000),
      currentCount: 0,
    };
  }
}

/**
 * Atomically increment the send count for a sender.
 */
export async function incrementSendCount(senderId: string): Promise<number> {
  const redis = getRedis();
  const windowKey = getWindowKey();
  const redisKey = `rate:${senderId}:${windowKey}`;

  const count = await redis.incr(redisKey);
  if (count === 1) {
    await redis.expire(redisKey, env.RATE_LIMIT_WINDOW_SECONDS);
  }
  return count;
}

/**
 * Get current rate limit info without incrementing.
 */
export async function getRateLimitInfo(
  senderId: string,
  limit?: number
): Promise<RateLimitResult> {
  const redis = getRedis();
  const windowKey = getWindowKey();
  const redisKey = `rate:${senderId}:${windowKey}`;
  const maxPerHour = limit || env.MAX_EMAILS_PER_HOUR_PER_SENDER;

  const [current, ttl] = await Promise.all([
    redis.get(redisKey),
    redis.ttl(redisKey),
  ]);

  const currentCount = parseInt(current || '0', 10);
  const resetAt = new Date(Date.now() + (ttl > 0 ? ttl * 1000 : env.RATE_LIMIT_WINDOW_SECONDS * 1000));

  return {
    allowed: currentCount < maxPerHour,
    remaining: Math.max(0, maxPerHour - currentCount),
    resetAt,
    currentCount,
  };
}

/**
 * Check minimum delay between emails for a sender.
 * Returns 0 if allowed, otherwise the elapsed time in ms.
 */
export async function checkMinDelay(senderId: string, minDelayMs?: number): Promise<number> {
  const redis = getRedis();
  const key = `delay:${senderId}`;
  const minDelay = minDelayMs || env.MIN_EMAIL_DELAY_MS;
  const now = Date.now();

  try {
    const result = (await redis.eval(
      MIN_DELAY_LUA,
      1,
      key,
      minDelay.toString(),
      now.toString()
    )) as number;

    return result;
  } catch (error) {
    logger.error('Min delay check failed, allowing by default', { senderId, error });
    return 0;
  }
}

export { getWindowKey };
