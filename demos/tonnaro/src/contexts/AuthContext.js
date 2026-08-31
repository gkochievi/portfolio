import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

function langHeader() {
  const lang = localStorage.getItem('lang') || 'en';
  return { 'Accept-Language': lang };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const tokens = JSON.parse(localStorage.getItem('tokens') || 'null');
    if (tokens?.access && !user) {
      api.get('/auth/profile/')
        .then(({ data }) => {
          setUser(data);
          localStorage.setItem('user', JSON.stringify(data));
        })
        .catch(() => {
          localStorage.removeItem('tokens');
          localStorage.removeItem('user');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email, password) => {
    try {
      const { data } = await api.post('/auth/login/', { email, password });
      localStorage.setItem('tokens', JSON.stringify({
        access: data.access,
        refresh: data.refresh,
      }));
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      return data.user;
    } catch (err) {
      // Surface unverified-email branch so the page can route to /verify-email
      const body = err.response?.data;
      if (body && (body.code === 'email_unverified' || body.detail?.code === 'email_unverified')) {
        err.requiresVerification = true;
        err.email = email;
      }
      throw err;
    }
  }, []);

  const register = useCallback(async (values) => {
    const { data } = await api.post('/auth/register/', values, {
      headers: langHeader(),
    });
    // No auto-login: the caller navigates to /verify-email?email=…
    return data;
  }, []);

  const verifyEmail = useCallback(async ({ email, code, token }) => {
    const { data } = await api.post('/auth/verify-email/',
      token ? { token } : { email, code },
    );
    localStorage.setItem('tokens', JSON.stringify({
      access: data.access,
      refresh: data.refresh,
    }));
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  const resendVerification = useCallback(async (email) => {
    await api.post('/auth/verify-email/resend/', { email }, {
      headers: langHeader(),
    });
  }, []);

  const requestPasswordReset = useCallback(async (email) => {
    await api.post('/auth/password-reset/request/', { email }, {
      headers: langHeader(),
    });
  }, []);

  const verifyResetCode = useCallback(async ({ email, code }) => {
    // Step 1 of the two-step reset UI: validate the code without consuming
    // the token. The follow-up confirmPasswordReset call still includes the
    // same code/email/password, which is the operation that actually burns
    // the row server-side.
    await api.post('/auth/password-reset/verify-code/', { email, code });
  }, []);

  const confirmPasswordReset = useCallback(async ({ email, code, token, new_password }) => {
    await api.post('/auth/password-reset/confirm/',
      token ? { token, new_password } : { email, code, new_password },
    );
  }, []);

  const logout = useCallback(async () => {
    const tokens = JSON.parse(localStorage.getItem('tokens') || 'null');
    try {
      if (tokens?.refresh) {
        await api.post('/auth/logout/', { refresh: tokens.refresh });
      }
    } catch { /* ignore */ }
    localStorage.removeItem('tokens');
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    const { data } = await api.get('/auth/profile/');
    setUser(data);
    localStorage.setItem('user', JSON.stringify(data));
  }, []);

  const isAdmin = user?.role === 'admin';
  const isCustomer = user?.role === 'customer';

  return (
    <AuthContext.Provider value={{
      user, loading, login, register, logout, refreshProfile,
      verifyEmail, resendVerification,
      requestPasswordReset, verifyResetCode, confirmPasswordReset,
      isAdmin, isCustomer,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
