'use client';

/**
 * AuthContext.tsx
 * Centralized authentication state provider.
 * - Initializes session via /auth/me on first render.
 * - Provides login, register, logout, and refresh functions.
 * - Never stores tokens or passwords in browser storage.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { apiGetMe, apiLogin, apiLogout, apiRegister, ApiError, type PublicUser } from '@/lib/api';

interface AuthContextValue {
  user: PublicUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: {
    fullName: string;
    email: string;
    password: string;
    confirmPassword: string;
    role: 'student' | 'alumni';
  }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<PublicUser | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const router = useRouter();

  // Initialize session state from the backend
  const refresh = React.useCallback(async () => {
    try {
      const me = await apiGetMe();
      setUser(me);
    } catch {
      setUser(null);
    }
  }, []);

  React.useEffect(() => {
    refresh().finally(() => setIsLoading(false));
  }, [refresh]);

  const login = React.useCallback(
    async (email: string, password: string) => {
      const loggedInUser = await apiLogin({ email, password });
      setUser(loggedInUser);
      router.push('/dashboard');
    },
    [router]
  );

  const register = React.useCallback(
    async (payload: {
      fullName: string;
      email: string;
      password: string;
      confirmPassword: string;
      role: 'student' | 'alumni';
    }) => {
      const registeredUser = await apiRegister(payload);
      setUser(registeredUser);
      router.push('/dashboard');
    },
    [router]
  );

  const logout = React.useCallback(async () => {
    await apiLogout();
    setUser(null);
    router.push('/');
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}

// Re-export ApiError so pages can catch it without importing from lib/api
export { ApiError };
