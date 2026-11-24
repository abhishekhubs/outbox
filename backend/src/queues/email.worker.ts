import { Worker, Job } from 'bullmq';
import prisma from '../config/database';
import { createRedisConnection } from '../config/redis';
import { env } from '../config/env';
import { decrypt } from '../utils/encryption';
import { createEtherealTransport, sendEmail } from '../integrations/smtp/ethereal';
import { checkRateLimit, checkMinDelay, incrementSendCount } from '../services/rate-limit.service';
import { sendRateLimitNotification } from '../services/slack.service';
import { updateEmailStatusInES } from '../services/elasticsearch.service';
import { EMAIL_QUEUE_NAME, getEmailQueue } from './email.queue';
import type { EmailJobData } from '../types';
import logger from '../utils/logger';

let workerInstance: Worker<EmailJobData> | null = null;

/**
 * Process a single email job with full reliability, rate limiting, and minimum delay guarantees.
 */
export async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const { emailId } = job.data;
  logger.info(`[Worker] Processing email job`, { jobId: job.id, emailId });

  // 1. Fetch email record with sender and campaign
  const email = await prisma.scheduledEmail.findUnique({
    where: { id: emailId },
    include: {
      sender: true,
      campaign: true,
    },
  });

  if (!email) {
    logger.warn(`[Worker] Email ${emailId} not found in database, discarding job`);
    return;
  }

  // If already sent or cancelled, no-op
  if (email.status === 'sent') {
    logger.info(`[Worker] Email ${emailId} is already marked as sent. Skipping.`);
    return;
  }

  if (email.status === 'cancelled') {
    logger.info(`[Worker] Email ${emailId} has been cancelled. Skipping.`);
    return;
  }

  // 2. Atomic status transition: update to 'processing' only if currently 'scheduled' or 'retrying'
  const updateResult = await prisma.scheduledEmail.updateMany({
    where: {
      id: emailId,
      status: { in: ['scheduled', 'retrying'] },
    },
    data: {
      status: 'processing',
    },
  });

  if (updateResult.count === 0) {
    logger.warn(`[Worker] Email ${emailId} state conflict (already processing or modified). Skipping.`);
    return;
  }

  try {
    // 3. Distributed Hourly Rate Limiting check
    const rateLimit = await checkRateLimit(email.senderId, email.sender.hourlyLimit);
    if (!rateLimit.allowed) {
      logger.warn(`[Worker] Rate limit reached for sender ${email.sender.email}. Rescheduling email ${emailId}`);

      // Count pending emails for this sender
      const pendingCount = await prisma.scheduledEmail.count({
        where: {
          senderId: email.senderId,
          status: { in: ['scheduled', 'retrying', 'processing'] },
        },
      });

      // Notify connected Slack workspace (with automatic Redis deduplication)
      try {
        await sendRateLimitNotification(
          email.userId,
          email.sender.email,
          email.sender.hourlyLimit,
          pendingCount,
          rateLimit.resetAt
        );
      } catch (slackErr) {
        logger.error('[Worker] Failed to send Slack rate-limit notification', { error: slackErr });
      }

      // Reschedule into the next available sending window
      const newScheduledAt = rateLimit.resetAt;
      await prisma.scheduledEmail.update({
        where: { id: emailId },
        data: {
          status: 'scheduled',
          scheduledAt: newScheduledAt,
        },
      });

      // Calculate delay in ms
      const delayMs = Math.max(1000, newScheduledAt.getTime() - Date.now());
      const queue = getEmailQueue();
      await queue.add(
        'send-email',
        { emailId, attachments: job.data.attachments },
        {
          jobId: `email-${emailId}`,
          delay: delayMs,
          removeOnComplete: true,
          removeOnFail: false,
        }
      );

      return;
    }

    // 4. Minimum Delay Between Emails check (shared across workers/instances via Redis)
    const elapsedSinceLastSend = await checkMinDelay(email.senderId, email.sender.minimumSendDelay);
    if (elapsedSinceLastSend > 0 && elapsedSinceLastSend < email.sender.minimumSendDelay) {
      const waitMs = email.sender.minimumSendDelay - elapsedSinceLastSend;
      logger.debug(`[Worker] Min delay enforcement: delaying email ${emailId} by ${waitMs}ms`);

      await prisma.scheduledEmail.update({
        where: { id: emailId },
        data: { status: 'scheduled' },
      });

      const queue = getEmailQueue();
      await queue.add(
        'send-email',
        { emailId, attachments: job.data.attachments },
        {
          jobId: `email-${emailId}`,
          delay: waitMs,
          removeOnComplete: true,
          removeOnFail: false,
        }
      );

      return;
    }

    // 5. Decrypt SMTP credentials and initialize transport
    let smtpPass: string;
    try {
      smtpPass = decrypt(email.sender.encryptedSmtpPass);
    } catch {
      smtpPass = email.sender.encryptedSmtpPass;
    }

    const effectiveSmtpUser =
      email.sender.smtpUser && email.sender.smtpUser.includes('@ethereal.email')
        ? email.sender.smtpUser
        : env.ETHEREAL_USER;

    const effectiveSmtpPass =
      smtpPass && smtpPass !== 'testpass' && smtpPass !== 'ethereal_test_password'
        ? smtpPass
        : env.ETHEREAL_PASS;

    const transport = createEtherealTransport(
      effectiveSmtpUser,
      effectiveSmtpPass,
      email.sender.smtpHost,
      email.sender.smtpPort
    );

    // 6. Send the actual email via SMTP
    const fromEmail = env.ETHEREAL_USER || email.sender.email;
    const fromAddress = `"${email.sender.displayName || 'Outbox Delivery'}" <${fromEmail}>`;
    const sendResult = await sendEmail(transport, {
      from: fromAddress,
      to: email.recipient,
      subject: email.subject,
      body: email.body,
      attachments: job.data.attachments?.map((att) => ({
        filename: att.filename,
        content: Buffer.from(att.content, 'base64'),
        contentType: att.contentType,
      })),
    });

    // 7. Successful delivery - update PostgreSQL and increment sender counter
    const now = new Date();
    await prisma.$transaction([
      prisma.scheduledEmail.update({
        where: { id: emailId },
        data: {
          status: 'sent',
          sentAt: now,
          smtpMessageId: sendResult.messageId,
          etherealUrl: sendResult.etherealUrl,
          errorMessage: null,
        },
      }),
      prisma.emailCampaign.update({
        where: { id: email.campaignId },
        data: {
          sentCount: { increment: 1 },
        },
      }),
    ]);

    // Record the send in rate limiter
    await incrementSendCount(email.senderId);

    // 8. Update Elasticsearch (non-blocking: never fails the email if ES has issues)
    try {
      await updateEmailStatusInES(emailId, 'sent', now);
    } catch (esError) {
      logger.error(`[Worker] Failed to update Elasticsearch for sent email ${emailId}`, { error: esError });
    }

    logger.info(`[Worker] Email ${emailId} sent successfully to ${email.recipient}`, {
      messageId: sendResult.messageId,
      etherealUrl: sendResult.etherealUrl,
    });
  } catch (error: any) {
    logger.error(`[Worker] Error sending email ${emailId}: ${error.message}`, { error });

    const isLastAttempt = job.attemptsMade + 1 >= (job.opts.attempts || 3);

    if (isLastAttempt) {
      // Mark permanently failed
      await prisma.$transaction([
        prisma.scheduledEmail.update({
          where: { id: emailId },
          data: {
            status: 'failed',
            errorMessage: error.message || 'Unknown SMTP delivery error',
            retryCount: job.attemptsMade + 1,
          },
        }),
        prisma.emailCampaign.update({
          where: { id: email.campaignId },
          data: {
            failedCount: { increment: 1 },
          },
        }),
      ]);

      try {
        await updateEmailStatusInES(emailId, 'failed');
      } catch (esError) {
        logger.error(`[Worker] Failed to update Elasticsearch for failed email ${emailId}`, { error: esError });
      }
    } else {
      // Mark as retrying
      await prisma.scheduledEmail.update({
        where: { id: emailId },
        data: {
          status: 'retrying',
          errorMessage: error.message || 'Temporary delivery failure',
          retryCount: job.attemptsMade + 1,
        },
      });
    }

    // Re-throw so BullMQ initiates configured exponential backoff
    throw error;
  }
}

