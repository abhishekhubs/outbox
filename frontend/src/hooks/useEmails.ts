import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as emailService from '../services/email.service';
import type { ScheduleEmailRequest } from '../types';

export function useScheduledEmails(params?: {
  status?: string;
  campaignId?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['scheduled-emails', params],
    queryFn: () => emailService.getScheduledEmails(params),
    refetchInterval: 5000, // Poll every 5s for live updates
  });
}

export function useSentEmails(params?: {
  campaignId?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['sent-emails', params],
    queryFn: () => emailService.getSentEmails(params),
    refetchInterval: 5000,
  });
}

export function useCampaigns() {
  return useQuery({
    queryKey: ['campaigns'],
    queryFn: () => emailService.getCampaigns(),
  });
}

export function useScheduleEmails() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ScheduleEmailRequest) => emailService.scheduleEmails(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-emails'] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}

export function useCancelEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => emailService.cancelEmail(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-emails'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}

export function useSearchEmails(query: string, filters?: any) {
  return useQuery({
    queryKey: ['search-emails', query, filters],
    queryFn: () => emailService.searchEmails(query, filters),
    enabled: query.trim().length > 0,
  });
}

export function useDashboardStats() {
  const scheduled = useScheduledEmails({ limit: 1 });
  const sent = useSentEmails({ limit: 1 });

  return {
    isLoading: scheduled.isLoading || sent.isLoading,
    totalScheduled: scheduled.data?.total || 0,
    totalSent: sent.data?.total || 0,
    refetch: () => {
      scheduled.refetch();
      sent.refetch();
    },
  };
}
