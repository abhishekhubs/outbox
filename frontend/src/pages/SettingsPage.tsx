import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { useSlackStatus, useDisconnectSlack } from '../hooks/useSlack';
import { getSlackConnectUrl } from '../services/slack.service';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { CheckCircle2, AlertTriangle, ExternalLink, Shield } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const slackSuccess = searchParams.get('slack') === 'connected';
  const slackError = searchParams.get('slack_error');

  const { data: slackStatus, isLoading } = useSlackStatus();
  const disconnectMutation = useDisconnectSlack();

  const handleConnectSlack = () => {
    window.location.href = getSlackConnectUrl();
  };

  const handleDisconnectSlack = async () => {
    await disconnectMutation.mutateAsync();
  };

  return (
    <DashboardLayout title="Settings & Integrations">
      <div className="max-w-3xl space-y-6">
        {/* Header note */}
        <div>
          <h2 className="text-sm font-semibold text-neutral-900 tracking-tight">Integrations</h2>
          <p className="text-[11px] text-neutral-400 mt-0.5">
            Configure external notification hooks and live queue telemetry
          </p>
        </div>

        {/* Notifications if redirect arrived from Slack OAuth callback */}
        {slackSuccess && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200/60 text-emerald-700 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Slack workspace connected. Rate-limit alerts active.</span>
          </div>
        )}

        {slackError && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200/60 text-rose-700 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Slack connection failed: {decodeURIComponent(slackError)}</span>
          </div>
        )}

        {/* Slack Integration Card */}
        <div className="bg-white border border-neutral-200/80 rounded-xl p-5 space-y-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-neutral-900">Slack OAuth</h3>
                {isLoading ? (
                  <Skeleton className="w-12 h-4 rounded-full" />
                ) : slackStatus?.connected ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                    Connected
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-neutral-100 text-neutral-500 border border-neutral-200/60">
                    Inactive
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Sends automated Slack messages when a sender hits their 200/hr quota.
              </p>
            </div>

            <div>
              {isLoading ? (
                <Skeleton className="w-20 h-7" />
              ) : slackStatus?.connected ? (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleDisconnectSlack}
                  isLoading={disconnectMutation.isPending}
                >
                  Disconnect
                </Button>
              ) : (
                <Button variant="primary" size="sm" onClick={handleConnectSlack}>
                  Connect
                </Button>
              )}
            </div>
          </div>

          {/* Details if connected */}
          {slackStatus?.connected && (
            <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200/60 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Workspace:</span>
                <span className="font-medium text-neutral-800">{slackStatus.workspaceName || 'Active Workspace'}</span>
              </div>
              {slackStatus.channelName && (
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Alert Channel:</span>
                  <span className="font-medium text-neutral-800">#{slackStatus.channelName}</span>
                </div>
              )}
              {slackStatus.connectedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Connected:</span>
                  <span className="font-medium text-neutral-800">{new Date(slackStatus.connectedAt).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          )}

          {/* Rate-limit Alert Explainer */}
          <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200/60 text-xs text-neutral-600 space-y-1">
            <h4 className="font-medium text-neutral-800 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-neutral-500" />
              <span>How Slack Alerts Work</span>
            </h4>
            <p className="text-neutral-400 leading-relaxed text-[11px]">
              When hourly limits are exceeded, jobs reschedule without dropping and a deduplicated alert is dispatched to your connected Slack channel.
            </p>
          </div>
        </div>

        {/* Queue Administration Link */}
        <div className="bg-white border border-neutral-200/80 rounded-xl p-5 flex items-center justify-between shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">BullMQ Live Queue Monitor</h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Inspect waiting, delayed, active, and completed jobs on Bull Board.
            </p>
          </div>
          <a
            href="http://localhost:5000/api/admin/queues"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 bg-white text-xs font-medium text-neutral-700 hover:text-neutral-900 hover:bg-neutral-50 transition-colors"
          >
            <span>Open Bull Board</span>
            <ExternalLink className="w-3 h-3 text-neutral-400" />
          </a>
        </div>
      </div>
    </DashboardLayout>
  );
};
