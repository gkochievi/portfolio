import { Link, useRouteError } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, RotateCw } from 'lucide-react';
import { Container } from '@/components/Container';
import { Button } from '@/components/Button';
import { Logo } from '@/components/Logo';

/**
 * Branded 500 page (spec §8) — the router's errorElement, which doubles as
 * the render-error boundary for every route. Deliberately self-contained:
 * it must not depend on Layout/Header, since those may be what crashed.
 */
export function ErrorPage() {
  const { t } = useTranslation('nav');
  const error = useRouteError();

  // Surface the underlying error for debugging without leaking it to users.
  if (import.meta.env.DEV) {
    console.error(error);
  }

  return (
    <main className="min-h-screen bg-bg flex flex-col">
      <Container size="xl" className="py-6">
        <Link to="/" className="inline-block hover:opacity-80 transition" aria-label={t('home')}>
          <Logo size="sm" />
        </Link>
      </Container>
      <Container
        size="md"
        className="flex-1 flex flex-col items-center justify-center gap-4 py-24 text-center"
      >
        <p className="text-xs uppercase tracking-[0.2em] text-accent">500</p>
        <h1 className="font-display text-5xl md:text-7xl text-ink leading-tight tracking-tight">
          {t('error_title')}
        </h1>
        <p className="text-ink-muted max-w-md">{t('error_body')}</p>
        <div className="flex flex-wrap justify-center gap-3 mt-4">
          <Button
            size="lg"
            variant="accent"
            className="rounded-pill"
            onClick={() => window.location.reload()}
          >
            <RotateCw className="h-4 w-4" aria-hidden />
            {t('error_reload')}
          </Button>
          <Button asChild size="lg" variant="secondary" className="rounded-pill">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              {t('home')}
            </Link>
          </Button>
        </div>
      </Container>
    </main>
  );
}
