import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Star } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { Pager } from '@/components/Pager';
import { SectionError } from '@/components/SectionError';
import { ConfirmDialog } from '@/features/admin/components/ConfirmDialog';
import { useAdminBarbers } from '@/features/admin/hooks';
import {
  useAdminDeleteReview,
  useAdminPublishReview,
  useAdminReviews,
  useAdminUnpublishReview,
  type AdminReview,
  type ReviewsFilters,
} from '@/features/admin/reviews-hooks';
import { pageCount, usePageState } from '@/lib/paginated';
import { cn } from '@/lib/cn';
import { formatTbilisiDate, formatTbilisiDateTime } from '@/lib/datetime';

/** Published-state scopes. Default = moderation queue (unpublished). */
type Scope = 'queue' | 'published' | 'all';

const SCOPE_TO_PARAM: Record<Scope, ReviewsFilters['is_published']> = {
  queue: 'false',
  published: 'true',
  all: undefined,
};

export function AdminReviews() {
  const { t } = useTranslation('admin');
  const [scope, setScope] = useState<Scope>('queue');
  const [barberId, setBarberId] = useState<number | null>(null);
  const [rating, setRating] = useState<number | null>(null);

  const filters: ReviewsFilters = {
    is_published: SCOPE_TO_PARAM[scope],
    barber_id: barberId ?? undefined,
    rating: rating ?? undefined,
  };
  const [page, setPage] = usePageState(JSON.stringify(filters));
  const reviews = useAdminReviews(filters, page);
  const barbers = useAdminBarbers();

  const items: AdminReview[] = reviews.data?.results ?? [];
  const pages = pageCount(reviews.data?.count ?? 0);

  const select =
    'h-11 px-3.5 bg-surface-2 border border-line rounded-md text-[15px] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={t('page.reviews')}
        title={t('page.reviews')}
        subtitle={t('reviews_page.subtitle')}
      />

      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Chip active={scope === 'queue'} onClick={() => setScope('queue')}>
              {t('reviews_page.scope_queue')}
            </Chip>
            <Chip active={scope === 'published'} onClick={() => setScope('published')}>
              {t('reviews_page.scope_published')}
            </Chip>
            <Chip active={scope === 'all'} onClick={() => setScope('all')}>
              {t('reviews_page.scope_all')}
            </Chip>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink">{t('reviews_page.f_barber')}</span>
              <select
                value={barberId ?? ''}
                onChange={(e) => setBarberId(e.target.value ? Number(e.target.value) : null)}
                className={select}
              >
                <option value="">{t('reviews_page.all_barbers')}</option>
                {(barbers.data ?? []).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.user_first_name} {b.user_last_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink">{t('reviews_page.f_rating')}</span>
              <select
                value={rating ?? ''}
                onChange={(e) => setRating(e.target.value ? Number(e.target.value) : null)}
                className={select}
              >
                <option value="">{t('reviews_page.all_ratings')}</option>
                {[5, 4, 3, 2, 1].map((r) => (
                  <option key={r} value={r}>
                    {t('reviews_page.stars_option', { rating: r })}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </Card>

      {reviews.isError ? (
        <SectionError error={reviews.error} onRetry={() => reviews.refetch()} />
      ) : reviews.isLoading ? (
        <Card>
          <p role="status" aria-live="polite" className="text-ink-muted text-sm">
            {t('actions.loading')}
          </p>
        </Card>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Star className="h-5 w-5" />}
          title={
            scope === 'queue' ? t('reviews_page.empty_queue_title') : t('reviews_page.empty_title')
          }
          hint={scope === 'queue' ? t('reviews_page.empty_queue_hint') : undefined}
        />
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {items.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
          <Pager page={page} pageCount={pages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}

function Stars({ rating }: { rating: number }) {
  const { t } = useTranslation('admin');
  return (
    <span
      className="inline-flex items-center gap-0.5"
      role="img"
      aria-label={t('reviews_page.stars_label', { rating })}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          aria-hidden
          className={cn('h-4 w-4', i <= rating ? 'text-accent fill-accent' : 'text-line-strong')}
        />
      ))}
    </span>
  );
}

function ReviewCard({ review }: { review: AdminReview }) {
  const { t } = useTranslation('admin');
  const publish = useAdminPublishReview();
  const unpublish = useAdminUnpublishReview();
  const del = useAdminDeleteReview();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const onConfirmDelete = async () => {
    if (del.isPending) return;
    try {
      await del.mutateAsync(review.id);
      setConfirmDelete(false);
    } catch {
      /* surfaced via toast */
    }
  };

  return (
    <article className="bg-surface border border-line rounded-lg p-5 flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <Stars rating={review.rating} />
        <Badge variant={review.is_published ? 'success' : 'default'}>
          {review.is_published
            ? t('reviews_page.published_badge')
            : t('reviews_page.unpublished_badge')}
        </Badge>
        <span className="text-xs text-ink-muted tabular-nums ml-auto">
          {formatTbilisiDateTime(review.created_at)}
        </span>
      </div>

      {review.text ? (
        <p className="text-[15px] text-ink leading-relaxed">{review.text}</p>
      ) : (
        <p className="text-sm text-ink-muted italic">{t('reviews_page.no_text')}</p>
      )}

      <div className="text-xs text-ink-muted flex items-center gap-2 flex-wrap border-t border-line pt-3">
        <span className="text-ink font-medium">{review.customer_name}</span>
        <span aria-hidden>·</span>
        <span dir="ltr">{review.customer_phone}</span>
        <span aria-hidden>·</span>
        <span>{review.barber_name}</span>
        <span aria-hidden>·</span>
        <span>{review.service_name}</span>
        <span aria-hidden>·</span>
        <span className="tabular-nums">
          {formatTbilisiDate(review.booking_start_at)}
        </span>
        <div className="flex gap-2 ml-auto">
          {review.is_published ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => unpublish.mutate(review.id)}
              loading={unpublish.isPending}
              className="rounded-pill"
            >
              {t('reviews_page.unpublish')}
            </Button>
          ) : (
            <Button
              variant="accent"
              size="sm"
              onClick={() => publish.mutate(review.id)}
              loading={publish.isPending}
              className="rounded-pill"
            >
              {t('reviews_page.publish')}
            </Button>
          )}
          <Button
            variant="danger"
            size="sm"
            onClick={() => setConfirmDelete(true)}
            className="rounded-pill"
          >
            {t('actions.delete')}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={(o) => !o && !del.isPending && setConfirmDelete(false)}
        title={t('reviews_page.delete_confirm')}
        body={t('reviews_page.delete_body')}
        confirmLabel={t('actions.confirm_delete')}
        cancelLabel={t('actions.cancel')}
        destructive
        loading={del.isPending}
        onConfirm={onConfirmDelete}
      />
    </article>
  );
}
