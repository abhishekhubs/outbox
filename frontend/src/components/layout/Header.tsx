import React from 'react';
import { Search, ExternalLink } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface HeaderProps {
  title: string;
  onSearch?: (query: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ title, onSearch }) => {
  const { user } = useAuth();

  return (
    <header className="h-14 bg-white border-b border-neutral-200/80 px-6 flex items-center justify-between sticky top-0 z-10">
      {/* Title */}
      <div>
        <h1 className="text-sm font-semibold text-neutral-900 tracking-tight">{title}</h1>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-3">
        {onSearch && (
          <div className="relative w-64 hidden sm:block">
            <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search"
              onChange={(e) => onSearch(e.target.value)}
              className="w-full bg-neutral-100/80 hover:bg-neutral-100 focus:bg-white border border-transparent focus:border-neutral-300 rounded-full pl-9 pr-3.5 py-1.5 text-xs text-neutral-800 placeholder-neutral-400 focus:outline-none transition-all"
            />
          </div>
        )}

        {/* Ethereal Mailbox shortcut */}
        <a
          href="https://ethereal.email/messages"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-neutral-600 hover:text-neutral-900 flex items-center gap-1 px-2.5 py-1 rounded-md border border-neutral-200 bg-white hover:bg-neutral-50 transition-colors"
        >
          <span>Ethereal</span>
          <ExternalLink className="w-3 h-3 text-neutral-400" />
        </a>

        {/* User avatar indicator */}
        <div className="flex items-center pl-1">
          {user?.avatar ? (
            <img src={user.avatar} alt={user.name} className="w-7 h-7 rounded-full object-cover border border-neutral-200" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-neutral-100 text-neutral-700 font-medium text-xs flex items-center justify-center border border-neutral-200">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
