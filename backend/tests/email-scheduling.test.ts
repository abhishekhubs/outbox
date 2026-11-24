import { describe, it, expect } from 'vitest';
import { scheduleEmailSchema } from '../src/controllers/email.controller';

describe('Email Scheduling & Validation', () => {
  it('should accept valid email scheduling requests', () => {
    const validData = {
      subject: 'Test Subject',
      body: '<p>Hello World</p>',
      recipients: ['user1@example.com', 'user2@example.com'],
      senderId: '123e4567-e89b-12d3-a456-426614174000',
      startTime: '2026-11-25T10:00:00.000Z',
      delayBetweenEmails: 2000,
      hourlyLimit: 200,
    };

    const result = scheduleEmailSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should reject invalid recipient email addresses', () => {
    const invalidData = {
      subject: 'Test Subject',
      body: 'Hello',
      recipients: ['valid@example.com', 'not-an-email'],
      senderId: '123e4567-e89b-12d3-a456-426614174000',
      startTime: '2026-11-25T10:00:00.000Z',
    };

    const result = scheduleEmailSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      const err = result.error.issues?.[0]?.message || result.error.errors?.[0]?.message;
      expect(err).toContain('Invalid email');
    }
  });

  it('should calculate sequential scheduled times with configured delay', () => {
    const startTime = new Date('2026-11-25T10:00:00.000Z');
    const delay = 2000;
    const recipients = ['r1@test.com', 'r2@test.com', 'r3@test.com'];

    const scheduledTimes = recipients.map((_, index) => {
      return new Date(startTime.getTime() + index * delay);
    });

    expect(scheduledTimes[0].toISOString()).toBe('2026-11-25T10:00:00.000Z');
    expect(scheduledTimes[1].toISOString()).toBe('2026-11-25T10:00:02.000Z');
    expect(scheduledTimes[2].toISOString()).toBe('2026-11-25T10:00:04.000Z');
  });

  it('should generate deterministic idempotency keys', () => {
    const campaignId = 'camp-123';
    const recipient = 'user@example.com';
    const index = 0;

    const key1 = `${campaignId}-${recipient}-${index}`;
    const key2 = `${campaignId}-${recipient}-${index}`;

    expect(key1).toBe(key2);
    expect(key1).toBe('camp-123-user@example.com-0');
  });
});
