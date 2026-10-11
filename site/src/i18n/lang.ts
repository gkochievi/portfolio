/**
 * The language part of an address — a port of boulder-website's
 * `src/router/lang.js`, and a module of its own for the same reason: it has no
 * React in it, so `content.ts` and anything else can import the type and the
 * two helpers without pulling in the provider.
 *
 * English lives at `/…` and Georgian at `/ka/…`, so each language is a page of
 * its own that a link can share. The prefix is handled here and nowhere else:
 * every other part of the portal speaks in language-free paths (`/`,
 * `/work/tonnaro`), and `useLang().href` adds the prefix on the way out.
 *
 * These are router paths, not URLs. The basename (`VITE_BASE`) and the hash
 * router's `#` are added by React Router, so nothing here needs to know about
 * either.
 */
export type Lang = 'en' | 'ka'

export const LANGS: readonly Lang[] = ['en', 'ka']

const KA = '/ka'

/** `{ lang, rest }` for a router location (`/ka/work/x?y#z`). */
export function splitLang(location: string): { lang: Lang; rest: string } {
  const loc = location || '/'
  if (loc === KA || /^\/ka(?=[/?#])/.test(loc)) {
    const rest = loc.slice(KA.length)
    return { lang: 'ka', rest: rest.startsWith('/') ? rest : `/${rest}` }
  }
  return { lang: 'en', rest: loc.startsWith('/') ? loc : `/${loc}` }
}

/** The address of a language-free path in `lang` (`/work/x` → `/ka/work/x`). */
export function localize(path: string, lang: Lang): string {
  const { rest } = splitLang(path)
  if (lang !== 'ka') return rest
  // '/', '/?q' and '/#id' hang off '/ka' itself, not '/ka/'.
  return rest === '/' || /^\/[?#]/.test(rest) ? `${KA}${rest.slice(1)}` : `${KA}${rest}`
}
