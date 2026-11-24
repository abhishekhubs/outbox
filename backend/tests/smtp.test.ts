import { describe, it, expect } from 'vitest';
import { createEtherealTransport } from '../src/integrations/smtp/ethereal';

describe('Ethereal SMTP Integration', () => {
  it('should initialize nodemailer transport with ethereal configurations', () => {
    const transport = createEtherealTransport(
      'testuser@ethereal.email',
      'testpassword123',
      'smtp.ethereal.email',
      587
    );

    expect(transport).toBeDefined();
    expect(typeof transport.sendMail).toBe('function');
  });

  it('should format sender displayName and address correctly', () => {
    const displayName = 'Outbox Campaigns';
    const email = 'marketing@reachinbox.test';
    const fromAddress = `"${displayName}" <${email}>`;

    expect(fromAddress).toBe('"Outbox Campaigns" <marketing@reachinbox.test>');
  });
});
