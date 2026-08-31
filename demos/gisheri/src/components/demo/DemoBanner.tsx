import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, ChevronUp, RotateCcw, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { ApiError } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/context/auth';
import { useCart } from '@/context/cart';
import { resetStore } from '@/demo/store';
import { PORTFOLIO_URL } from '@/demo/base-path';
import { ADVERTISED_ACCOUNTS, type DemoAccount } from '@/demo/accounts';

/**
 * The one piece of chrome that is not part of the shop: it says what this is,
 * and it hands over the credentials.
 *
 * `App.tsx` mounts it inside every provider — it signs in through `useAuth`,
 * empties the cart through `useCart` and drops the query cache — but outside
 * `<Routes>`, so it survives a path the router does not recognise and is still
 * there to sign you in from the 404 page.
 *
 * It reaches into `src/demo/` for three things only — the accounts, the reset
 * and the portfolio URL — and imports no handler, no seed and no schema: this
 * is chrome, and chrome that knows the shape of an order is chrome that breaks
 * the next time an order changes shape.
 */

/**
 * The chip. Written against the product's own tokens rather than a palette of
 * its own — `border-border`, `text-muted-foreground`, `ring-ring` — because a
 * banner that ignores the design system it is sitting on looks exactly like
 * what it is. The pill radius and the gold hover are this shop's, taken from
 * `.btn-secondary` and `.gold-border` in `index.css`.
 */
const CHIP =
  'inline-flex h-7 items-center rounded-full border border-border px-2.5 text-[12px] leading-none ' +
  'text-muted-foreground transition-colors hover:border-gold hover:text-foreground ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ' +
  'ring-offset-background disabled:pointer-events-none disabled:opacity-50';

const DemoBanner = () => {
  const { t } = useTranslation();
  const { user, login, logout } = useAuth();
  const { clearCart } = useCart();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Two pieces of state, neither persisted. Web Storage in this build is spoken
  // for: the i18n language key and next-themes' theme key, and nothing else. A
  // visitor who hides the banner and reloads gets it back, which is the right
  // way round for a thing whose whole job is to explain the page.
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // A ref rather than a third piece of state: the mock answers a write in
  // 140–340ms, far too short for a spinner to be anything but a flicker, and
  // all this has to do is stop a double-click firing two logins whose replies
  // could land out of order. No render depends on it, so nothing should
  // re-render because of it.
  const signingIn = useRef(false);

  if (dismissed) return null;

  /**
   * Sign-in goes through the real path — `useAuth().login()`, which POSTs
   * `/auth/login` and stores the token pair — and not by writing a session into
   * the store. The password check, the 401, the role flags and the token
   * refresh are all things this demo is meant to be showing; short-circuiting
   * them here would mean the one account anyone actually uses is the one
   * account that never exercises them.
   */
  const signInAs = async (account: DemoAccount) => {
    if (signingIn.current) return;
    signingIn.current = true;
    try {
      await login(account.email, account.password);
      // The previous account's answers must not survive the switch: the admin
      // lists and the customer's own orders are cached under keys that do not
      // mention who asked for them.
      queryClient.clear();
      // The console is a place the storefront never links to, so an admin has
      // to be taken there. A customer is already home wherever they are
      // standing — and if that happens to be `/admin`, `ProtectedRoute` sends
      // them to `/` without any help from this component.
      if (account.home.startsWith('/admin')) navigate(account.home);
    } catch (err) {
      // Same shape every other failure in this app takes: the title says what
      // went wrong, the body carries whatever the API said about it.
      toast({
        title: t('demo.signInFailed'),
        description: err instanceof ApiError ? err.detail : undefined,
        variant: 'destructive',
      });
    } finally {
      signingIn.current = false;
    }
  };

  /**
   * Back to a pristine shop with no page reload. A reload would work, but it is
   * a heavier promise than this needs to make: nothing in the demo mints an
   * object URL that would outlive the store (the fake image upload returns a
   * `data:` URI), so emptying the four places state actually lives is enough.
   */
  const reset = () => {
    resetStore();
    queryClient.clear();
    clearCart();
    logout();
  };

  return (
    <aside
      aria-label={t('demo.badge')}
      /*
       * z-40, deliberately, and one layer below everything that overlays this
       * app: Radix's Dialog, Sheet and AlertDialog overlays are z-50 and so is
       * the sticky Header. A banner above them sits on top of the checkout
       * confirm dialog and traps the visitor inside it.
       */
      className="fixed bottom-3 left-3 z-40 max-w-[calc(100vw-1.5rem)] sm:bottom-4 sm:left-4"
    >
      {/*
       * An opaque card and a 1px line, not a translucent blur: this shop has no
       * glassmorphism anywhere in its design system, and the banner is not
       * exempt from the rules of the product it is sitting on top of. The dark
       * variant trades the drop shadow for the gold glow `.card-product` uses,
       * because a shadow under a dark card is a shadow nobody sees.
       */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-border bg-card px-3 py-2.5 shadow-lg dark:shadow-[0_0_24px_-8px_hsl(var(--gold)/0.3)]">
        {/* Below sm the badge is the handle for everything else; from sm up the
            bar is always open and this collapses to a static label. */}
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          className="flex items-center gap-1.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background sm:hidden"
        >
          <DemoDot />
          <span className="text-[11px] font-medium uppercase tracking-wider text-foreground">
            {t('demo.badge')}
          </span>
          <ChevronUp
            className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', expanded && 'rotate-180')}
            aria-hidden
          />
        </button>

        <span className="hidden items-center gap-1.5 sm:inline-flex">
          <DemoDot />
          <span className="text-[11px] font-medium uppercase tracking-wider text-foreground">
            {t('demo.badge')}
          </span>
        </span>

        <div
          className={cn(
            'w-full flex-wrap items-center gap-x-3 gap-y-2 sm:flex sm:w-auto',
            expanded ? 'flex' : 'hidden',
          )}
        >
          <p className="min-w-0 flex-1 text-xs leading-relaxed text-muted-foreground sm:max-w-[17rem]">
            {t('demo.body')}
          </p>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {t('demo.signInAs')}
            </span>
            {/*
             * Two personas, not three. The seed carries a staff account and the
             * gates honour it, but its entire payoff is the two places where the
             * front-end gate and the API gate disagree — a sidebar link that
             * 403s and an autocomplete that swallows its own refusal. Those are
             * worth documenting, which the README does, and they are a poor
             * thing to invite a visitor to click. See the note on `DEMO_STAFF`.
             */}
            {ADVERTISED_ACCOUNTS.map((account) => {
              // Read off the real session rather than tracked separately, so
              // signing in from the login form or signing out from the account
              // page moves the mark too.
              const current = user?.role === account.role;
              return (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => void signInAs(account)}
                  aria-current={current ? 'true' : undefined}
                  className={cn(CHIP, current && 'border-gold text-foreground')}
                >
                  {t(account.labelKey)}
                </button>
              );
            })}
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
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-gold hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};

/** The only gold fill on the banner, and it is 6px across. */
const DemoDot = () => <span className="h-1.5 w-1.5 rounded-full bg-gold" aria-hidden />;

export default DemoBanner;
