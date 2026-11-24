import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as slackService from '../services/slack.service';

export function useSlackStatus() {
  return useQuery({
    queryKey: ['slack-status'],
    queryFn: () => slackService.getSlackStatus(),
  });
}

export function useDisconnectSlack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => slackService.disconnectSlack(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slack-status'] });
    },
  });
}
