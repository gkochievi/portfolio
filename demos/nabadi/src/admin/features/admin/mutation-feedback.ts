import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/components/toast-context';
import { ApiError } from '@/lib/api';

/**
 * Standard success/error feedback for admin mutations.
 *
 * - `saved` / `created` / `deleted` fire the generic success toasts.
 * - `success(key)` fires a toast with a specific admin-namespace key
 *   (e.g. 'toast.booking_confirmed').
 * - `error(err)` translates the backend error code (same mapping as
 *   <ErrorMessage>) so no mutation failure is ever silent.
 */
export function useMutationFeedback() {
  const toast = useToast();
  const { t } = useTranslation(['admin', 'errors']);

  return useMemo(
    () => ({
      saved: () => toast.success(t('admin:toast.saved')),
      created: () => toast.success(t('admin:toast.created')),
      deleted: () => toast.success(t('admin:toast.deleted')),
      success: (key: string) => toast.success(t(`admin:${key}`)),
      error: (err: unknown) => {
        const message =
          err instanceof ApiError
            ? t(`errors:${err.code}`, { defaultValue: err.message })
            : t('errors:unknown');
        toast.error(message);
      },
    }),
    [toast, t],
  );
}
