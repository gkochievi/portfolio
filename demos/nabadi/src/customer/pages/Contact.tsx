import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, ArrowUpRight, Calendar, Clock, Mail, MapPin, Phone } from 'lucide-react';
import type { ReactNode } from 'react';
import { Layout } from '@/components/Layout';
import { Container } from '@/components/Container';
import { Button } from '@/components/Button';
import { Skeleton } from '@/components/Skeleton';
import { FacebookIcon, InstagramIcon } from '@/components/SocialIcons';
import { useBusinessInfo } from '@/features/landing/hooks';

/**
 * /contact — spec §8. Business address/phone/email + socials come from the
 * /landing/ business block (SiteSetting-backed); opening hours reuse the
 * visit-band locale source. Everything degrades gracefully: address falls
 * back to the brand locale string, empty phone/email/instagram rows are
 * hidden, and a missing map embed becomes a text link to Google Maps.
 */
export function Contact() {
  const { t } = useTranslation('contact');
  const { t: tHome } = useTranslation('home');
  const { t: tNav } = useTranslation('nav');
  const biz = useBusinessInfo();

  return (
    <Layout>
      <Container size="xl" className="py-12 md:py-20">
        <header className="mb-12 md:mb-16 max-w-3xl">
          <p className="text-xs uppercase tracking-[0.18em] text-accent font-medium mb-3">
            {tNav('contact')}
          </p>
          <h1 className="font-display font-semibold text-4xl md:text-5xl lg:text-6xl text-ink leading-[1.05] tracking-tight mb-5 [overflow-wrap:anywhere]">
            {t('title')}
          </h1>
          <p className="text-lg text-ink-muted">{t('subtitle')}</p>
        </header>

        <div className="grid md:grid-cols-2 gap-10 lg:gap-16 items-start">
          <div className="flex flex-col gap-6">
            {biz.isLoading ? (
              <div className="flex flex-col gap-3" aria-hidden>
                <Skeleton className="h-14 rounded-lg" />
                <Skeleton className="h-14 rounded-lg" />
                <Skeleton className="h-14 rounded-lg" />
                <Skeleton className="h-14 rounded-lg" />
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                <Row icon={<MapPin className="h-5 w-5" />}>
                  <p className="text-xs uppercase tracking-[0.15em] text-ink-muted mb-1">
                    {t('address_title')}
                  </p>
                  <a
                    href={biz.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-ink hover:text-accent transition [overflow-wrap:anywhere]"
                  >
                    {biz.address}
                  </a>
                </Row>
                {biz.phone && (
                  <Row icon={<Phone className="h-5 w-5" />}>
                    <p className="text-xs uppercase tracking-[0.15em] text-ink-muted mb-1">
                      {t('phone_title')}
                    </p>
                    <a
                      href={`tel:${biz.phone}`}
                      className="font-medium text-ink hover:text-accent transition"
                    >
                      {biz.phone}
                    </a>
                  </Row>
                )}
                {biz.email && (
                  <Row icon={<Mail className="h-5 w-5" />}>
                    <p className="text-xs uppercase tracking-[0.15em] text-ink-muted mb-1">
                      {t('email_title')}
                    </p>
                    <a
                      href={`mailto:${biz.email}`}
                      className="font-medium text-ink hover:text-accent transition [overflow-wrap:anywhere]"
                    >
                      {biz.email}
                    </a>
                  </Row>
                )}
                <Row icon={<Clock className="h-5 w-5" />}>
                  <p className="text-xs uppercase tracking-[0.15em] text-ink-muted mb-1">
                    {tHome('section_visit_hours_title')}
                  </p>
                  <p className="font-medium text-ink">{tHome('section_visit_hours')}</p>
                  <p className="text-sm text-ink-muted">{tHome('section_visit_closed')}</p>
                </Row>
                <Row icon={<Calendar className="h-5 w-5" />}>
                  <p className="text-ink-muted">{tHome('section_visit_walkins')}</p>
                </Row>
              </div>
            )}

            <div className="border-t border-line pt-6">
              <p className="text-xs uppercase tracking-[0.15em] text-ink-muted mb-3">
                {t('socials_title')}
              </p>
              <div className="flex gap-3">
                <a
                  href={biz.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-pill border border-line text-ink hover:border-line-strong hover:text-accent transition"
                >
                  <FacebookIcon className="h-5 w-5" />
                </a>
                {biz.instagram && (
                  <a
                    href={biz.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Instagram"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-pill border border-line text-ink hover:border-line-strong hover:text-accent transition"
                  >
                    <InstagramIcon className="h-5 w-5" />
                  </a>
                )}
              </div>
            </div>

            <Button asChild size="lg" variant="accent" className="self-start rounded-pill">
              <Link to="/book">
                {tHome('cta_book')}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </div>

          {/* Map column: lazy-loaded Google Maps embed in a 1px-line container.
              No embed configured → brand-safe placeholder with a maps link. */}
          <div className="aspect-[4/5] md:aspect-[4/3] overflow-hidden rounded-2xl border border-line bg-surface">
            {biz.isLoading ? (
              <Skeleton className="h-full w-full rounded-none border-0" />
            ) : biz.mapEmbedUrl ? (
              <iframe
                src={biz.mapEmbedUrl}
                title={tHome('map_title')}
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
                className="h-full w-full border-0"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-ink-muted">
                <MapPin className="h-10 w-10 text-ink-muted/40" aria-hidden />
                <a
                  href={biz.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-ink hover:text-accent transition"
                >
                  {t('open_in_maps')}
                  <ArrowUpRight className="h-4 w-4" aria-hidden />
                </a>
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
