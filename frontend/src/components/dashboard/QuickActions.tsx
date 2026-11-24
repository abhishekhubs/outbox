import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, Clock, Send, Settings } from 'lucide-react';

interface QuickActionsProps {
  onComposeClick: () => void;
}

export const QuickActions: React.FC<QuickActionsProps> = ({ onComposeClick }) => {
  return (
    <div className="bg-white border border-neutral-200/80 rounded-xl p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
      <h2 className="text-xs font-semibold text-neutral-900 uppercase tracking-wider mb-3">Quick Actions</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <button
          onClick={onComposeClick}
          className="flex flex-col items-start p-3 rounded-lg border border-neutral-200/70 hover:border-neutral-400 bg-white hover:bg-neutral-50/50 transition-all text-left group"
        >
          <Mail className="w-4 h-4 text-neutral-600 mb-2 group-hover:text-neutral-900" />
          <span className="text-xs font-medium text-neutral-900">Compose</span>
          <span className="text-[10px] text-neutral-400 mt-0.5">Schedule campaign</span>
        </button>

        <Link
          to="/dashboard/scheduled"
          className="flex flex-col items-start p-3 rounded-lg border border-neutral-200/70 hover:border-neutral-400 bg-white hover:bg-neutral-50/50 transition-all text-left group"
        >
          <Clock className="w-4 h-4 text-neutral-600 mb-2 group-hover:text-neutral-900" />
          <span className="text-xs font-medium text-neutral-900">Queue</span>
          <span className="text-[10px] text-neutral-400 mt-0.5">Delayed jobs</span>
        </Link>

        <Link
          to="/dashboard/sent"
          className="flex flex-col items-start p-3 rounded-lg border border-neutral-200/70 hover:border-neutral-400 bg-white hover:bg-neutral-50/50 transition-all text-left group"
        >
          <Send className="w-4 h-4 text-neutral-600 mb-2 group-hover:text-neutral-900" />
          <span className="text-xs font-medium text-neutral-900">Sent History</span>
          <span className="text-[10px] text-neutral-400 mt-0.5">Delivery logs</span>
        </Link>

        <Link
          to="/dashboard/settings"
          className="flex flex-col items-start p-3 rounded-lg border border-neutral-200/70 hover:border-neutral-400 bg-white hover:bg-neutral-50/50 transition-all text-left group"
        >
          <Settings className="w-4 h-4 text-neutral-600 mb-2 group-hover:text-neutral-900" />
          <span className="text-xs font-medium text-neutral-900">Integrations</span>
          <span className="text-[10px] text-neutral-400 mt-0.5">Slack alerts</span>
        </Link>
      </div>
    </div>
  );
};
