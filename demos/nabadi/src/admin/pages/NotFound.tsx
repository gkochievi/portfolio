import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function NotFound() {
  const { t } = useTranslation();
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 gap-4">
      <h1 className="font-display text-3xl">404</h1>
      <p className="text-ink-muted">{t('not_found')}</p>
      <Link to="/" className="text-accent hover:underline">
        {t('return_home')}
      </Link>
    </main>
  );
}
