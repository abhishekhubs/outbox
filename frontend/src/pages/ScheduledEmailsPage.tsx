import React, { useState } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { ScheduledEmailsTable } from '../components/emails/ScheduledEmailsTable';
import { ComposeEmailModal } from '../components/modals/ComposeEmailModal';
import { Button } from '../components/ui/Button';
import { Plus } from 'lucide-react';

export const ScheduledEmailsPage: React.FC = () => {
  const [isComposeOpen, setIsComposeOpen] = useState(false);

  return (
    <DashboardLayout title="Scheduled Queue">
      <div className="space-y-4">
        {/* Header Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900 tracking-tight">Scheduled Emails</h2>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Delayed BullMQ jobs managed via atomic Redis concurrency controls
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsComposeOpen(true)}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Compose
          </Button>
        </div>

        {/* Scheduled emails table */}
        <ScheduledEmailsTable />

        {/* Modal */}
        <ComposeEmailModal isOpen={isComposeOpen} onClose={() => setIsComposeOpen(false)} />
      </div>
    </DashboardLayout>
  );
};
