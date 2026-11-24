import React from 'react';
import { Clock, Send, AlertTriangle, Inbox } from 'lucide-react';
import { useScheduledEmails, useSentEmails } from '../../hooks/useEmails';
import { Skeleton } from '../ui/Skeleton';

export const StatsCards: React.FC = () => {
  const scheduled = useScheduledEmails({ limit: 1 });
  const sent = useSentEmails({ limit: 1 });

  const totalScheduled = scheduled.data?.total ?? 0;
  const totalSent = sent.data?.total ?? 0;
  const isLoading = scheduled.isLoading || sent.isLoading;

  const stats = [
    {
      label: 'Scheduled in Queue',
      value: totalScheduled,
      icon: Clock,
      subtext: 'Persistent BullMQ delayed jobs',
    },
    {
      label: 'Successfully Sent',
      value: totalSent,
      icon: Send,
      subtext: 'Delivered via Ethereal SMTP',
    },
    {
      label: 'Rate Limit',
      value: '200 / hr',
      icon: Inbox,
      subtext: 'Distributed sliding window',
    },
    {
      label: 'Minimum Delay',
      value: '2,000 ms',
      icon: AlertTriangle,
      subtext: 'Redis atomic cooldown',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      {stats.map((stat, idx) => {
        const Icon = stat.icon;
        return (
          <div
            key={idx}
            className="bg-white border border-neutral-200/80 rounded-xl p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-colors hover:border-neutral-300"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">{stat.label}</span>
              <Icon className="w-3.5 h-3.5 text-neutral-400" />
            </div>
            <div className="mt-3">
              {isLoading && typeof stat.value === 'number' ? (
                <Skeleton className="h-7 w-16" />
              ) : (
                <h3 className="text-xl font-semibold text-neutral-900 tracking-tight">{stat.value}</h3>
              )}
              <p className="text-[11px] text-neutral-400 mt-0.5">{stat.subtext}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
