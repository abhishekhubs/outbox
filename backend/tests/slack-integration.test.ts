import { describe, it, expect, vi } from 'vitest';
import { buildSlackAuthUrl } from '../src/integrations/slack/oauth';

describe('Slack OAuth & Notifications', () => {
  it('should construct correct Slack OAuth URL with required scopes', () => {
    const state = 'test-oauth-state-123';
    const url = buildSlackAuthUrl(state);

    expect(url).toContain('https://slack.com/oauth/v2/authorize');
    expect(url).toContain('state=test-oauth-state-123');
    expect(url).toContain('scope=');
    expect(url).toContain('chat%3Awrite');
  });

  it('should generate correct Redis deduplication key for rate-limit notifications', () => {
    const senderEmail = 'sender@example.com';
    const windowKey = '2026-11-24-18';
    const dedupKey = `slack:notif:${senderEmail}:${windowKey}`;

    expect(dedupKey).toBe('slack:notif:sender@example.com:2026-11-24-18');
  });

  it('should format rate-limit alert message blocks correctly', () => {
    const senderEmail = 'sender@reachinbox.test';
    const hourlyLimit = 200;
    const pendingCount = 85;
    const nextWindow = new Date('2026-11-24T19:00:00.000Z');

    const expectedText = `⚠️ *Rate Limit Reached* for \`${senderEmail}\``;
    expect(expectedText).toContain(senderEmail);
    expect(expectedText).toContain('Rate Limit Reached');
  });
});
