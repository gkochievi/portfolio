import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Clock, Scissors } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Container } from '@/components/Container';
import { Button } from '@/components/Button';
import { SkeletonGrid } from '@/components/Skeleton';
import { SectionError } from '@/components/SectionError';
import { useServices, type ServiceItem } from '@/features/booking/hooks';
import { useBookingWizard } from '@/features/booking/store';
import { pickLocalized } from '@/lib/localized';
import { SERVICE_ICONS } from '@/lib/serviceIcons';
import { cn } from '@/lib/cn';

export function Services() {
  const { t, i18n } = useTranslation('services');
  const { data, isLoading, isError, error, refetch } = useServices();
  const navigate = useNavigate();
  const setService = useBookingWizard((s) => s.setService);

  const onChoose = (svc: ServiceItem) => {
    setService({
      id: svc.id,
      name: svc.name,
      name_en: svc.name_en,
      duration_minutes: svc.duration_minutes,
      price: svc.price,
    });
    navigate('/book');
  };

  return (
    <Layout>
      <Container size="xl" className="py-12 md:py-20">
        <header className="mb-12 md:mb-16 max-w-3xl">
          <p className="text-xs uppercase tracking-[0.18em] text-accent font-medium mb-3">
            {t('title')}
          </p>
          <h1 className="font-display font-semibold text-4xl md:text-5xl lg:text-6xl text-ink leading-[1.05] tracking-tight mb-5 [overflow-wrap:anywhere]">
            {t('title')}
          </h1>
          <p className="text-lg text-ink-muted">{t('subtitle')}</p>
        </header>

        {isLoading && <SkeletonGrid count={6} />}
        {isError && <SectionError error={error} onRetry={() => refetch()} />}
        {data && data.categories.length === 0 && (
          <p className="text-ink-muted">{t('no_services')}</p>
        )}

        <div className="flex flex-col gap-12">
          {data?.categories.map((cat) => (
            <section key={cat.id} className="flex flex-col gap-5">
              <div className="flex items-baseline justify-between">
                <h2 className="font-display font-semibold text-3xl md:text-4xl text-ink tracking-tight">
                  {pickLocalized(cat.name, cat.name_en, i18n.language)}
                </h2>
                <span className="text-xs uppercase tracking-[0.15em] text-ink-muted">
                  {t('service_count', { count: cat.services.length })}
                </span>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {cat.services.map((s) => (
                  <article
                    key={s.id}
                    className="group flex flex-col bg-surface border border-line rounded-2xl overflow-hidden hover:border-line-strong hover:shadow-[var(--shadow-soft)] transition"
                  >
                    <ServiceVisual service={s} />
                    <div className="flex flex-col gap-3 p-6 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className="font-display text-xl text-ink tracking-tight">
                          {pickLocalized(s.name, s.name_en, i18n.language)}
                        </h3>
                        <span className="font-display text-xl text-ink shrink-0">
                          {t('price', { price: s.price })}
                        </span>
                      </div>
                      {(s.description || s.description_en) && (
                        <p className="text-sm text-ink-muted line-clamp-3">
                          {pickLocalized(s.description, s.description_en, i18n.language)}
                        </p>
                      )}
                      <div className="mt-auto pt-4 flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 text-sm text-ink-muted">
                          <Clock className="h-3.5 w-3.5" />
                          {t('duration', { minutes: s.duration_minutes })}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onChoose(s)}
                          className="rounded-pill -mr-2"
                        >
                          {t('book_now')}
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </Container>
    </Layout>
  );
}

function ServiceVisual({ service, className }: { service: ServiceItem; className?: string }) {
  const aspect = 'aspect-[16/9]';
  if (service.image) {
    return (
      <div className={cn('w-full bg-bg', aspect, className)}>
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
        // Accent-soft is never a large fill — icon carries the accent instead.
        <div
          className={cn(
            'w-full bg-bg border-b border-line flex items-center justify-center text-accent',
            aspect,
            className,
          )}
        >
          <Icon className="h-12 w-12" />
        </div>
      );
    }
  }
  return (
    <div
      className={cn(
        'w-full bg-line/30 flex items-center justify-center text-ink-muted',
        aspect,
        className,
      )}
    >
      <Scissors className="h-10 w-10" />
    </div>
  );
}
