import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, hint, error, className, id, ...props },
  ref,
) {
  const { t } = useTranslation('errors');
  const reactId = useId();
  const inputId = id || reactId;
  return (
    <label htmlFor={inputId} className="flex flex-col gap-1.5 w-full">
      {label && <span className="text-sm font-medium text-ink">{label}</span>}
      <input
        ref={ref}
        id={inputId}
        className={cn(
          'h-11 px-3.5 bg-surface-2 border border-line rounded-md text-[15px] text-ink',
          'placeholder:text-ink-muted/60',
          'focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15',
          'transition',
          error && 'border-danger focus:border-danger focus:ring-danger/15',
          className,
        )}
        {...props}
      />
      {hint && !error && <span className="text-xs text-ink-muted">{hint}</span>}
      {error && <span className="text-xs text-danger">{t(error, { defaultValue: error })}</span>}
    </label>
  );
});
