import nodemailer, { Transporter } from 'nodemailer';
import type Mail from 'nodemailer/lib/mailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import logger from '../../utils/logger';
import { env } from '../../config/env';

export interface SendEmailParams {
  from: string;
  to: string;
  subject: string;
  body: string;
  attachments?: Array<{
    filename: string;
    content?: string | Buffer;
    path?: string;
    contentType?: string;
  }>;
}

export interface SendEmailResponse {
  messageId: string;
  etherealUrl: string | null;
}

/**
 * Create a Nodemailer transport configured for Ethereal SMTP.
 */
export function createEtherealTransport(
  smtpUser?: string,
  smtpPass?: string,
  smtpHost?: string,
  smtpPort?: number
): Transporter {
  const user = smtpUser && smtpUser.includes('@ethereal.email') ? smtpUser : env.ETHEREAL_USER;
  const pass =
    smtpPass && smtpPass !== 'testpass' && smtpPass !== 'ethereal_test_password'
      ? smtpPass
      : env.ETHEREAL_PASS;

  const transport = nodemailer.createTransport({
    host: smtpHost || env.ETHEREAL_HOST || 'smtp.ethereal.email',
    port: smtpPort || env.ETHEREAL_PORT || 587,
    secure: false,
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  return transport;
}

/**
 * Send an email via the given transport.
 */
export async function sendEmail(
  transport: Transporter,
  params: SendEmailParams
): Promise<SendEmailResponse> {
  const mailOptions: Mail.Options = {
    from: params.from,
    to: params.to,
    subject: params.subject,
    html: params.body,
    text: params.body.replace(/<[^>]*>/g, ''),
    attachments: params.attachments,
  };

  const info = await transport.sendMail(mailOptions);
  const messageId = info.messageId;
  const etherealUrl = getEtherealPreviewUrl(info) || null;

  logger.info(`Email sent to ${params.to}`, { messageId, etherealUrl });

  return { messageId, etherealUrl };
}

/**
 * Generate Ethereal preview URL from message info.
 */
export function getEtherealPreviewUrl(info: any): string | null {
  try {
    const url = nodemailer.getTestMessageUrl(info);
    return url ? String(url) : null;
  } catch {
    return null;
  }
}

/**
 * Verify that the SMTP transport connection works.
 */
export async function verifyTransport(
  transport: Transporter
): Promise<boolean> {
  try {
    await transport.verify();
    logger.info('SMTP transport verified');
    return true;
  } catch (error) {
    logger.error('SMTP transport verification failed', { error });
    return false;
  }
}
