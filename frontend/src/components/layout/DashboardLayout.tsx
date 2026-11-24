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

  return (
    <div className="flex min-h-screen bg-[#fafafa] text-neutral-900 font-sans">
      {/* Sleek Minimalist Sidebar */}
      <Sidebar onComposeClick={() => setIsComposeOpen(true)} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header title={title} onSearch={onSearch} />
        <main className="flex-1 p-6 md:p-8 max-w-6xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Global Compose Modal */}
      <ComposeEmailModal isOpen={isComposeOpen} onClose={() => setIsComposeOpen(false)} />
    </div>
  );
};
