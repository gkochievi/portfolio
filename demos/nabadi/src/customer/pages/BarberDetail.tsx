import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowUpRight, Clock } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Container } from '@/components/Container';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { Skeleton } from '@/components/Skeleton';
import { SectionError } from '@/components/SectionError';
import { useBarbers, type BarberItem } from '@/features/booking/hooks';
import { useBookingWizard } from '@/features/booking/store';
import { pickLocalized } from '@/lib/localized';
import { formatMoney } from '@/lib/datetime';

/**
 * /barbers/:id — spec §8: bio + offered services + "Book with this barber".
 * Everything needed already ships in the public /barbers/ payload (photo,
 * bio, specialties, per-barber services with prices), so this reuses the
 * cached useBarbers() query rather than adding a detail endpoint.
 */
export function BarberDetail() {
  const { t, i18n } = useTranslation('barbers');
  const { t: tSvc } = useTranslation('services');
  const { id } = useParams();
  const { data, isLoading, isError, error, refetch } = useBarbers();
  const navigate = useNavigate();
  const setBarber = useBookingWizard((s) => s.setBarber);

  const barber = data?.barbers.find((b) => b.id === Number(id));

  const onBook = (b: BarberItem) => {
    // Same behavior as the Barbers grid: pin the barber (dropping a stale
    // service they don't offer, or re-quoting a kept one at their own
    // price/duration) and open the wizard on the service step.
    setBarber(
      { id: b.id, first_name: b.first_name, last_name: b.last_name },
      b.services,
    );
    navigate('/book');
  };

  return (
    <Layout>
      <Container size="xl" className="py-12 md:py-20">
        <Link
          to="/barbers"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink transition mb-8"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {t('back_to_all')}
        </Link>

        {isLoading && (
          <div className="grid md:grid-cols-[minmax(0,380px)_1fr] gap-8 lg:gap-14">
            <Skeleton className="aspect-[4/5]" />
            <div className="flex flex-col gap-4">
              <Skeleton className="h-12 w-2/3 rounded-lg" />
              <Skeleton className="h-24 rounded-lg" />
              <Skeleton className="h-40 rounded-lg" />
            </div>
          </div>
        )}
        {isError && <SectionError error={error} onRetry={() => refetch()} />}
        {data && !barber && (
          <div className="bg-surface border border-line rounded-2xl p-10 text-center flex flex-col items-center gap-4">
            <p className="text-ink-muted">{t('not_found')}</p>
            <Button asChild variant="secondary" className="rounded-pill">
              <Link to="/barbers">{t('back_to_all')}</Link>
            </Button>
          </div>
        )}

        {barber && (
          <div className="grid md:grid-cols-[minmax(0,380px)_1fr] gap-8 lg:gap-14 items-start">
            <div className="aspect-[4/5] bg-surface border border-line rounded-2xl overflow-hidden">
              {barber.photo ? (
                <img
                  src={barber.photo}
                  alt={`${barber.first_name} ${barber.last_name}`}
                  className="w-full h-full object-cover photo-warm"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-ink-muted/40 font-display text-8xl">
                  {barber.first_name?.[0] ?? '?'}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-6 min-w-0">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-accent font-medium mb-3">
                  {t('title')}
                </p>
                <h1 className="font-display font-semibold text-4xl md:text-5xl text-ink leading-[1.05] tracking-tight [overflow-wrap:anywhere]">
                  {barber.first_name} {barber.last_name}
                </h1>
              </div>

              {barber.specialties.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {barber.specialties.map((s) => (
                    <Badge key={s.id}>{s.name}</Badge>
                  ))}
                </div>
              )}

              {barber.bio && (
                <p className="text-lg text-ink-muted leading-relaxed max-w-2xl whitespace-pre-line">
                  {barber.bio}
                </p>
              )}

              <section className="flex flex-col gap-3">
                <h2 className="text-xs uppercase tracking-[0.2em] text-accent font-medium">
                  {t('services_heading')}
                </h2>
                {barber.services.length === 0 ? (
                  <p className="text-sm text-ink-muted">{t('no_services_for_barber')}</p>
                ) : (
                  <ul className="bg-surface border border-line rounded-2xl divide-y divide-line">
                    {barber.services.map((s) => (
                      <li key={s.id} className="flex items-center gap-4 px-5 py-3.5">
                        <span className="flex-1 min-w-0 text-ink font-medium [overflow-wrap:anywhere]">
                          {pickLocalized(s.name, s.name_en, i18n.language)}
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-sm text-ink-muted shrink-0">
                          <Clock className="h-3.5 w-3.5" aria-hidden />
                          {tSvc('duration', { minutes: s.duration_minutes })}
                        </span>
                        <span className="font-display text-lg text-ink tabular-nums shrink-0">
                          {formatMoney(s.price, i18n.language)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <Button
                onClick={() => onBook(barber)}
                size="lg"
                variant="accent"
                className="self-start rounded-pill"
              >
                {t('book_with', { name: barber.first_name })}
                <ArrowUpRight className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </div>
        )}
      </Container>
    </Layout>
  );
}
