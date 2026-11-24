import { randomUUID as uuidv4 } from 'crypto';
import prisma from '../config/database';
import { addEmailJob, removeJob } from './scheduler.service';
import { getEmailQueue } from './scheduler.service';
import logger from '../utils/logger';
import type { ScheduleEmailsParams, EmailFilters, SentEmailFilters, PaginatedResult } from '../types';
import type { ScheduledEmail, EmailCampaign } from '@prisma/client';

/**
 * Schedule emails for a campaign. Creates campaign, email records, and BullMQ jobs in a transaction.
 */
export async function scheduleEmails(
  params: ScheduleEmailsParams
): Promise<{ campaign: EmailCampaign; emailCount: number }> {
  const {
    subject,
    body,
    recipients,
    recipientParams,
    attachments,
    senderId,
    startTime,
    delayBetweenEmails,
    hourlyLimit,
    userId,
  } = params;

  const startDate = new Date(startTime);

  // Verify sender belongs to user (or fallback to any sender belonging to user)
  let sender = await prisma.sender.findFirst({
    where: { id: senderId, userId },
  });

  if (!sender) {
    sender = await prisma.sender.findFirst({
      where: { userId },
    });
  }

  if (!sender) {
    const { encrypt } = await import('../utils/encryption');
    const { env } = await import('../config/env');
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const userEmail = user?.email || 'sender@reachinbox.test';
    const userName = user?.name || 'Sender';

    sender = await prisma.sender.create({
      data: {
        userId,
        email: userEmail,
        displayName: userName,
        smtpHost: env.ETHEREAL_HOST,
        smtpPort: env.ETHEREAL_PORT,
        smtpUser: env.ETHEREAL_USER || userEmail,
        encryptedSmtpPass: encrypt(env.ETHEREAL_PASS || 'testpass'),
        hourlyLimit: env.MAX_EMAILS_PER_HOUR_PER_SENDER,
        minimumSendDelay: env.MIN_EMAIL_DELAY_MS,
      },
    });
  }

  const effectiveSenderId = sender.id;

  // Create campaign and all emails in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create campaign
    const campaign = await tx.emailCampaign.create({
      data: {
        userId,
        subject,
        body,
        startTime: startDate,
        delayBetweenEmails,
        hourlyLimit,
        totalEmails: recipients.length,
        status: 'active',
      },
    });

    // Create scheduled email records
    const emailData = recipients.map((recipient, index) => {
      const scheduledAt = new Date(startDate.getTime() + index * delayBetweenEmails);
      const idempotencyKey = `${campaign.id}-${recipient}-${index}`;
      const id = uuidv4();

      // Dynamic variable substitution per recipient (e.g. {{Name}}, {{Company}}, etc.)
      let personalizedSubject = subject;
      let personalizedBody = body;
      const params = recipientParams?.[recipient] || recipientParams?.[recipient.toLowerCase()];
      if (params && typeof params === 'object') {
        for (const [key, val] of Object.entries(params)) {
          if (val !== undefined && val !== null) {
            const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
            personalizedSubject = personalizedSubject.replace(regex, String(val));
            personalizedBody = personalizedBody.replace(regex, String(val));
          }
        }
      }

      // Default variables always supported: {{email}} and {{recipient}}
      personalizedSubject = personalizedSubject.replace(/{{\s*(email|recipient)\s*}}/gi, recipient);
      personalizedBody = personalizedBody.replace(/{{\s*(email|recipient)\s*}}/gi, recipient);

      const serializedAttachments =
        attachments && attachments.length > 0
          ? attachments.map((att) => ({
              filename: att.filename,
              contentType: att.contentType || 'application/octet-stream',
              size: Math.round((att.content.length * 3) / 4),
              // Store base64 content for attachments up to ~5MB so they can be opened/downloaded from detail view
              content: att.content.length < 7000000 ? att.content : undefined,
            }))
          : undefined;

      return {
        id,
        campaignId: campaign.id,
        userId,
        senderId: effectiveSenderId,
        recipient,
        subject: personalizedSubject,
        body: personalizedBody,
        scheduledAt,
        status: 'scheduled' as const,
        attachments: serializedAttachments,
        idempotencyKey,
        bullJobId: `email-${id}`,
      };
    });

    await tx.scheduledEmail.createMany({ data: emailData });

    return { campaign, emails: emailData };
  });

  // Create BullMQ jobs outside transaction (non-critical — reconcile on failure)
  const jobPromises = result.emails.map((email) => {
    const delay = Math.max(0, email.scheduledAt.getTime() - Date.now());
    return addEmailJob(email.id, delay, attachments).catch((error) => {
      logger.error(`Failed to create BullMQ job for email ${email.id}`, { error });
    });
  });

  await Promise.allSettled(jobPromises);

  logger.info(`Campaign ${result.campaign.id} created with ${result.emails.length} emails`, {
    campaignId: result.campaign.id,
    userId,
  });

  return { campaign: result.campaign, emailCount: result.emails.length };
}

