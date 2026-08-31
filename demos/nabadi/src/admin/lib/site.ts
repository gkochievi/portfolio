import { surfaceUrl } from '../../surface';

/**
 * Absolute URL of the customer-facing site.
 *
 * Upstream the two apps are separate deployments and this was an env var —
 * `VITE_SITE_URL`, defaulting to the other dev server on :5173. In the demo the
 * customer site is the other surface of this same bundle, so the link is derived
 * from the build's base path instead.
 *
 * The Topbar opens it in a new tab, which starts a second, independent store —
 * the same thing that happens when you open the real site in a new tab, since
 * neither one has a server behind it holding the state.
 */
export const SITE_URL: string = surfaceUrl('customer');
