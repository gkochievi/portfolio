import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
}

export function Card({ className, elevated = false, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'bg-surface border border-line rounded-lg p-6',
        elevated && 'shadow-[var(--shadow-soft)]',
        className,
      )}
      {...props}
    />
  );
}
