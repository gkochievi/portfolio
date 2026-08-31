import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Standard role-based guard for admin routes.
 */
export function ProtectedRoute({ requiredRole, children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (user.must_change_password) return <Navigate to="/force-password-change" replace />;
  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/app'} replace />;
  }

  return children || <Outlet />;
}

/**
 * Auth guard for the customer app (/app/*).
 * Redirects unauthenticated users to the landing page (login lives there).
 * Admins get sent to /admin.
 */
export function AppAuthGuard() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        minHeight: '100vh', background: '#fff',
      }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!user) return <Navigate to="/" replace />;
  if (user.must_change_password) return <Navigate to="/force-password-change" replace />;
  if (user.role === 'admin') return <Navigate to="/admin" replace />;

  return <Outlet />;
}

/**
 * Gate for the forced password change page — only reachable when flagged.
 */
export function ForcePasswordChangeGuard({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!user) return <Navigate to="/" replace />;
  if (!user.must_change_password) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/app'} replace />;
  }
  return children;
}
