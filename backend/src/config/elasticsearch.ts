import { Client } from '@elastic/elasticsearch';
import logger from '../utils/logger';
import { env } from './env';
import type { ElasticsearchEmailDocument, SearchFilters, SearchResult } from '../types';

const EMAIL_INDEX = 'outbox-emails';

let _client: Client | null = null;

export function getElasticsearchClient(): Client {
  if (!_client) {
    _client = new Client({
      node: env.ELASTICSEARCH_URL,
      requestTimeout: 10000,
      maxRetries: 3,
    });
  }
  return _client;
}

/**
 * Create the emails index with proper mappings if it doesn't exist.
 */
export async function createEmailIndex(): Promise<void> {
  const client = getElasticsearchClient();
  try {
    const exists = await client.indices.exists({ index: EMAIL_INDEX });
    if (exists) {
      logger.info(`Elasticsearch index "${EMAIL_INDEX}" already exists`);
      return;
    }

    await client.indices.create({
      index: EMAIL_INDEX,
      body: {
        settings: {
          number_of_shards: 1,
          number_of_replicas: 0,
          analysis: {
            analyzer: {
              email_analyzer: {
                type: 'custom',
                tokenizer: 'uax_url_email',
                filter: ['lowercase', 'stop'],
              },
            },
          },
        },
        mappings: {
          properties: {
            id: { type: 'keyword' },
            campaignId: { type: 'keyword' },
            userId: { type: 'keyword' },
            senderId: { type: 'keyword' },
            recipient: {
              type: 'text',
              analyzer: 'email_analyzer',
              fields: { keyword: { type: 'keyword' } },
            },
            subject: {
              type: 'text',
              analyzer: 'standard',
              fields: { keyword: { type: 'keyword', ignore_above: 500 } },
            },
            body: { type: 'text', analyzer: 'standard' },
            status: { type: 'keyword' },
            scheduledAt: { type: 'date' },
            sentAt: { type: 'date' },
            smtpMessageId: { type: 'keyword' },
            etherealUrl: { type: 'keyword', index: false },
            errorMessage: { type: 'text' },
            createdAt: { type: 'date' },
          },
        },
      },
    });

    logger.info(`Elasticsearch index "${EMAIL_INDEX}" created`);
  } catch (error) {
    logger.error('Failed to create Elasticsearch index', { error });
    // Don't throw — Elasticsearch is optional / degraded mode
  }
}

/**
 * Index a single email document.
 */
export async function indexEmail(email: ElasticsearchEmailDocument): Promise<void> {
  const client = getElasticsearchClient();
  try {
    await client.index({
      index: EMAIL_INDEX,
      id: email.id,
      body: email,
      refresh: 'wait_for',
    });
  } catch (error) {
    logger.error(`Failed to index email ${email.id}`, { error });
  }
}

/**
 * Update an email document's status.
 */
export async function updateEmailIndex(
  emailId: string,
  updates: Partial<ElasticsearchEmailDocument>
): Promise<void> {
  const client = getElasticsearchClient();
  try {
    await client.update({
      index: EMAIL_INDEX,
      id: emailId,
      body: { doc: updates },
      refresh: 'wait_for',
    });
  } catch (error) {
    logger.error(`Failed to update email ${emailId} in Elasticsearch`, { error });
  }
}

/**
 * Search emails with full-text search and filters.
 */
export async function searchEmails(
  userId: string,
  query: string,
  filters?: SearchFilters,
  page = 1,
  limit = 20
): Promise<SearchResult> {
  const client = getElasticsearchClient();
  const from = (page - 1) * limit;

  const must: object[] = [{ term: { userId } }];
  const filter: object[] = [];

  if (query && query.trim().length > 0) {
    must.push({
      multi_match: {
        query: query.trim(),
        fields: ['recipient', 'subject^2', 'body'],
        type: 'best_fields',
        fuzziness: 'AUTO',
      },
    });
  }

  if (filters?.status) {
    filter.push({ term: { status: filters.status } });
  }

  if (filters?.campaignId) {
    filter.push({ term: { campaignId: filters.campaignId } });
  }

  if (filters?.dateFrom || filters?.dateTo) {
    const range: Record<string, string> = {};
    if (filters.dateFrom) range.gte = filters.dateFrom;
    if (filters.dateTo) range.lte = filters.dateTo;
    filter.push({ range: { scheduledAt: range } });
  }

  try {
    const result = await client.search<ElasticsearchEmailDocument>({
      index: EMAIL_INDEX,
      body: {
        from,
        size: limit,
        query: {
          bool: {
            must,
            filter,
          },
        },
        sort: [{ scheduledAt: { order: 'desc' } }],
        highlight: {
          fields: {
            subject: {},
            body: { fragment_size: 150 },
            recipient: {},
          },
        },
      },
    });

    const total =
      typeof result.hits.total === 'number'
        ? result.hits.total
        : result.hits.total?.value ?? 0;

    const hits = result.hits.hits.map((hit) => ({
      ...hit._source!,
      _highlight: hit.highlight,
    })) as ElasticsearchEmailDocument[];

    return {
      hits,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    logger.error('Elasticsearch search failed', { error });
    return { hits: [], total: 0, page, limit, totalPages: 0 };
  }
}

/**
 * Delete an email document from the index.
 */
export async function deleteEmailIndex(emailId: string): Promise<void> {
  const client = getElasticsearchClient();
  try {
    await client.delete({
      index: EMAIL_INDEX,
      id: emailId,
      refresh: 'wait_for',
    });
  } catch (error) {
    logger.error(`Failed to delete email ${emailId} from Elasticsearch`, { error });
  }
}

/**
 * Bulk index emails (for reconciliation / batch operations).
 */
export async function bulkIndexEmails(emails: ElasticsearchEmailDocument[]): Promise<void> {
  if (emails.length === 0) return;

  const client = getElasticsearchClient();
  const operations = emails.flatMap((email) => [
    { index: { _index: EMAIL_INDEX, _id: email.id } },
    email,
  ]);

  try {
    const result = await client.bulk({ body: operations, refresh: 'wait_for' });
    if (result.errors) {
      const errorItems = result.items.filter((item) => item.index?.error);
      logger.error(`Bulk index had ${errorItems.length} errors`, {
        errors: errorItems.slice(0, 5).map((i) => i.index?.error),
      });
    } else {
      logger.info(`Bulk indexed ${emails.length} emails`);
    }
  } catch (error) {
    logger.error('Bulk index failed', { error });
  }
}

export { EMAIL_INDEX };
