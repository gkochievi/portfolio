import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMe } from './hooks';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { data: user, isLoading, isError } = useMe();
  const location = useLocation();
  const { t } = useTranslation();

  if (isLoading) return <div className="p-8 text-ink-muted">{t('loading')}</div>;
  if (isError || !user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <>{children}</>;
}
