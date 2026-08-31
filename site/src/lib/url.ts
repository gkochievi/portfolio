/**
 * Everything the site points at — demo bundles, static assets — is addressed
 * relative to the deploy base, never to the domain root. `VITE_BASE` is the
 * single knob; resolving through here is what makes `/`, `/portfolio/` and a
 * project-pages subpath all work off the same build config.
 */
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '')

export function fromBase(path: string): string {
  return `${BASE}/${path.replace(/^\//, '')}`
}
