import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

interface Props {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/**
 * Brand-styled prev/next pager with a "page X of Y" indicator.
 * Renders nothing when everything fits on one page.
 */
export function Pager({ page, pageCount, onPageChange, className }: Props) {
  const { t } = useTranslation('admin');
  if (pageCount <= 1) return null;

  const hasPrev = page > 1;
  const hasNext = page < pageCount;

  const btn = (enabled: boolean) =>
    cn(
      'inline-flex items-center justify-center w-9 h-9 rounded-pill border transition',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
      enabled
        ? 'bg-surface text-ink border-line hover:border-line-strong'
        : 'bg-surface text-ink-muted/50 border-line cursor-not-allowed',
    );

  return (
    <nav
      aria-label={t('pager.label')}
      className={cn('flex items-center justify-center gap-3', className)}
    >
      <button
        type="button"
        onClick={() => hasPrev && onPageChange(page - 1)}
        disabled={!hasPrev}
        aria-label={t('pager.prev')}
        className={btn(hasPrev)}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </button>
      <span aria-current="page" className="text-sm text-ink-muted tabular-nums">
        {t('pager.page_of', { page, pages: pageCount })}
      </span>
      <button
        type="button"
        onClick={() => hasNext && onPageChange(page + 1)}
        disabled={!hasNext}
        aria-label={t('pager.next')}
        className={btn(hasNext)}
      >
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
    </nav>
  );
}