/**
 * Look up a saved user or sender name for a given email address.
 */
export async function lookupRecipientName(email: string): Promise<{
  email: string;
  name: string | null;
  avatar: string | null;
}> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    return { email: normalized, name: null, avatar: null };
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: normalized, mode: 'insensitive' } },
    select: { name: true, avatar: true },
  });
  if (user?.name) {
    return { email: normalized, name: user.name, avatar: user.avatar || null };
  }

  const sender = await prisma.sender.findFirst({
    where: { email: { equals: normalized, mode: 'insensitive' } },
    select: { displayName: true },
  });
  if (sender?.displayName) {
    return { email: normalized, name: sender.displayName, avatar: null };
  }

  return { email: normalized, name: null, avatar: null };
}

/**
 * Batch-enrich email records with saved recipientName from User or Sender tables.
 */
async function attachRecipientNames<T extends { recipient: string }>(
  emails: T[]
): Promise<Array<T & { recipientName: string | null }>> {
  if (emails.length === 0) return [];

  const uniqueRecipients = Array.from(new Set(emails.map((e) => e.recipient.toLowerCase())));

  const [users, senders] = await Promise.all([
    prisma.user.findMany({
      where: { email: { in: uniqueRecipients, mode: 'insensitive' } },
      select: { email: true, name: true },
    }),
    prisma.sender.findMany({
      where: { email: { in: uniqueRecipients, mode: 'insensitive' } },
      select: { email: true, displayName: true },
    }),
  ]);

  const nameMap = new Map<string, string>();
  for (const s of senders) {
    if (s.displayName) nameMap.set(s.email.toLowerCase(), s.displayName);
  }
  for (const u of users) {
    if (u.name) nameMap.set(u.email.toLowerCase(), u.name);
  }

  return emails.map((email) => ({
    ...email,
    recipientName: nameMap.get(email.recipient.toLowerCase()) || null,
  }));
}

/**
 * Get paginated scheduled emails for a user.
 */
