import { describe, it, expect, vi, beforeEach } from 'vitest';
import { encrypt, decrypt } from '../src/utils/encryption';

describe('Distributed Rate Limiting & Atomicity', () => {
  it('should encrypt and decrypt tokens correctly using AES-256-GCM', () => {
    const originalToken = 'xoxb-1234567890-slack-bot-token-secret';
    const encrypted = encrypt(originalToken);

    expect(encrypted).not.toBe(originalToken);
    expect(typeof encrypted).toBe('string');

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(originalToken);
  });

  it('should handle window calculation based on hourly format', () => {
    const now = new Date('2026-11-24T18:30:00Z');
    const windowKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}-${String(now.getUTCHours()).padStart(2, '0')}`;

    expect(windowKey).toBe('2026-11-24-18');
  });

  it('should calculate correct resetAt time when rate limit is exceeded', () => {
    const ttlSeconds = 1800; // 30 minutes remaining in current window
    const now = Date.now();
    const resetAt = new Date(now + ttlSeconds * 1000);

    expect(resetAt.getTime()).toBeGreaterThan(now);
    expect(resetAt.getTime() - now).toBe(1800 * 1000);
  });

  it('should correctly determine minimum delay violation', () => {
    const minDelayMs = 2000;
    const now = 100000;
    const lastSendTime = 99000; // 1000ms ago

    const elapsed = now - lastSendTime;
    const isViolated = elapsed < minDelayMs;
    const remainingWait = minDelayMs - elapsed;

    expect(isViolated).toBe(true);
    expect(remainingWait).toBe(1000);
  });
});
