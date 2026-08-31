import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  ArrowUpRight,
  Calendar,
  Clock,
  MapPin,
  Scissors,
  Sparkles,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Layout } from '@/components/Layout';
import { Container } from '@/components/Container';
import { Button } from '@/components/Button';
import { Skeleton, SkeletonGrid } from '@/components/Skeleton';
import { SectionError } from '@/components/SectionError';
import { useBusinessInfo, useLandingContent } from '@/features/landing/hooks';
import { useBarbers, useServices, type ServiceItem } from '@/features/booking/hooks';
import { pickLocalized } from '@/lib/localized';
import { SERVICE_ICONS } from '@/lib/serviceIcons';
import { cn } from '@/lib/cn';

/** Brand-safe placeholder for lifestyle imagery when no CMS image is set.
    No third-party runtime dependency — solid surface + 1px line + brand mark. */
function ImageFallback({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'flex h-full w-full items-center justify-center bg-surface text-ink-muted/30',
        className,
      )}
    >
      <Scissors className="h-16 w-16" />
    </div>
  );
}

export function Home() {
  return (
    <Layout>
      <Hero />
      <StatBand />
      <Marquee />
      <ServicesPreview />
      <BarbersPreview />
      <Gallery />
      <VisitBand />
    </Layout>
  );
}

