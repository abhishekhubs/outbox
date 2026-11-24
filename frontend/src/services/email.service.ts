import api from './api';
import type {
  ScheduleEmailRequest,
  ScheduledEmail,
  EmailCampaign,
  PaginatedResponse,
} from '../types';

export async function scheduleEmails(payload: ScheduleEmailRequest): Promise<{
  campaign: EmailCampaign;
  emailCount: number;
}> {
  const { data } = await api.post('/emails/schedule', payload);
  return data.data;
}

export async function getScheduledEmails(params?: {
  status?: string;
  campaignId?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<ScheduledEmail>> {
  const { data } = await api.get('/emails/scheduled', { params });
  return {
    data: data.data,
    total: data.pagination.total,
    page: data.pagination.page,
    pageSize: data.pagination.limit,
    totalPages: data.pagination.totalPages,
  };
}

export async function getSentEmails(params?: {
  campaignId?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<ScheduledEmail>> {
  const { data } = await api.get('/emails/sent', { params });
  return {
    data: data.data,
    total: data.pagination.total,
    page: data.pagination.page,
    pageSize: data.pagination.limit,
    totalPages: data.pagination.totalPages,
  };
}

export async function lookupRecipient(email: string): Promise<{
  email: string;
  name: string | null;
  avatar: string | null;
}> {
  const { data } = await api.get('/emails/lookup-recipient', { params: { email } });
  return data.data;
}

export async function getEmailById(id: string): Promise<ScheduledEmail> {
  const { data } = await api.get(`/emails/${id}`);
  return data.data;
}

export async function cancelEmail(id: string): Promise<ScheduledEmail> {
  const { data } = await api.post(`/emails/${id}/cancel`);
  return data.data;
}

export async function getCampaigns(): Promise<EmailCampaign[]> {
  const { data } = await api.get('/campaigns');
  return data.data;
}

export async function getCampaignById(id: string): Promise<EmailCampaign> {
  const { data } = await api.get(`/campaigns/${id}`);
  return data.data;
}

export async function searchEmails(
  query: string,
  filters?: {
    status?: string;
    campaignId?: string;
    senderId?: string;
    fromDate?: string;
    toDate?: string;
  },
  page = 1,
  limit = 20
): Promise<PaginatedResponse<ScheduledEmail>> {
  const { data } = await api.get('/search/emails', {
    params: {
      q: query,
      ...filters,
      page,
      limit,
    },
  });
  return {
    data: data.data || data.hits || [],
    total: data.total || 0,
    page: data.page || 1,
    pageSize: data.limit || limit,
    totalPages: Math.ceil((data.total || 0) / limit),
  };
}
