import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Container } from '@/components/Container';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { SkeletonGrid } from '@/components/Skeleton';
import { SectionError } from '@/components/SectionError';
import { useBarbers, type BarberItem } from '@/features/booking/hooks';
import { useBookingWizard } from '@/features/booking/store';

export function Barbers() {
  const { t } = useTranslation('barbers');
  const { data, isLoading, isError, error, refetch } = useBarbers();
  const navigate = useNavigate();
  const setBarber = useBookingWizard((s) => s.setBarber);

  const onChoose = (b: BarberItem) => {
    // Passing the barber's service menu lets the store drop a stale persisted
    // service this barber doesn't offer — or re-quote a kept one at this
    // barber's own price/duration; with no service selected it pins the
    // barber and opens the wizard on the service step.
    setBarber(
      { id: b.id, first_name: b.first_name, last_name: b.last_name },
      b.services,
    );
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

        {isLoading && <SkeletonGrid count={6} itemClassName="h-96" />}
        {isError && <SectionError error={error} onRetry={() => refetch()} />}
        {data && data.barbers.length === 0 && <p className="text-ink-muted">{t('no_barbers')}</p>}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {data?.barbers.map((b) => (
            <article
              key={b.id}
              className="bg-surface border border-line rounded-2xl overflow-hidden flex flex-col group hover:shadow-[var(--shadow-soft)] transition"
            >
              {/* Photo + name click through to the /barbers/:id detail page. */}
              <Link
                to={`/barbers/${b.id}`}
                className="block aspect-[4/5] bg-bg overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                aria-label={`${b.first_name} ${b.last_name}`}
              >
                {b.photo ? (
                  <img
                    src={b.photo}
                    alt=""
                    className="w-full h-full object-cover photo-warm group-hover:scale-[1.04] transition duration-700"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-ink-muted/40 font-display text-7xl">
                    {b.first_name?.[0] ?? '?'}
                  </div>
                )}
              </Link>
              <div className="p-6 flex flex-col gap-3">
                <h2 className="font-display text-2xl text-ink tracking-tight">
                  <Link to={`/barbers/${b.id}`} className="hover:text-accent transition">
                    {b.first_name} {b.last_name}
                  </Link>
                </h2>
                {b.specialties.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {b.specialties.map((s) => (
                      <Badge key={s.id} variant="default">
                        {s.name}
                      </Badge>
                    ))}
                  </div>
                )}
                {b.bio && <p className="text-sm text-ink-muted line-clamp-3">{b.bio}</p>}
                <div className="flex flex-wrap items-center gap-3 mt-2">
                  <Button
                    onClick={() => onChoose(b)}
                    size="md"
                    variant="primary"
                    className="rounded-pill"
                  >
                    {t('book_with', { name: b.first_name })}
                    <ArrowUpRight className="h-4 w-4" aria-hidden />
                  </Button>
                  <Link
                    to={`/barbers/${b.id}`}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-accent transition"
                  >
                    {t('view_profile')}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </Container>
    </Layout>
  );
}
