import api, { API_URL } from './api';
import type { User } from '../types';

export async function getMe(): Promise<User> {
  const { data } = await api.get<{ success: boolean; data: User }>('/auth/me');
  return data.data;
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout');
}

export function getGoogleAuthUrl(): string {
  return `${API_URL}/auth/google`;
}