export async function getScheduledEmails(
  userId: string,
  filters: EmailFilters
): Promise<PaginatedResult<ScheduledEmail>> {
  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { userId };

  if (filters.status) {
    where.status = filters.status;
  } else {
    where.status = { in: ['scheduled', 'processing', 'retrying'] };
  }

  if (filters.campaignId) {
    where.campaignId = filters.campaignId;
  }

  if (filters.search && filters.search.trim().length > 0) {
    const q = filters.search.trim();
    where.OR = [
      { recipient: { contains: q, mode: 'insensitive' } },
      { subject: { contains: q, mode: 'insensitive' } },
      { body: { contains: q, mode: 'insensitive' } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.scheduledEmail.findMany({
      where,
      orderBy: { scheduledAt: 'asc' },
      skip,
      take: limit,
      include: {
        sender: { select: { email: true, displayName: true } },
        campaign: { select: { subject: true, status: true } },
      },
    }),
    prisma.scheduledEmail.count({ where }),
  ]);

  const enrichedData = await attachRecipientNames(data);

  return {
    data: enrichedData,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Get paginated sent/failed emails for a user.
 */
export async function getSentEmails(
  userId: string,
  filters: SentEmailFilters
): Promise<PaginatedResult<ScheduledEmail>> {
  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {
    userId,
    status: { in: ['sent', 'failed'] },
  };

  if (filters.campaignId) {
    where.campaignId = filters.campaignId;
  }

  if (filters.search && filters.search.trim().length > 0) {
    const q = filters.search.trim();
    where.OR = [
      { recipient: { contains: q, mode: 'insensitive' } },
      { subject: { contains: q, mode: 'insensitive' } },
      { body: { contains: q, mode: 'insensitive' } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.scheduledEmail.findMany({
      where,
      orderBy: { sentAt: 'desc' },
      skip,
      take: limit,
      include: {
        sender: { select: { email: true, displayName: true } },
        campaign: { select: { subject: true, status: true } },
      },
    }),
    prisma.scheduledEmail.count({ where }),
  ]);

  const enrichedData = await attachRecipientNames(data);

  return {
    data: enrichedData,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Retrieve a specific attachment (including base64 content) from PostgreSQL or BullMQ job data.
 */
export async function getEmailAttachment(
  emailId: string,
  userId: string,
  index: number
): Promise<{ filename: string; contentType: string; content?: string } | null> {
  const email = await prisma.scheduledEmail.findFirst({
    where: { id: emailId, userId },
  });

  if (!email) {
    return null;
  }

  const stored = Array.isArray(email.attachments)
    ? (email.attachments as Array<{ filename: string; contentType?: string; content?: string }>)
    : [];

  const target = stored[index];
  if (target?.content) {
    return {
      filename: target.filename,
      contentType: target.contentType || 'application/octet-stream',
      content: target.content,
    };
  }

  // Fallback: check BullMQ job data in Redis (useful for jobs scheduled prior to DB storage)
  try {
    const queue = getEmailQueue();
    const job = await queue.getJob(email.bullJobId || `email-${email.id}`);
    const jobAtt = job?.data?.attachments?.[index];
    if (jobAtt?.content) {
      return {
        filename: jobAtt.filename,
        contentType: jobAtt.contentType || 'application/octet-stream',
        content: jobAtt.content,
      };
    }
  } catch (error) {
    logger.warn(`Failed to inspect BullMQ job for attachment ${emailId}:${index}`, { error });
  }

  return target
    ? {
        filename: target.filename,
        contentType: target.contentType || 'application/octet-stream',
        content: undefined,
      }
    : null;
}

/**
 * Get a single email by ID for a user.
 */
export async function getEmailById(
  id: string,
  userId: string
): Promise<ScheduledEmail | null> {
  return prisma.scheduledEmail.findFirst({
    where: { id, userId },
    include: {
      sender: { select: { email: true, displayName: true } },
      campaign: { select: { subject: true, status: true } },
    },
  });
}

/**
 * Cancel a scheduled email.
 */
export async function cancelEmail(
  id: string,
  userId: string
): Promise<ScheduledEmail> {
  const email = await prisma.scheduledEmail.findFirst({
    where: { id, userId },
  });

  if (!email) {
    throw Object.assign(new Error('Email not found'), {
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  }

  if (email.status !== 'scheduled') {
    throw Object.assign(
      new Error(`Cannot cancel email with status "${email.status}"`),
      { statusCode: 400, code: 'INVALID_STATUS' }
    );
  }

  // Remove BullMQ job
  const jobId = `email-${email.id}`;
  await removeJob(jobId);

  // Update DB
  const updated = await prisma.scheduledEmail.update({
    where: { id },
    data: { status: 'cancelled' },
  });

  // Update campaign counts
  await prisma.emailCampaign.update({
    where: { id: email.campaignId },
    data: { totalEmails: { decrement: 1 } },
  });

  logger.info(`Email ${id} cancelled`, { userId });

  return updated;
}

/**
 * Reconcile on startup: find orphaned scheduled/retrying emails and recreate BullMQ jobs.
 */
export async function reconcileOnStartup(): Promise<void> {
  logger.info('Starting email reconciliation...');

  const orphanedEmails = await prisma.scheduledEmail.findMany({
    where: { status: { in: ['scheduled', 'retrying'] } },
  });

  if (orphanedEmails.length === 0) {
    logger.info('No orphaned emails to reconcile');
    return;
  }

  const emailQueue = getEmailQueue();
  let recreated = 0;

  for (const email of orphanedEmails) {
    const jobId = `email-${email.id}`;
    const existingJob = await emailQueue.getJob(jobId);

    if (!existingJob) {
      const delay = Math.max(0, email.scheduledAt.getTime() - Date.now());
      await emailQueue.add(
        'send-email',
        { emailId: email.id },
        {
          jobId,
          delay,
          removeOnComplete: true,
          removeOnFail: false,
        }
      );
      recreated++;
    }
  }

  logger.info(
    `Reconciliation complete: ${recreated}/${orphanedEmails.length} jobs recreated`
  );
}
