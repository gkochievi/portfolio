import type { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const badgeVariants = cva(
  'inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-pill',
  {
    variants: {
      variant: {
        /* text-ink (not ink-muted) — ink-muted on the line fill is ~4.1:1,
           below AA at badge size. */
        default: 'bg-line text-ink',
        accent: 'bg-accent-soft text-ink',
        ink: 'bg-ink text-bg',
        success: 'bg-success/10 text-success',
        danger: 'bg-danger/10 text-danger',
        outline: 'border border-line text-ink-muted',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
