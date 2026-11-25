import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ComposeEmailModal } from '../modals/ComposeEmailModal';

interface DashboardLayoutProps {
  title: string;
  children: React.ReactNode;
  onSearch?: (query: string) => void;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  title,
  children,
  onSearch,
}) => {
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#fafafa] text-neutral-900 font-sans">
      {/* Responsive Sidebar (collapsible drawer on mobile, static on desktop) */}
      <Sidebar
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        onComposeClick={() => setIsComposeOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          title={title}
          onSearch={onSearch}
          onMenuClick={() => setIsMobileMenuOpen(true)}
        />
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-6xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Global Compose Modal */}
      <ComposeEmailModal isOpen={isComposeOpen} onClose={() => setIsComposeOpen(false)} />
    </div>
  );
};
