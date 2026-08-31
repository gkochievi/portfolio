import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';

/**
 * A single 1px-line placeholder box. No shadow, no gradient — brand-safe.
 * Use to reserve layout space while a section's data loads so content
 * doesn't pop in.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded-2xl border border-line bg-surface', className)}
    />
  );
}

/**
 * A grid of card-shaped skeletons matching the listing layouts on the
 * Services / Barbers / Home pages. Announced politely to assistive tech.
 */
export function SkeletonGrid({
  count = 6,
  className,
  itemClassName,
}: {
  count?: number;
  className?: string;
  itemClassName?: string;
}) {
  const { t } = useTranslation('common');
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={t('loading')}
      className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3', className)}
    >
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={cn('h-64', itemClassName)} />
      ))}
      <span className="sr-only">{t('loading')}</span>
    </div>
  );
}
