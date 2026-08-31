import { cn } from '@/lib/cn';

type Size = 'xs' | 'sm' | 'md' | 'lg';

// Heights tuned for the square brand mark (the cape silhouette and the
// "NABADI BARBERSHOP" wordmark stacked, 1:1 aspect). Width auto-scales.
const SIZES: Record<Size, string> = {
  xs: 'h-10',
  sm: 'h-12',
  md: 'h-16',
  lg: 'h-24',
};

/**
 * Upstream this is `<img src="/brand/logo.png">` — a root-absolute path to a
 * photographic mark, which would 404 under the demo's base path even before the
 * question of whose shop it is. Here it is a drawn SVG for an invented brand,
 * addressed through the build's base.
 */
export function Logo({
  size = 'md',
  className,
  iconOnly = false,
}: {
  size?: Size;
  className?: string;
  /** Drop the wordmark and show the cloak symbol alone. */
  iconOnly?: boolean;
}) {
  // iconOnly was previously accepted and ignored, so the collapsed sidebar
  // rendered the whole stacked lockup at h-12 — at that height the
  // "BARBERSHOP" line is a ~4px cap on a sub-pixel stroke and reads as a
  // smear. Below the lockup's minimum the wordmark is dropped, not shrunk.
  const symbolOnly = iconOnly || size === 'xs';
  return (
    <img
      src={`${import.meta.env.BASE_URL}brand/${symbolOnly ? 'logo-symbol' : 'logo'}.svg`}
      alt="Nabadi Barbershop"
      className={cn('w-auto select-none', SIZES[size], className)}
      draggable={false}
    />
  );
}
