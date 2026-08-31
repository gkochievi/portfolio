/**
 * Upstream, this product is two independently deployed Vite apps: the customer
 * site on :5173 and the staff console on :5174, each with its own router,
 * its own QueryClient, its own i18n instance and its own `@/` root. They only
 * ever met through the Django API.
 *
 * The demo has no API to meet through, so it mounts both inside one bundle and
 * lets them meet through the in-memory store instead — which is the whole point
 * of putting them together: book a chair as a customer, switch surface, and the
 * booking is sitting in the console's list, because there is only one store.
 *
 * This module is the seam. It owns which surface is showing, what basename that
 * surface's router runs on, and how to move between them without a page load
 * (a load would reset the store, which is the one thing the demo cannot afford).
 */

export type SurfaceName = 'customer' | 'admin';

/** Baked in by Vite: `/demos/nabadi/` in the portfolio, `/` at a domain root. */
export const BASE: string = import.meta.env.BASE_URL;

/** `hash` for hosts that cannot serve an SPA fallback. See vite.config.ts. */
export const ROUTER_MODE = __DEMO_ROUTER__;

/** The path segment that separates the console from the customer site. */
const ADMIN_SEGMENT = 'admin';

/** Broadcast on our own history writes — `pushState` fires no event by itself. */
const SURFACE_EVENT = 'demo:surface';

function stripLeadingSlash(value: string): string {
  return value.startsWith('/') ? value.slice(1) : value;
}

/**
 * The part of the URL both surfaces share. In browser mode that is the deploy
 * base; in hash mode the base belongs to the document, so routing starts after
 * the `#` and the shared prefix is just `/`.
 */
function routedPath(): string {
  if (ROUTER_MODE === 'hash') {
    const hash = window.location.hash.replace(/^#/, '');
    return hash === '' ? '/' : hash;
  }
  const { pathname } = window.location;
  return pathname.startsWith(BASE) ? `/${stripLeadingSlash(pathname.slice(BASE.length))}` : pathname;
}

export function currentSurface(): SurfaceName {
  const path = stripLeadingSlash(routedPath());
  return path === ADMIN_SEGMENT || path.startsWith(`${ADMIN_SEGMENT}/`) ? 'admin' : 'customer';
}

/**
 * The `basename` each surface's router is created with.
 *
 * This is what lets both `App.tsx` files keep their route tables verbatim —
 * the console still declares `/bookings` and `/users`, the customer site
 * still declares `/book` and `/profile`, and React Router strips the prefix
 * before either of them sees a path.
 */
export function surfaceBasename(surface: SurfaceName): string {
  const root = ROUTER_MODE === 'hash' ? '/' : BASE;
  return surface === 'admin' ? `${root}${ADMIN_SEGMENT}` : root;
}

/** Absolute URL of a surface's front door — for `<a href>` and new tabs. */
export function surfaceUrl(surface: SurfaceName): string {
  if (ROUTER_MODE === 'hash') {
    return `${window.location.pathname}#${surface === 'admin' ? `/${ADMIN_SEGMENT}/` : '/'}`;
  }
  return surface === 'admin' ? `${BASE}${ADMIN_SEGMENT}/` : BASE;
}

/**
 * Move to the other surface in place. The store, and therefore everything the
 * visitor has done so far, survives: only React unmounts.
 */
export function goToSurface(surface: SurfaceName): void {
  if (ROUTER_MODE === 'hash') {
    window.location.hash = surface === 'admin' ? `/${ADMIN_SEGMENT}/` : '/';
  } else {
    window.history.pushState(null, '', surfaceUrl(surface));
    // Each surface's router is a module-scope singleton whose history only
    // re-reads the location on popstate — pushState alone would leave the
    // destination router rendering whatever route it last held.
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
  window.dispatchEvent(new Event(SURFACE_EVENT));
}

/**
 * Subscribe to surface changes. `popstate` covers the browser's Back button
 * crossing the boundary; `hashchange` covers the same in hash mode; the custom
 * event covers our own `pushState`, which fires nothing on its own.
 */
export function onSurfaceChange(listener: () => void): () => void {
  window.addEventListener('popstate', listener);
  window.addEventListener('hashchange', listener);
  window.addEventListener(SURFACE_EVENT, listener);
  return () => {
    window.removeEventListener('popstate', listener);
    window.removeEventListener('hashchange', listener);
    window.removeEventListener(SURFACE_EVENT, listener);
  };
}
