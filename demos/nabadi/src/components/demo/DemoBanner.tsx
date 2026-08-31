import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, ChevronUp, RotateCcw, X } from 'lucide-react';

import { dispatch } from '../../demo/router';
import { resetStore, currentUser } from '../../demo/store';
import { goToSurface, type SurfaceName } from '../../surface';

/**
 * The one piece of chrome that is not part of the original product: it says what
 * this is, and it hands over the credentials.
 *
 * It lives outside both routers — mounted beside `<App/>` in each surface entry —
 * because it has to keep working on a route the router does not recognise, and
 * because signing in has to survive the remount that crossing surfaces causes.
 *
 * It imports nothing from either ported tree. `@/` means a different directory
 * depending on which surface is asking, so this file uses relative imports only
 * and writes its own classes against the design tokens in `index.css`, which
 * both surfaces load.
 */

/**
 * Resolved against the build's base rather than the current route, so it points
 * at the portfolio from `/book` and `/admin/bookings/` alike. A demo served at a
 * domain root has no portfolio above it and lands back on itself, which is the
 * honest answer for that deployment.
 */
const PORTFOLIO_URL = new URL('../../', new URL(import.meta.env.BASE_URL, window.location.href))
  .href;

interface Account {
  key: string;
  phone: string;
  /** Where this account belongs. Signing in takes you there. */
  surface: SurfaceName;
}

/**
 * The two accounts the banner offers. Nobody can guess credentials that live in
 * a seed file, so this is the only way in — which is also why it signs you in
 * through the real login endpoint rather than writing the session directly. The
 * password check and the role gate are exercised exactly as the app exercises
 * them.
 *
 * Two buttons is also the whole cast. `admin` is the only role the console
 * admits and `customer` is the only role the customer site has, so there is no
 * third account left worth offering. The seed still tags its barbers with a
 * `barber` role, but that is a data tag on the user rows behind the barbers
 * table — it is what keeps them out of the customers list without handing them
 * the console — and a barber who reaches the console's own login page is turned
 * away at /unauthorized like any other non-admin.
 *
 * These two buttons are also the ONLY way to cross between the site and the
 * console. The banner used to carry a third button that jumped surfaces without
 * signing in, and it was the one control here with no counterpart in the real
 * product: upstream these are two deployments at two domains, and nothing in
 * either one links to the other. Who you are signed in as decides which surface
 * you are looking at, which is the arrangement the product actually has.
 *
 * There is no sign-out here either, and nothing is lost by that: the store is
 * in memory, so a reload already signs you out, and Reset does it deliberately.
 * Both products keep their own sign-out where it belongs — the console's topbar,
 * the site's profile page — and this banner is not the place to duplicate it.
 */
const ACCOUNTS: Account[] = [
  { key: 'customer', phone: '+995555100001', surface: 'customer' },
  { key: 'admin', phone: '+995555300002', surface: 'admin' },
];

const PASSWORD = 'nabadi-demo';

const CHIP =
  'inline-flex items-center h-7 px-2.5 rounded-pill border border-line-strong ' +
  'text-[12px] leading-none text-ink-muted transition-colors ' +
  'hover:border-accent hover:text-ink focus-visible:outline-2 focus-visible:outline-accent ' +
  'focus-visible:outline-offset-2 disabled:opacity-50 disabled:pointer-events-none';

export function DemoBanner({ surface }: { surface: SurfaceName }) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [signedInAs, setSignedInAs] = useState<string | null>(null);

  // The store is not React state, so the label has to be read after every action
  // rather than derived. Crossing surfaces remounts this component, which is when
  // the value would otherwise go stale.
  useEffect(() => {
    setSignedInAs(currentUser()?.role ?? null);
  }, [surface]);

  if (dismissed) return null;

  const signInAs = async (account: Account) => {
    setBusy(true);
    try {
      await dispatch('POST', '/api/auth/login/', {
        body: { phone: account.phone, password: PASSWORD },
      });
      setSignedInAs(currentUser()?.role ?? null);
      // Both surfaces hold their own QueryClient, and the one we are leaving must
      // not keep the previous account's answers in cache for when we come back.
      client.clear();
      if (account.surface !== surface) goToSurface(account.surface);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    resetStore();
    setSignedInAs(null);
    client.clear();
  };

  return (
    <aside
      aria-label={t('demo.badge')}
      className="fixed bottom-3 left-3 z-50 max-w-[calc(100vw-1.5rem)] sm:bottom-4 sm:left-4"
    >
      {/* Opaque surface and a 1px line, not a translucent blur: this shop's
          design system forbids glassmorphism, and the banner is not exempt
          from the rules of the product it is sitting on top of. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-line-strong bg-surface px-3 py-2.5 shadow-soft">
        {/* Below sm the badge is the handle for everything else; from sm up the
            bar is always open and this collapses to a static label. */}
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          className="flex items-center gap-1.5 sm:hidden"
        >
          <DemoDot />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-ink">
            {t('demo.badge')}
          </span>
          <ChevronUp
            className={`h-3.5 w-3.5 text-ink-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>

        <span className="hidden items-center gap-1.5 sm:inline-flex">
          <DemoDot />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-ink">
            {t('demo.badge')}
          </span>
        </span>

        <div
          className={`w-full flex-wrap items-center gap-x-3 gap-y-2 sm:flex sm:w-auto ${
            expanded ? 'flex' : 'hidden'
          }`}
        >
          <p className="min-w-0 flex-1 text-xs leading-relaxed text-ink-muted sm:max-w-[17rem]">
            {t('demo.body')}
          </p>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] uppercase tracking-wide text-ink-muted">
              {t('demo.sign_in_as')}
            </span>
            {ACCOUNTS.map((account) => (
              <button
                key={account.key}
                type="button"
                disabled={busy}
                onClick={() => void signInAs(account)}
                aria-current={signedInAs === account.key ? 'true' : undefined}
                className={
                  signedInAs === account.key
                    ? `${CHIP} border-accent text-ink`
                    : CHIP
                }
              >
                {t(`demo.role.${account.key}`)}
              </button>
            ))}
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <button type="button" className={CHIP} onClick={reset}>
              <RotateCcw className="mr-1 h-3 w-3" aria-hidden />
              {t('demo.reset')}
            </button>

            <a href={PORTFOLIO_URL} className={CHIP}>
              {t('demo.portfolio')}
              <ArrowUpRight className="ml-1 h-3 w-3" aria-hidden />
            </a>

            <button
              type="button"
              aria-label={t('demo.dismiss')}
              onClick={() => setDismissed(true)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-pill border border-line-strong text-ink-muted transition-colors hover:border-accent hover:text-ink"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

/** The only accent fill on the banner, and it is 6px across. */
function DemoDot() {
  return <span className="h-1.5 w-1.5 rounded-pill bg-accent" aria-hidden />;
}
