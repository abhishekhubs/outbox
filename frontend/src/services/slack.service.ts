import api, { API_URL } from './api';
import type { SlackStatus } from '../types';

export async function getSlackStatus(): Promise<SlackStatus> {
  const { data } = await api.get<{ success: boolean; data: SlackStatus }>('/slack/status');
  return data.data;
}

export function getSlackConnectUrl(): string {
  return `${API_URL}/slack/connect`;
}

export async function disconnectSlack(): Promise<void> {
  await api.post('/slack/disconnect');
}