/**
 * Start the BullMQ Email Worker.
 */
export function startWorker(): Worker<EmailJobData> {
  if (workerInstance) {
    return workerInstance;
  }

  const connection = createRedisConnection('bullmq-worker');
  const concurrency = env.EMAIL_WORKER_CONCURRENCY;

  workerInstance = new Worker<EmailJobData>(
    EMAIL_QUEUE_NAME,
    processEmailJob,
    {
      connection,
      concurrency,
      lockDuration: 60000, // 60s
      stalledInterval: 30000,
      maxStalledCount: 2,
    }
  );

  workerInstance.on('completed', (job) => {
    logger.debug(`[Worker] Job ${job.id} completed successfully`);
  });

  workerInstance.on('failed', (job, err) => {
    logger.warn(`[Worker] Job ${job?.id} failed: ${err.message}`);
  });

  workerInstance.on('error', (err) => {
    logger.error(`[Worker] Fatal worker error: ${err.message}`, { error: err });
  });

  logger.info(`[Worker] BullMQ Email Worker started with concurrency = ${concurrency}`);
  return workerInstance;
}

/**
 * Graceful shutdown for BullMQ worker.
 */
export async function stopWorker(): Promise<void> {
  if (workerInstance) {
    logger.info('[Worker] Shutting down email worker gracefully...');
    await workerInstance.close();
    workerInstance = null;
    logger.info('[Worker] Email worker stopped');
  }
}
