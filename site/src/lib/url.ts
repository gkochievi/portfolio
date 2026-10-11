import type { Lang } from '@/i18n/lang'

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

/** `https:`, `mailto:`, `//host/…` — an address that is already complete. */
const ABSOLUTE = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i

/** The query parameter a demo reads its starting language from. */
const DEMO_LANG_PARAM = 'lang'

/**
 * The href of a project's live demo, in the reader's language. Every place a
 * `demoUrl` becomes a link goes through here, so the card and both buttons on
 * the project page can never disagree.
 *
 * The demos are separate bundles with their own language switches; they do
 * not share this app's `/ka` prefix or its stored choice. So the portal hands
 * the language over in the address: a Georgian reader opens the demo with
 * `?lang=ka`, and English stays a clean URL, because English is every demo's
 * default.
 *
 * The parameter goes into the query in front of any fragment, so a demo
 * running under the hash router (`/demos/x/#/route`) still sees it in
 * `location.search`, and whatever query and fragment the `demoUrl` already
 * carries are kept as written — only an existing `lang` is replaced.
 * A base-relative `demoUrl` is resolved against the deploy base; an absolute
 * one is left alone.
 */
export function demoHref(demoUrl: string, lang: Lang): string {
  const url = ABSOLUTE.test(demoUrl) ? demoUrl : fromBase(demoUrl)
  if (lang === 'en') return url

  const hashAt = url.indexOf('#')
  const beforeHash = hashAt === -1 ? url : url.slice(0, hashAt)
  const hash = hashAt === -1 ? '' : url.slice(hashAt)
  const queryAt = beforeHash.indexOf('?')
  const path = queryAt === -1 ? beforeHash : beforeHash.slice(0, queryAt)
  const query = queryAt === -1 ? '' : beforeHash.slice(queryAt + 1)

  const kept = query.split('&').filter((pair) => pair !== '' && pair.split('=')[0] !== DEMO_LANG_PARAM)
  kept.push(`${DEMO_LANG_PARAM}=${encodeURIComponent(lang)}`)
  return `${path}?${kept.join('&')}${hash}`
}
