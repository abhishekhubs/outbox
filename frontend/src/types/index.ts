export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  googleId: string;
  createdAt: string;
}

export interface Sender {
  id: string;
  email: string;
  displayName: string;
  hourlyLimit: number;
  minimumSendDelay: number;
}

export interface EmailCampaign {
  id: string;
  subject: string;
  body: string;
  startTime: string;
  delayBetweenEmails: number;
  hourlyLimit: number;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
  totalEmails: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
}

export interface StoredAttachmentMeta {
  filename: string;
  contentType?: string;
  size?: number;
  content?: string;
}

export interface ScheduledEmail {
  id: string;
  campaignId: string;
  recipient: string;
  recipientName?: string | null;
  subject: string;
  body: string;
  scheduledAt: string;
  sentAt?: string;
  status: 'scheduled' | 'processing' | 'sent' | 'failed' | 'retrying' | 'cancelled';
  errorMessage?: string;
  smtpMessageId?: string;
  etherealUrl?: string;
  attachments?: StoredAttachmentMeta[];
  sender?: Sender;
  campaign?: EmailCampaign;
  createdAt: string;
}

export interface SlackStatus {
  connected: boolean;
  workspaceName?: string;
  channelName?: string;
  connectedAt?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface DashboardStats {
  totalScheduled: number;
  totalSent: number;
  totalFailed: number;
  totalPending: number;
}

export interface EmailAttachment {
  filename: string;
  content: string; // base64
  contentType?: string;
}

export interface ScheduleEmailRequest {
  subject: string;
  body: string;
  recipients: string[];
  recipientParams?: Record<string, Record<string, string>>;
  attachments?: EmailAttachment[];
  senderId?: string;
  startTime: string;
  delayBetweenEmails: number;
  hourlyLimit: number;
  idempotencyKey?: string;
}

export interface EmailFilters {
  page?: number;
  pageSize?: number;
  status?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
