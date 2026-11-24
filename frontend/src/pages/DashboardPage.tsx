import React, { useState } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { StatsCards } from '../components/dashboard/StatsCards';
import { QuickActions } from '../components/dashboard/QuickActions';
import { RecentEmails } from '../components/dashboard/RecentEmails';
import { ComposeEmailModal } from '../components/modals/ComposeEmailModal';

export const DashboardPage: React.FC = () => {
  const [isComposeOpen, setIsComposeOpen] = useState(false);

  return (
    <DashboardLayout title="Overview">
      <div className="space-y-5">
        {/* Top Summary Stat Cards */}
        <StatsCards />

        {/* Quick Navigation Cards */}
        <QuickActions onComposeClick={() => setIsComposeOpen(true)} />

        {/* Live Queue Activity Table */}
        <RecentEmails />

        {/* Modal */}
        <ComposeEmailModal isOpen={isComposeOpen} onClose={() => setIsComposeOpen(false)} />
      </div>
    </DashboardLayout>
  );
};
