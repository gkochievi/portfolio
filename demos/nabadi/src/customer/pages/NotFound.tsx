import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Container } from '@/components/Container';
import { Button } from '@/components/Button';

export function NotFound() {
  const { t } = useTranslation('nav');
  return (
    <Layout>
      <Container size="md" className="py-32 text-center flex flex-col items-center gap-4">
        <p className="text-xs uppercase tracking-[0.2em] text-accent">404</p>
        <h1 className="font-display text-5xl md:text-7xl text-ink leading-tight">
          {t('not_found_title')}
        </h1>
        <p className="text-ink-muted max-w-md">{t('not_found_body')}</p>
        <Button asChild size="lg" className="mt-4 rounded-pill">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
            {t('home')}
          </Link>
        </Button>
      </Container>
    </Layout>
  );
}
