import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface Props {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ eyebrow, title, subtitle, actions, className }: Props) {
  return (
    <header
      className={cn('flex flex-col md:flex-row md:items-end md:justify-between gap-3', className)}
    >
      <div>
        {eyebrow && (
          <p className="text-xs uppercase tracking-[0.18em] text-accent font-medium mb-2">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display font-semibold text-3xl md:text-4xl text-ink leading-tight tracking-tight">
          {title}
        </h1>
        {subtitle && <p className="text-sm text-ink-muted mt-1">{subtitle}</p>}
      </div>
      {actions}
    </header>
  );
}
