import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth, type Role } from '@/context/auth';

interface ProtectedRouteProps {
  /** Required role (or higher). 'staff' allows admin too. */
  requireRole?: Role;
}

const ProtectedRoute = ({ requireRole }: ProtectedRouteProps) => {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  }

  if (requireRole === 'staff' && !user.isStaffRole) {
    return <Navigate to="/" replace />;
  }
  if (requireRole === 'admin' && !user.isAdminRole) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
