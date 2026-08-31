import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, tokenStore, ApiError } from '@/lib/api';

export type Role = 'customer' | 'staff' | 'admin';

export interface AuthUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  isStaffRole: boolean;
  isAdminRole: boolean;
}

interface TokenPair {
  access: string;
  refresh: string;
}

interface AuthResponse {
  user: AuthUser;
  tokens: TokenPair;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { email: string; password: string; firstName?: string; lastName?: string }) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  updateProfile: (input: { firstName: string; lastName: string }) => Promise<void>;
  changePassword: (input: { currentPassword: string; newPassword: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refresh = useCallback(async () => {
    if (!tokenStore.getAccess() && !tokenStore.getRefresh()) {
      setUser(null);
      return;
    }
    try {
      const me = await api.get<AuthUser>('/auth/me');
      setUser(me);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        tokenStore.clear();
        setUser(null);
      } else {
        throw err;
      }
    }
  }, []);

  // Hydrate on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refresh();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<AuthResponse>('/auth/login', { email, password }, { skipAuth: true });
    tokenStore.set(res.tokens.access, res.tokens.refresh);
    setUser(res.user);
  }, []);

  const register = useCallback(
    async (input: { email: string; password: string; firstName?: string; lastName?: string }) => {
      const res = await api.post<AuthResponse>(
        '/auth/register',
        {
          email: input.email,
          password: input.password,
          firstName: input.firstName ?? '',
          lastName: input.lastName ?? '',
        },
        { skipAuth: true },
      );
      tokenStore.set(res.tokens.access, res.tokens.refresh);
      setUser(res.user);
    },
    [],
  );

  const logout = useCallback(() => {
    // Best-effort server notify, but discard token client-side regardless.
    api.post('/auth/logout').catch(() => undefined);
    tokenStore.clear();
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (input: { firstName: string; lastName: string }) => {
    const updated = await api.patch<AuthUser>('/auth/me', {
      firstName: input.firstName,
      lastName: input.lastName,
    });
    setUser(updated);
  }, []);

  const changePassword = useCallback(
    async (input: { currentPassword: string; newPassword: string }) => {
      await api.post('/auth/me/password', {
        currentPassword: input.currentPassword,
        newPassword: input.newPassword,
      });
    },
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAuthenticated: !!user,
      login,
      register,
      logout,
      refresh,
      updateProfile,
      changePassword,
    }),
    [user, loading, login, register, logout, refresh, updateProfile, changePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
