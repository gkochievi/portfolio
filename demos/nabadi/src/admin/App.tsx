import type { ReactNode } from 'react';
import { createBrowserRouter, createHashRouter, RouterProvider } from 'react-router-dom';
import { ROUTER_MODE, surfaceBasename } from '../surface';
import { Login } from './pages/Login';
import { Unauthorized } from './pages/Unauthorized';
import { NotFound } from './pages/NotFound';
import { RequireStaff } from './auth/RequireStaff';
import { AdminLayout } from './features/admin/AdminLayout';
import { Dashboard } from './pages/admin/Dashboard';
import { AdminBookings } from './pages/admin/Bookings';
import { AdminCustomers } from './pages/admin/Customers';
import { CustomerDetail } from './pages/admin/CustomerDetail';
import { WalkIn } from './pages/admin/WalkIn';
import { AdminServices } from './pages/admin/Services';
import { AdminBarbers } from './pages/admin/Barbers';
import { BarberDetail } from './pages/admin/BarberDetail';
import { AdminTimeOff } from './pages/admin/TimeOff';
import { AdminPromotions } from './pages/admin/Promotions';
import { AdminAudit } from './pages/admin/Audit';
import { AdminAnalytics } from './pages/admin/Analytics';
import { AdminSettings } from './pages/admin/Settings';
import { AdminLanding } from './pages/admin/Landing';
import { AdminNotifications } from './pages/admin/Notifications';
import { AdminReviews } from './pages/admin/Reviews';
import { AdminUsers } from './pages/admin/Users';
import { AdminProfile } from './pages/admin/Profile';

/**
 * Every console page sits behind the same gate: `admin` is the only role that
 * signs in here, so there is nothing left to vary per route.
 */
function AdminRoute({ children }: { children: ReactNode }) {
  return (
    <RequireStaff>
      <AdminLayout>{children}</AdminLayout>
    </RequireStaff>
  );
}

// Upstream this console is its own deployment at the domain root, so every
// path below starts at `/`. Here it lives under `<base>admin`, and the
// basename is what lets the route table stay exactly as it was written.
const createRouter = ROUTER_MODE === 'hash' ? createHashRouter : createBrowserRouter;

const router = createRouter([
  {
    path: '/',
    element: (
      <AdminRoute>
        <Dashboard />
      </AdminRoute>
    ),
  },
  {
    path: '/bookings',
    element: (
      <AdminRoute>
        <AdminBookings />
      </AdminRoute>
    ),
  },
  {
    path: '/customers',
    element: (
      <AdminRoute>
        <AdminCustomers />
      </AdminRoute>
    ),
  },
  {
    path: '/customers/:id',
    element: (
      <AdminRoute>
        <CustomerDetail />
      </AdminRoute>
    ),
  },
  {
    path: '/walk-in',
    element: (
      <AdminRoute>
        <WalkIn />
      </AdminRoute>
    ),
  },
  {
    path: '/services',
    element: (
      <AdminRoute>
        <AdminServices />
      </AdminRoute>
    ),
  },
  {
    path: '/barbers',
    element: (
      <AdminRoute>
        <AdminBarbers />
      </AdminRoute>
    ),
  },
  {
    path: '/barbers/:id',
    element: (
      <AdminRoute>
        <BarberDetail />
      </AdminRoute>
    ),
  },
  {
    path: '/time-off',
    element: (
      <AdminRoute>
        <AdminTimeOff />
      </AdminRoute>
    ),
  },
  {
    path: '/promotions',
    element: (
      <AdminRoute>
        <AdminPromotions />
      </AdminRoute>
    ),
  },
  {
    path: '/audit',
    element: (
      <AdminRoute>
        <AdminAudit />
      </AdminRoute>
    ),
  },
  {
    path: '/analytics',
    element: (
      <AdminRoute>
        <AdminAnalytics />
      </AdminRoute>
    ),
  },
  {
    path: '/settings',
    element: (
      <AdminRoute>
        <AdminSettings />
      </AdminRoute>
    ),
  },
  {
    path: '/landing',
    element: (
      <AdminRoute>
        <AdminLanding />
      </AdminRoute>
    ),
  },
  {
    path: '/notifications',
    element: (
      <AdminRoute>
        <AdminNotifications />
      </AdminRoute>
    ),
  },
  {
    path: '/reviews',
    element: (
      <AdminRoute>
        <AdminReviews />
      </AdminRoute>
    ),
  },
  {
    path: '/users',
    element: (
      <AdminRoute>
        <AdminUsers />
      </AdminRoute>
    ),
  },
  {
    path: '/profile',
    element: (
      <AdminRoute>
        <AdminProfile />
      </AdminRoute>
    ),
  },
  { path: '/login', element: <Login /> },
  { path: '/unauthorized', element: <Unauthorized /> },
  { path: '*', element: <NotFound /> },
], { basename: surfaceBasename('admin') });

export default function App() {
  return <RouterProvider router={router} />;
}