function Hero() {
  const { t, i18n } = useTranslation('home');
  const lang = i18n.language?.startsWith('ka') ? 'ka' : 'en';
  const { data, isLoading } = useLandingContent();

  const heading =
    (lang === 'ka' ? data?.hero_heading_ka : data?.hero_heading_en) || t('hero_heading');
  const sub =
    (lang === 'ka' ? data?.hero_subheading_ka : data?.hero_subheading_en) || t('hero_subheading');
  // CMS-provided hero image only — no third-party fallback. Falls back to a
  // brand-safe placeholder when the CMS has no image yet.
  const heroImage = data?.hero_image_url || null;

  return (
    <section className="relative pt-8 md:pt-12 pb-16 md:pb-24">
      <Container size="xl">
        <div className="grid lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-7 min-w-0 flex flex-col gap-6 md:gap-8 bg-surface rounded-2xl p-8 md:p-12 lg:p-16 border border-line">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-ink-muted">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              {t('hero_eyebrow')}
            </div>
            {/* Gate the headline on the landing query so the i18n fallback
                doesn't flash-swap to CMS copy after load (layout-shift fix).
                On error the fallback renders immediately. */}
            {isLoading ? (
              <div className="flex flex-col gap-4" aria-hidden>
                <div className="flex flex-col gap-3">
                  <Skeleton className="h-10 md:h-12 lg:h-14 w-11/12 rounded-lg" />
                  <Skeleton className="h-10 md:h-12 lg:h-14 w-3/5 rounded-lg" />
                </div>
                <Skeleton className="h-6 md:h-7 w-4/5 max-w-xl rounded-lg" />
              </div>
            ) : (
              <>
                <h1 className="font-display font-semibold text-[40px] md:text-5xl lg:text-6xl leading-[1.05] tracking-tight text-ink [overflow-wrap:anywhere] [hyphens:auto]">
                  {heading}
                </h1>
                <p className="text-lg md:text-xl text-ink-muted leading-relaxed max-w-xl [overflow-wrap:anywhere]">
                  {sub}
                </p>
              </>
            )}
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" variant="accent" className="rounded-pill">
                <Link to="/book">
                  {t('cta_book')}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="rounded-pill">
                <Link to="/services">{t('cta_services')}</Link>
              </Button>
            </div>
          </div>

          <div className="lg:col-span-5 relative rounded-2xl overflow-hidden border border-line min-h-[380px] lg:min-h-[unset]">
            {heroImage ? (
              <img
                src={heroImage}
                alt=""
                className="absolute inset-0 w-full h-full object-cover photo-warm"
              />
            ) : (
              <div className="absolute inset-0">
                <ImageFallback />
              </div>
            )}
            <div className="absolute bottom-4 right-4 left-4 flex items-end justify-between gap-3">
              <div className="bg-bg border border-line rounded-2xl px-4 py-3 max-w-[60%]">
                <p className="text-[11px] uppercase tracking-[0.15em] text-ink-muted mb-1">
                  {t('section_visit_hours_title')}
                </p>
                <p className="text-sm font-medium text-ink leading-snug">
                  {t('section_visit_hours')}
                </p>
              </div>
              <Link
                to="/barbers"
                className="inline-flex items-center justify-center w-12 h-12 rounded-pill bg-accent text-bg hover:bg-ink transition shrink-0"
                aria-label={t('view_all_barbers')}
              >
                <ArrowUpRight className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

function StatBand() {
  const { t } = useTranslation('home');
  const barbers = useBarbers();
  const services = useServices();

  const barberCount = barbers.data?.barbers.length;
  const serviceCount = services.data?.categories?.reduce((sum, c) => sum + c.services.length, 0);

  const dash = '—';

  const cells = [
    {
      value: barbers.isLoading || barberCount === undefined ? dash : String(barberCount),
      label: t('stat_barbers_label'),
    },
    {
      value: services.isLoading || serviceCount === undefined ? dash : String(serviceCount),
      label: t('stat_services_label'),
    },
    { value: t('stat_hours_value'), label: t('stat_hours_label') },
    { value: t('stat_walkins_value'), label: t('stat_walkins_label') },
  ];

  return (
    <section className="border-y border-line bg-surface py-8 md:py-10">
      <Container size="xl">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-line md:divide-x">
          {cells.map((cell, idx) => (
            <div
              key={idx}
              className={cn(
                'flex flex-col items-center text-center px-4 py-4 md:py-0',
                idx % 2 === 1 ? 'border-l border-line md:border-l-0' : '',
                idx >= 2 ? 'border-t border-line md:border-t-0' : '',
              )}
            >
              <span className="font-display text-3xl md:text-4xl text-ink leading-none">
                {cell.value}
              </span>
              <span className="mt-1 text-xs uppercase tracking-[0.15em] text-ink-muted">
                {cell.label}
              </span>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

function Marquee() {
  const { t } = useTranslation('home');
  const items = [
    t('marquee_classic_cuts'),
    t('marquee_hot_towel'),
    t('marquee_beard_sculpts'),
    t('marquee_skin_fades'),
    t('marquee_straight_razor'),
    t('marquee_kids_welcome'),
    t('marquee_walkins'),
    t('marquee_tbilisi'),
  ];
  return (
    <section className="border-y border-line py-5 bg-surface overflow-hidden">
      <div className="marquee-track text-ink-muted text-sm font-medium px-4">
        {/* The second copy exists only for the seamless CSS loop — hide it
            from assistive tech so the list isn't announced twice. */}
        {[0, 1].map((copy) => (
          <div key={copy} aria-hidden={copy === 1} className="flex shrink-0">
            {items.map((it, idx) => (
              <span key={idx} className="flex items-center gap-10 shrink-0 pl-10">
                <span>{it}</span>
                <span className="w-1 h-1 rounded-pill bg-accent" aria-hidden />
              </span>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function ServicesPreview() {
  const { t, i18n } = useTranslation('home');
  const { t: tSvc } = useTranslation('services');
  const { data, isLoading, isError, error, refetch } = useServices();
  const flat = (data?.categories ?? []).flatMap((c) =>
    c.services.map((s) => ({
      ...s,
      category: pickLocalized(c.name, c.name_en, i18n.language),
      _name: pickLocalized(s.name, s.name_en, i18n.language),
      _description: pickLocalized(s.description, s.description_en, i18n.language),
    })),
  );
  // Spec §8: services preview shows the top 4 with prices.
  const featured = flat.slice(0, 4);

  return (
    <section className="py-20 md:py-28">
      <Container size="xl">
        <SectionHead
          eyebrow={t('section_services_title')}
          title={t('section_services_subtitle')}
          right={
            <Link
              to="/services"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-ink hover:text-accent transition"
            >
              {t('view_all_services')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />

        {isLoading ? (
          <SkeletonGrid count={4} className="lg:grid-cols-4" />
        ) : isError ? (
          <SectionError error={error} onRetry={() => refetch()} />
        ) : featured.length === 0 ? (
          <p className="text-ink-muted">{tSvc('no_services')}</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {featured.map((s) => (
              <article
                key={s.id}
                className="group bg-surface border border-line rounded-2xl overflow-hidden flex flex-col hover:border-line-strong hover:shadow-[var(--shadow-soft)] transition"
              >
                <ServiceVisual service={s} />
                <div className="p-6 flex flex-col gap-3 flex-1">
                  <p className="text-xs uppercase tracking-[0.12em] text-accent font-medium">
                    {s.category}
                  </p>
                  <h3 className="font-display text-2xl text-ink tracking-tight">{s._name}</h3>
                  {s._description && (
                    <p className="text-sm text-ink-muted line-clamp-2">{s._description}</p>
                  )}
                  <div className="mt-auto pt-4 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-sm text-ink-muted">
                      <Clock className="h-3.5 w-3.5" />
                      {tSvc('duration', { minutes: s.duration_minutes })}
                    </span>
                    <span className="font-display text-xl text-ink">
                      {tSvc('price', { price: s.price })}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </Container>
    </section>
  );
}

function BarbersPreview() {
  const { t } = useTranslation('home');
  const { t: tBar } = useTranslation('barbers');
  const { data, isLoading, isError, error, refetch } = useBarbers();
  const featured = (data?.barbers ?? []).slice(0, 4);

  return (
    <section className="py-20 md:py-28 bg-surface border-y border-line">
      <Container size="xl">
        <SectionHead
          eyebrow={t('section_barbers_title')}
          title={t('section_barbers_subtitle')}
          right={
            <Link
              to="/barbers"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-ink hover:text-accent transition"
            >
              {t('view_all_barbers')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />

        {isLoading ? (
          <SkeletonGrid count={4} className="lg:grid-cols-4" itemClassName="h-80" />
        ) : isError ? (
          <SectionError error={error} onRetry={() => refetch()} />
        ) : featured.length === 0 ? (
          <p className="text-ink-muted">{tBar('no_barbers')}</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {featured.map((b) => (
              <Link key={b.id} to={`/book?barber=${b.id}`} className="group flex flex-col gap-3">
                <div className="aspect-[4/5] bg-bg rounded-2xl overflow-hidden border border-line">
                  {b.photo ? (
                    <img
                      src={b.photo}
                      alt={`${b.first_name} ${b.last_name}`}
                      className="w-full h-full object-cover photo-warm group-hover:scale-[1.03] transition duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-ink-muted/40 font-display text-7xl">
                      {b.first_name?.[0] ?? '?'}
                    </div>
                  )}
                </div>
                <div className="flex items-start justify-between gap-3 px-1">
                  <div>
                    <h3 className="font-display text-lg text-ink tracking-tight">
                      {b.first_name} {b.last_name}
                    </h3>
                    {b.specialties.length > 0 && (
                      <p className="text-xs text-ink-muted mt-0.5">
                        {b.specialties.map((s) => s.name).join(' · ')}
                      </p>
                    )}
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-accent shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </Container>
    </section>
  );
}

function Gallery() {
  const { t } = useTranslation('home');
  const { data, isLoading, isError } = useLandingContent();
  const images = (data?.gallery_image_urls ?? []).slice(0, 6);
  // While loading, hold layout with a skeleton rather than popping in later.
  const empty = isError || images.length === 0;

  return (
    <section className="py-20 md:py-28">
      <Container size="xl">
        <SectionHead eyebrow={t('section_gallery_title')} title={t('section_gallery_title')} />
        {isLoading ? (
          <Skeleton className="aspect-[16/7] w-full" />
        ) : empty ? (
          // Graceful empty state: keep the section instead of silently
          // vanishing when the CMS has no images (or errored).
          <div className="rounded-2xl border border-line bg-surface aspect-[16/7] flex flex-col items-center justify-center gap-3 text-ink-muted">
            <Scissors className="h-10 w-10 text-ink-muted/40" aria-hidden />
            <p className="text-sm">{t('section_gallery_empty')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
            {images.map((url, i) => (
              <div
                key={url}
                className={`overflow-hidden rounded-2xl border border-line bg-surface ${
                  i === 0
                    ? 'col-span-2 md:col-span-2 md:row-span-2 aspect-[16/12]'
                    : 'aspect-square'
                }`}
              >
                <img
                  src={url}
                  alt=""
                  className="w-full h-full object-cover photo-warm hover:scale-[1.04] transition duration-500"
                />
              </div>
            ))}
          </div>
        )}
      </Container>
    </section>
  );
}

function VisitBand() {
  const { t } = useTranslation('home');
  const { data } = useLandingContent();
  // Address comes from the /landing/ business block with a locale fallback.
  const business = useBusinessInfo();
  // Reuse a CMS lifestyle image when available; otherwise a brand-safe
  // placeholder — no third-party (unsplash) runtime dependency.
  const visitImage = data?.gallery_image_urls?.[0] || data?.hero_image_url || null;
  return (
    <section className="py-20 md:py-28 bg-surface border-t border-line">
      <Container size="xl">
        <div className="grid md:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div className="flex flex-col gap-5">
            <p className="text-xs uppercase tracking-[0.18em] text-accent font-medium">
              {t('section_visit_title')}
            </p>
            <h2 className="font-display font-semibold text-3xl md:text-4xl lg:text-5xl text-ink leading-tight tracking-tight [overflow-wrap:anywhere]">
              {business.address}
            </h2>
            <div className="flex flex-col gap-3 mt-3">
              <Row icon={<Clock className="h-5 w-5" />}>
                <p className="font-medium text-ink">{t('section_visit_hours_title')}</p>
                <p className="text-ink-muted text-sm">{t('section_visit_hours')}</p>
                <p className="text-ink-muted text-sm">{t('section_visit_closed')}</p>
              </Row>
              <Row icon={<MapPin className="h-5 w-5" />}>
                <p className="text-ink-muted">{business.address}</p>
              </Row>
              <Row icon={<Calendar className="h-5 w-5" />}>
                <p className="text-ink-muted">{t('section_visit_walkins')}</p>
              </Row>
            </div>
            <div className="mt-6">
              <Button asChild size="lg" variant="accent" className="rounded-pill">
                <Link to="/book">
                  {t('cta_book')}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
          {/* Spec §8: Google Maps embed via the /landing/ setting. Lazy-loaded
              inside the existing 1px-line frame; when no embed URL is set the
              band gracefully keeps its CMS photo / brand placeholder. */}
          <div className="aspect-[4/5] md:aspect-[4/3] bg-bg border border-line rounded-2xl overflow-hidden">
            {business.mapEmbedUrl ? (
              <iframe
                src={business.mapEmbedUrl}
                title={t('map_title')}
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
                className="h-full w-full border-0"
              />
            ) : visitImage ? (
              <img src={visitImage} alt="" className="w-full h-full object-cover photo-warm" />
            ) : (
              <ImageFallback />
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}

function SectionHead({
  eyebrow,
  title,
  right,
}: {
  eyebrow: string;
  title?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10 md:mb-14">
      <div>
        <p
          className={cn(
            'text-xs uppercase tracking-[0.18em] text-accent font-medium',
            title ? 'mb-3' : '',
          )}
        >
          {eyebrow}
        </p>
        {title && (
          <h2 className="font-display font-semibold text-3xl md:text-4xl lg:text-5xl text-ink leading-tight tracking-tight max-w-2xl [overflow-wrap:anywhere]">
            {title}
          </h2>
        )}
      </div>
      {right}
    </div>
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

function ServiceVisual({ service }: { service: Pick<ServiceItem, 'image' | 'icon_key'> }) {
  const aspect = 'aspect-[16/9]';
  if (service.image) {
    return (
      <div className={cn('w-full bg-bg', aspect)}>
        <img
          src={service.image}
          alt=""
          className="w-full h-full object-cover photo-warm"
          loading="lazy"
        />
      </div>
    );
  }
  if (service.icon_key) {
    const def = SERVICE_ICONS.find((i) => i.key === service.icon_key);
    if (def) {
      const Icon = def.Icon;
      return (
        // Accent stays an accent: icon in accent on the page-bg tone, not an
        // accent-soft slab (brand rule: accent-soft is never a large fill).
        <div
          className={cn(
            'w-full bg-bg border-b border-line flex items-center justify-center text-accent',
            aspect,
          )}
        >
          <Icon className="h-12 w-12" />
        </div>
      );
    }
  }
  return (
    <div
      className={cn('w-full bg-line/30 flex items-center justify-center text-ink-muted', aspect)}
    >
      <Scissors className="h-10 w-10" />
    </div>
  );
}
