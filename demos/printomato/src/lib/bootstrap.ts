import logoLight from '@portfolio/brand/assets/logo-light.png'

import type { BootstrapPayload } from '@/types'

/** Vite guarantees a trailing slash; strip it so `${APP_BASE}/login` is sane. */
const base = import.meta.env.BASE_URL
const path = base.replace(/\/$/, '')

/**
 * What the Django template used to inject before the bundle loaded. There is no
 * server now, so every value is derived from the one deploy knob — the base
 * path the bundle was built for.
 */
export const bootstrap: BootstrapPayload = {
  // Virtual: nothing leaves the tab. The mock router matches on this prefix
  // exactly the way DRF's URLconf did.
  apiBase: '/api/admin',
  // A hash router keeps its basename in the fragment, so `${APP_BASE}/login`
  // has to grow the '#' — that string is used as a plain href for the one
  // navigation the console does outside React Router (sign-out).
  appBase: __DEMO_ROUTER__ === 'hash' ? `${base}#` : path,
  mediaUrl: `${base}media/`,
  // Vite fingerprints the import and rewrites it against the base path.
  logoUrl: logoLight,
  timeZone: 'Asia/Tbilisi',
}

export const API_BASE = bootstrap.apiBase
export const APP_BASE = bootstrap.appBase
