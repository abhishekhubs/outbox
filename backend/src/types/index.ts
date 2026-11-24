import { EmailStatus, CampaignStatus } from '@prisma/client';

// ============================================================
// Auth Types
// ============================================================

export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
  id_token?: string;
}

export interface GoogleUserProfile {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

export interface JwtPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

export interface AuthResult {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    avatar: string | null;
  };
}

// ============================================================
// Email Types
// ============================================================

export interface EmailAttachment {
  filename: string;
  content: string; // base64
  contentType?: string;
}

export interface ScheduleEmailsParams {
  subject: string;
  body: string;
  recipients: string[];
  recipientParams?: Record<string, Record<string, any>>;
  attachments?: EmailAttachment[];
  senderId?: string;
  startTime: string;
  delayBetweenEmails: number;
  hourlyLimit: number;
  idempotencyKey?: string;
  userId: string;
}

export interface EmailJobData {
  emailId: string;
  attachments?: EmailAttachment[];
}

export interface EmailFilters {
  status?: EmailStatus;
  campaignId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface SentEmailFilters {
  campaignId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SendEmailResult {
  messageId: string;
  etherealUrl: string | null;
}

// ============================================================
// Rate Limit Types
// ============================================================

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  currentCount: number;
}

// ============================================================
// Slack Types
// ============================================================

export interface SlackOAuthResponse {
  ok: boolean;
  access_token: string;
  token_type: string;
  scope: string;
  bot_user_id: string;
  app_id: string;
  team: {
    name: string;
    id: string;
  };
  incoming_webhook?: {
    channel: string;
    channel_id: string;
    configuration_url: string;
    url: string;
  };
  error?: string;
}

export interface SlackStatus {
  connected: boolean;
  workspaceName?: string;
  channelName?: string;
  connectedAt?: Date;
}

// ============================================================
// Elasticsearch Types
// ============================================================

export interface ElasticsearchEmailDocument {
  id: string;
  campaignId: string;
  userId: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
  status: EmailStatus;
  scheduledAt: string;
  sentAt?: string | null;
  smtpMessageId?: string | null;
  etherealUrl?: string | null;
  errorMessage?: string | null;
  createdAt: string;
}

export interface SearchFilters {
  status?: EmailStatus;
  campaignId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface SearchParams {
  query: string;
  filters?: SearchFilters;
  page?: number;
  limit?: number;
}

export interface SearchResult {
  hits: ElasticsearchEmailDocument[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============================================================
// Health Check Types
// ============================================================

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  timestamp: string;
  services: {
    database: ServiceStatus;
    redis: ServiceStatus;
    elasticsearch: ServiceStatus;
  };
}

export interface ServiceStatus {
  status: 'up' | 'down';
  latency?: number;
  error?: string;
}

// ============================================================
// API Response Types
// ============================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
    details?: unknown;
  };
}

export interface CampaignWithStats {
  id: string;
  userId: string;
  subject: string;
  body: string;
  startTime: Date;
  delayBetweenEmails: number;
  hourlyLimit: number;
  status: CampaignStatus;
  totalEmails: number;
  sentCount: number;
  failedCount: number;
  createdAt: Date;
  updatedAt: Date;
  scheduledCount?: number;
  processingCount?: number;
  cancelledCount?: number;
}
