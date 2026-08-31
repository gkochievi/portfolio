import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Calendar, Clock, MapPin, Scissors } from 'lucide-react';
import type { ReactNode } from 'react';
import { Layout } from '@/components/Layout';
import { Container } from '@/components/Container';
import { Button } from '@/components/Button';
import { Skeleton } from '@/components/Skeleton';
import { useBusinessInfo, useLandingContent } from '@/features/landing/hooks';

/**
 * /about — spec §8. The CMS already stores and serves about_text_ka/en on
 * GET /landing/; this page finally renders it. Falls back to brand copy from
 * i18n when the CMS text is empty or the request fails.
 */
export function About() {
  const { t, i18n } = useTranslation('about');
  const { t: tHome } = useTranslation('home');
  const { t: tNav } = useTranslation('nav');
  const lang = i18n.language?.startsWith('ka') ? 'ka' : 'en';
  const { data, isLoading } = useLandingContent();
  // CMS-sourced address with the same locale-string fallback as Footer/Contact/VisitBand.
  const biz = useBusinessInfo();

  const cmsText = (lang === 'ka' ? data?.about_text_ka : data?.about_text_en)?.trim();
  const text = cmsText || t('fallback_body');
  // Shop imagery: prefer a gallery shot so About doesn't mirror the hero.
  const image = data?.gallery_image_urls?.[0] || data?.hero_image_url || null;

  return (
    <Layout>
      <Container size="xl" className="py-12 md:py-20">
        <header className="mb-12 md:mb-16 max-w-3xl">
          <p className="text-xs uppercase tracking-[0.18em] text-accent font-medium mb-3">
            {tNav('about')}
          </p>
          <h1 className="font-display font-semibold text-4xl md:text-5xl lg:text-6xl text-ink leading-[1.05] tracking-tight mb-5 [overflow-wrap:anywhere]">
            {t('title')}
          </h1>
          <p className="text-lg text-ink-muted">{t('subtitle')}</p>
        </header>

        <div className="grid md:grid-cols-2 gap-10 lg:gap-16 items-start">
          <div className="flex flex-col gap-6">
            {isLoading ? (
              <div className="flex flex-col gap-3" aria-hidden>
                <Skeleton className="h-5 w-full rounded-lg" />
                <Skeleton className="h-5 w-11/12 rounded-lg" />
                <Skeleton className="h-5 w-4/5 rounded-lg" />
                <Skeleton className="h-5 w-2/3 rounded-lg" />
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {text.split(/\n{2,}/).map((paragraph, i) => (
                  <p
                    key={i}
                    className="text-lg text-ink-muted leading-relaxed whitespace-pre-line [overflow-wrap:anywhere]"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            )}

            <div className="border-t border-line pt-6 flex flex-col gap-3">
              <Row icon={<Clock className="h-5 w-5" />}>
                <p className="font-medium text-ink">{tHome('section_visit_hours_title')}</p>
                <p className="text-ink-muted text-sm">{tHome('section_visit_hours')}</p>
                <p className="text-ink-muted text-sm">{tHome('section_visit_closed')}</p>
              </Row>
              <Row icon={<MapPin className="h-5 w-5" />}>
                <p className="text-ink-muted">{biz.address}</p>
              </Row>
              <Row icon={<Calendar className="h-5 w-5" />}>
                <p className="text-ink-muted">{tHome('section_visit_walkins')}</p>
              </Row>
            </div>

            <Button asChild size="lg" variant="accent" className="self-start rounded-pill">
              <Link to="/book">
                {tHome('cta_book')}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </div>

          <div className="aspect-[4/5] md:aspect-[4/3] bg-surface border border-line rounded-2xl overflow-hidden">
            {image ? (
              <img src={image} alt="" className="w-full h-full object-cover photo-warm" />
            ) : (
              <div
                aria-hidden
                className="flex h-full w-full items-center justify-center text-ink-muted/30"
              >
                <Scissors className="h-16 w-16" />
              </div>
            )}
          </div>
        </div>
      </Container>
    </Layout>
  );
}

function Row({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="inline-flex items-center justify-center w-9 h-9 rounded-pill bg-accent-soft text-ink shrink-0">
        {icon}
      </span>
      <div>{children}</div>
    </div>
  );
}
