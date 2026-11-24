import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '../types';
import * as authService from '../services/auth.service';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => Promise<void>;
  refetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchCurrentUser = async () => {
    try {
      setIsLoading(true);
      // Extract token from URL hash (#token=...) for mobile browsers that block 3rd-party cookies
      if (window.location.hash && window.location.hash.includes('token=')) {
        const hashParams = new URLSearchParams(window.location.hash.slice(1));
        const hashToken = hashParams.get('token');
        if (hashToken) {
          localStorage.setItem('outbox_token', hashToken);
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
      }
      const userData = await authService.getMe();
      setUser(userData);
    } catch {
      localStorage.removeItem('outbox_token');
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const login = () => {
    window.location.href = authService.getGoogleAuthUrl();
  };

  const handleLogout = async () => {
    localStorage.removeItem('outbox_token');
    try {
      await authService.logout();
    } finally {
      setUser(null);
      window.location.href = '/';
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout: handleLogout,
        refetchUser: fetchCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
