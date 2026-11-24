import React from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { SentEmailsTable } from '../components/emails/SentEmailsTable';
import { ExternalLink } from 'lucide-react';

export const SentEmailsPage: React.FC = () => {
  return (
    <DashboardLayout title="Delivery History">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900 tracking-tight">Sent Emails</h2>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Real-time SMTP dispatch logs with message IDs and test previews
            </p>
          </div>
          <a
            href="https://ethereal.email/messages"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-neutral-200/80 text-xs text-neutral-700 hover:text-neutral-900 hover:bg-neutral-50 shadow-xs transition-all"
          >
            <span>Open Ethereal Mailbox</span>
            <ExternalLink className="w-3 h-3 text-neutral-400" />
          </a>
        </div>

        {/* Sent Table */}
        <SentEmailsTable />
      </div>
    </DashboardLayout>
  );
};
