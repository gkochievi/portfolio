import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { useLogout } from '@/auth/hooks';
import { SITE_URL } from '@/lib/site';

export function Unauthorized() {
  const { t } = useTranslation('auth');
  const logout = useLogout();

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface border border-line rounded-md p-8 flex flex-col gap-4 text-center">
        <h1 className="font-display text-2xl text-ink">{t('unauthorized.title')}</h1>
        <p className="text-ink-muted">{t('unauthorized.message')}</p>
        <div className="flex flex-col gap-2 mt-2">
          <Button variant="secondary" onClick={() => logout.mutate()} loading={logout.isPending}>
            {t('unauthorized.logout')}
          </Button>
          <a href={SITE_URL} className="text-accent text-sm hover:underline">
            {t('unauthorized.go_to_customer_site')}
          </a>
        </div>
      </div>
    </main>
  );
}
