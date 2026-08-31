import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  children: ReactNode;
}

export function Chip({ active, children, className, ...props }: Props) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center gap-1.5 text-sm font-medium px-4 py-1.5 rounded-pill border transition',
        active
          ? 'bg-ink text-bg border-ink'
          : 'bg-surface text-ink-muted border-line hover:border-line-strong hover:text-ink',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
