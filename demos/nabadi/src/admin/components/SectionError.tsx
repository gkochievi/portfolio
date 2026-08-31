import { useTranslation } from 'react-i18next';
import { RotateCw } from 'lucide-react';
import { Button } from './Button';
import { ErrorMessage } from './ErrorMessage';

/**
 * "Failed to load" state for a data section. Surfaces the API error via
 * <ErrorMessage> and offers a retry button wired to the query's refetch().
 * Distinct from the genuinely-empty state, which callers render separately.
 * (Adapted from the customer app's SectionError.)
 */
export function SectionError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation('common');
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-2xl border border-line bg-surface p-6"
    >
      <p className="font-medium text-ink">{t('load_failed')}</p>
      <ErrorMessage error={error} />
      <Button variant="secondary" size="sm" onClick={onRetry} className="rounded-pill">
        <RotateCw className="h-4 w-4" />
        {t('retry')}
      </Button>
    </div>
  );
}
