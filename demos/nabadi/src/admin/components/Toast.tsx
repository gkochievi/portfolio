import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { ToastContext, type ToastApi, type ToastVariant } from './toast-context';

interface ToastItem {
  id: number;
  variant: ToastVariant;
  message: string;
}

const AUTO_DISMISS_MS: Record<ToastVariant, number> = {
  success: 4000,
  error: 7000,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation('common');
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback((variant: ToastVariant, message: string) => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, variant, message }]);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => push('success', message),
      error: (message) => push('error', message),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* aria-live=polite: screen readers announce new toasts without interrupting. */}
      <div
        role="region"
        aria-label={t('notifications')}
        aria-live="polite"
        className="fixed bottom-4 right-4 z-[70] flex flex-col items-end gap-2 pointer-events-none"
      >
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function Toast({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const { t } = useTranslation('common');

  useEffect(() => {
    const id = setTimeout(onDismiss, AUTO_DISMISS_MS[toast.variant]);
    return () => clearTimeout(id);
    // onDismiss is stable per toast id (parent filters by id).
  }, [toast.variant, onDismiss]);

  return (
    <div
      role="status"
      className={cn(
        'pointer-events-auto flex items-start gap-3 min-w-[260px] max-w-sm',
        'bg-surface border border-line rounded-lg px-4 py-3 shadow-[var(--shadow-pop)]',
      )}
    >
      {toast.variant === 'success' ? (
        <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" aria-hidden />
      ) : (
        <AlertCircle className="h-5 w-5 text-danger shrink-0 mt-0.5" aria-hidden />
      )}
      <p className="flex-1 text-sm text-ink">{toast.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t('dismiss')}
        className="inline-flex items-center justify-center w-6 h-6 rounded-pill text-ink-muted hover:bg-line/60 hover:text-ink transition shrink-0"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}
