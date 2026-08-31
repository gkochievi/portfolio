import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ProtectedRoute, AppAuthGuard, ForcePasswordChangeGuard } from './components/common/ProtectedRoute';
// DEMO: the only chrome that is not the product. It lives inside AuthProvider
// because it signs you in through the real login path rather than faking a token.
import DemoBanner from './components/demo/DemoBanner';

// Eager: public marketing site — these define the LCP for first visits,
// so we don't want a Suspense fallback flash on `/`.
import PublicLayout from './components/layouts/PublicLayout';
import LandingPage from './pages/public/LandingPage';
import LoginPage from './pages/public/LoginPage';
import RegisterPage from './pages/public/RegisterPage';

// Lazy: rare auth flows
const VerifyEmailPage = lazy(() => import('./pages/public/VerifyEmailPage'));
const VerifyEmailConfirmPage = lazy(() => import('./pages/public/VerifyEmailConfirmPage'));
const ForgotPasswordPage = lazy(() => import('./pages/public/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/public/ResetPasswordPage'));
const ForcePasswordChangePage = lazy(() => import('./pages/ForcePasswordChangePage'));

// Lazy: customer app — separate phone-style flow, only loaded after sign-in
const AppLayout = lazy(() => import('./components/layouts/AppLayout'));
const AppLoginPage = lazy(() => import('./pages/app/AppLoginPage'));
const AppRegisterPage = lazy(() => import('./pages/app/AppRegisterPage'));
const AppHome = lazy(() => import('./pages/app/AppHome'));
const NewOrderFlow = lazy(() => import('./pages/app/NewOrderFlow'));
const AppOrdersPage = lazy(() => import('./pages/app/AppOrdersPage'));
const AppOrderDetailPage = lazy(() => import('./pages/app/AppOrderDetailPage'));
const AppProfilePage = lazy(() => import('./pages/app/AppProfilePage'));

// Lazy: admin dashboard — pulls Recharts, @dnd-kit, antd-img-crop, etc.
// Public visitors must never download this.
const AdminLayout = lazy(() => import('./components/layouts/AdminLayout'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminOrdersPage = lazy(() => import('./pages/admin/AdminOrdersPage'));
const AdminOrderDetailPage = lazy(() => import('./pages/admin/AdminOrderDetailPage'));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'));
const AdminUserFormPage = lazy(() => import('./pages/admin/AdminUserFormPage'));
const AdminCategoriesPage = lazy(() => import('./pages/admin/AdminCategoriesPage'));
const AdminServicesPage = lazy(() => import('./pages/admin/AdminServicesPage'));
const AdminPricingPage = lazy(() => import('./pages/admin/AdminPricingPage'));
const AdminVehiclesPage = lazy(() => import('./pages/admin/AdminVehiclesPage'));
const AdminDriversPage = lazy(() => import('./pages/admin/AdminDriversPage'));
const AdminCarOwnersPage = lazy(() => import('./pages/admin/AdminCarOwnersPage'));
const AdminAnalyticsPage = lazy(() => import('./pages/admin/AdminAnalyticsPage'));
const AdminLandingPage = lazy(() => import('./pages/admin/AdminLandingPage'));
const AdminSettingsPage = lazy(() => import('./pages/admin/AdminSettingsPage'));

function RouteFallback() {
  return (
    <div style={{
      minHeight: '60vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <Spin size="large" />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
      <DemoBanner />
      <Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* ─── Public / marketing site ─── */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/verify-email/confirm" element={<VerifyEmailConfirmPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Route>

        {/* ─── Customer app (separate phone-app flow) ─── */}
        <Route path="/app/login" element={<AppLoginPage />} />
        <Route path="/app/register" element={<AppRegisterPage />} />
        <Route path="/app/verify-email" element={<VerifyEmailPage variant="mobile" />} />
        <Route path="/app/verify-email/confirm" element={<VerifyEmailConfirmPage variant="mobile" />} />
        <Route path="/app/forgot-password" element={<ForgotPasswordPage variant="mobile" />} />
        <Route path="/app/reset-password" element={<ResetPasswordPage variant="mobile" />} />

        <Route element={<AppAuthGuard />}>
          <Route element={<AppLayout />}>
            <Route path="/app" element={<AppHome />} />
            <Route path="/app/orders" element={<AppOrdersPage />} />
            <Route path="/app/profile" element={<AppProfilePage />} />
          </Route>
          {/* Full-screen pages (no bottom tab) */}
          <Route path="/app/order/new" element={<NewOrderFlow />} />
          <Route path="/app/orders/:id" element={<AppOrderDetailPage />} />
        </Route>

        {/* ─── Admin dashboard ─── */}
        <Route
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/orders" element={<AdminOrdersPage />} />
          <Route path="/admin/orders/:id" element={<AdminOrderDetailPage />} />
          <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />
          <Route path="/admin/history" element={<AdminOrdersPage historyMode />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/users/new" element={<AdminUserFormPage />} />
          <Route path="/admin/users/:id" element={<AdminUserFormPage />} />
          <Route path="/admin/categories" element={<AdminCategoriesPage />} />
          <Route path="/admin/services" element={<AdminServicesPage />} />
          <Route path="/admin/pricing" element={<AdminPricingPage />} />
          <Route path="/admin/vehicles" element={<AdminVehiclesPage />} />
          <Route path="/admin/drivers" element={<AdminDriversPage />} />
          <Route path="/admin/car-owners" element={<AdminCarOwnersPage />} />
          <Route path="/admin/landing" element={<AdminLandingPage />} />
          <Route path="/admin/settings" element={<AdminSettingsPage />} />
        </Route>

        {/* Forced password change (after admin reset) */}
        <Route
          path="/force-password-change"
          element={
            <ForcePasswordChangeGuard>
              <ForcePasswordChangePage />
            </ForcePasswordChangeGuard>
          }
        />

        {/* Old dashboard routes redirect to new app */}
        <Route path="/dashboard/*" element={<Navigate to="/app" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
      </NotificationProvider>
    </AuthProvider>
  );
}
