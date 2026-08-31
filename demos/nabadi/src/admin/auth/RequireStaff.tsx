import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMe } from './hooks';

export function RequireStaff({ children }: { children: ReactNode }) {
  const { data: user, isLoading, isError } = useMe();
  const location = useLocation();
  const { t } = useTranslation();

  if (isLoading)
    return (
      <div role="status" aria-live="polite" className="p-8 text-ink-muted">
        {t('loading')}
      </div>
    );
  if (isError || !user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  // `admin` is the only console role: a `barber` row is a data tag on the
  // user rows behind the barbers table, never a sign-in for this surface, so
  // every non-admin session — customer or barber — is turned away here.
  if (user.role !== 'admin') {
    return <Navigate to="/unauthorized" replace />;
  }
  return <>{children}</>;
}
