import { cn } from '@/lib/cn';

type Size = 'xs' | 'sm' | 'md' | 'lg';

// Heights tuned for the square brand mark (the cape silhouette and the
// "NABADI BARBERSHOP" wordmark stacked, 1:1 aspect). Width auto-scales.
const SIZES: Record<Size, string> = {
  xs: 'h-10',
  sm: 'h-14',
  md: 'h-20',
  lg: 'h-32',
};

interface Props {
  size?: Size;
  className?: string;
  /** Drop the wordmark and show the cloak symbol alone. */
  withMark?: boolean;
}

// The stacked lockup needs roughly 64px of height before its "BARBERSHOP" line
// resolves; at h-10 that line is a 3.3px cap on a 0.66px stroke and smears. So
// xs (and any explicit withMark={false}) swap to the symbol-only mark, which is
// the same 1:1 box and needs no layout change.

/**
 * Upstream this is `<img src="/brand/logo.png">` — a root-absolute path to a
 * photographic mark, which would 404 under the demo's base path even before the
 * question of whose shop it is. Here it is a drawn SVG for an invented brand,
 * addressed through the build's base.
 */
export function Logo({ size = 'md', className, withMark = true }: Props) {
  const symbolOnly = !withMark || size === 'xs';
  return (
    <img
      src={`${import.meta.env.BASE_URL}brand/${symbolOnly ? 'logo-symbol' : 'logo'}.svg`}
      alt="Nabadi Barbershop"
      className={cn('w-auto select-none', SIZES[size], className)}
      draggable={false}
    />
  );
}
