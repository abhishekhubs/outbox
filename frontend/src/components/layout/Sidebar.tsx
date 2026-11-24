import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Clock,
  Send,
  Settings,
  Plus,
  LogOut,
  Mail,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../utils/cn';

interface SidebarProps {
  onComposeClick: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onComposeClick }) => {
  const { user, logout } = useAuth();

  const navItems = [
    { label: 'Overview', to: '/dashboard', icon: LayoutDashboard },
    { label: 'Scheduled', to: '/dashboard/scheduled', icon: Clock },
    { label: 'Sent History', to: '/dashboard/sent', icon: Send },
    { label: 'Settings', to: '/dashboard/settings', icon: Settings },
  ];

  return (
    <aside className="w-60 bg-white border-r border-neutral-200/80 flex flex-col h-screen sticky top-0 select-none z-20">
      {/* Brand Header */}
      <div className="h-14 flex items-center px-5 border-b border-neutral-200/70 gap-2.5">
        <div className="w-6 h-6 rounded-md bg-neutral-900 flex items-center justify-center text-white">
          <Mail className="w-3.5 h-3.5" />
        </div>
        <span className="font-semibold text-sm tracking-tight text-neutral-900">
          Outbox
        </span>
      </div>

      {/* Compose Button */}
      <div className="p-3">
        <button
          onClick={onComposeClick}
          className="w-full flex items-center justify-center gap-1.5 bg-neutral-900 hover:bg-neutral-800 text-white font-medium text-xs py-2 px-3 rounded-lg shadow-xs transition-all active:scale-[0.99]"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Compose</span>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2.5 space-y-0.5 overflow-y-auto">
        <div className="px-2.5 py-2 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
          Platform
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  isActive
                    ? 'bg-neutral-100 text-neutral-900 font-semibold'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
                )
              }
            >
              <Icon className="w-4 h-4 text-neutral-500" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Profile Footer */}
      <div className="p-3 border-t border-neutral-200/70">
        <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-50/80 border border-neutral-200/60">
          <div className="flex items-center gap-2 overflow-hidden">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="w-7 h-7 rounded-full object-cover"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-neutral-200 text-neutral-700 font-medium flex items-center justify-center text-xs">
                {user?.name?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
            <div className="overflow-hidden">
              <p className="text-xs font-medium text-neutral-900 truncate">{user?.name || 'User'}</p>
              <p className="text-[10px] text-neutral-400 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            title="Logout"
            className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/50 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
};
