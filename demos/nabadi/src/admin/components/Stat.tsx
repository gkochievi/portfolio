import { cn } from '@/lib/cn';

const VARIANTS = {
  default: 'bg-surface border-line text-ink',
  ink: 'bg-ink text-bg border-ink',
  accent: 'bg-accent-soft border-accent-soft text-ink',
  success: 'bg-success/10 border-success/20 text-success',
  danger: 'bg-danger/10 border-danger/20 text-danger',
} as const;

interface Props {
  label: string;
  value: number | string;
  variant?: keyof typeof VARIANTS;
}

export function Stat({ label, value, variant = 'default' }: Props) {
  return (
    <div className={cn('rounded-xl border px-3 py-2.5 flex flex-col gap-0.5', VARIANTS[variant])}>
      <span
        className={cn(
          'text-[10px] uppercase tracking-[0.12em] font-medium',
          /* success/danger keep full-strength tinted text — opacity-70 drags
             them to ~2.7–2.9:1, far below the 4.5:1 AA floor at 10px. */
          variant === 'ink' && 'text-bg/60',
          (variant === 'default' || variant === 'accent') && 'opacity-70',
        )}
      >
        {label}
      </span>
      <span className="font-display text-xl font-semibold tabular-nums leading-none">{value}</span>
    </div>
  );
}
