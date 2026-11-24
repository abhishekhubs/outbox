import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Loader2 } from 'lucide-react';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center gap-4 p-6">
        <div className="relative flex items-center justify-center w-12 h-12">
          {/* Subtle pulsating outer ring */}
          <div className="w-12 h-12 rounded-full border border-neutral-200 animate-ping opacity-25 absolute"></div>
          {/* Smooth spinning emerald loader */}
          <div className="w-8 h-8 rounded-full border-2 border-neutral-200 border-t-[#00a84d] animate-spin"></div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <p className="text-xs font-semibold tracking-wide text-neutral-800 uppercase">Outbox</p>
          <p className="text-xs text-neutral-400 animate-pulse">Initializing workspace...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
