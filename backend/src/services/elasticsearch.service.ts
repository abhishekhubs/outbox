import {
  indexEmail,
  updateEmailIndex,
  searchEmails as esSearch,
  deleteEmailIndex,
  bulkIndexEmails,
} from '../config/elasticsearch';
import type { ElasticsearchEmailDocument, SearchFilters, SearchResult } from '../types';
import type { ScheduledEmail } from '@prisma/client';
import prisma from '../config/database';
import logger from '../utils/logger';

/**
 * Map a Prisma ScheduledEmail to an Elasticsearch document.
 */
function toElasticsearchDoc(email: ScheduledEmail): ElasticsearchEmailDocument {
  return {
    id: email.id,
    campaignId: email.campaignId,
    userId: email.userId,
    senderId: email.senderId,
    recipient: email.recipient,
    subject: email.subject,
    body: email.body,
    status: email.status,
    scheduledAt: email.scheduledAt.toISOString(),
    sentAt: email.sentAt?.toISOString() || null,
    smtpMessageId: email.smtpMessageId || null,
    etherealUrl: email.etherealUrl || null,
    errorMessage: email.errorMessage || null,
    createdAt: email.createdAt.toISOString(),
  };
}

/**
 * Index a single email to Elasticsearch.
 */
export async function indexEmailToES(email: ScheduledEmail): Promise<void> {
  try {
    await indexEmail(toElasticsearchDoc(email));
  } catch (error) {
    logger.error(`Failed to index email ${email.id} to Elasticsearch`, { error });
  }
}

/**
 * Update an email's status in Elasticsearch.
 */
export async function updateEmailStatusInES(
  emailId: string,
  status: string,
  sentAt?: Date
): Promise<void> {
  try {
    const updates: Partial<ElasticsearchEmailDocument> = { status: status as ElasticsearchEmailDocument['status'] };
    if (sentAt) {
      updates.sentAt = sentAt.toISOString();
    }
    await updateEmailIndex(emailId, updates);
  } catch (error) {
    logger.error(`Failed to update email ${emailId} in Elasticsearch`, { error });
  }
}

/**
 * Search emails via Elasticsearch with graceful PostgreSQL fallback.
 */
export async function searchEmailsInES(
  userId: string,
  query: string,
  filters?: SearchFilters,
  page = 1,
  limit = 20
): Promise<SearchResult> {
  const esResult = await esSearch(userId, query, filters, page, limit);
  if (esResult.total > 0) {
    return esResult;
  }

  // Fallback to PostgreSQL when Elasticsearch is unavailable or index is empty
  const skip = (page - 1) * limit;
  const where: Record<string, unknown> = { userId };

  if (filters?.status) {
    where.status = filters.status;
  }
  if (filters?.campaignId) {
    where.campaignId = filters.campaignId;
  }
  if (query && query.trim().length > 0) {
    const q = query.trim();
    where.OR = [
      { recipient: { contains: q, mode: 'insensitive' } },
      { subject: { contains: q, mode: 'insensitive' } },
      { body: { contains: q, mode: 'insensitive' } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.scheduledEmail.findMany({
      where,
      orderBy: { scheduledAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.scheduledEmail.count({ where }),
  ]);

  return {
    hits: rows.map(toElasticsearchDoc),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Delete an email from Elasticsearch.
 */
export async function deleteEmailFromES(emailId: string): Promise<void> {
  try {
    await deleteEmailIndex(emailId);
  } catch (error) {
    logger.error(`Failed to delete email ${emailId} from Elasticsearch`, { error });
  }
}

/**
 * Bulk index emails to Elasticsearch.
 */
export async function bulkIndexEmailsToES(emails: ScheduledEmail[]): Promise<void> {
  try {
    const docs = emails.map(toElasticsearchDoc);
    await bulkIndexEmails(docs);
  } catch (error) {
    logger.error('Failed to bulk index emails to Elasticsearch', { error });
  }
}
