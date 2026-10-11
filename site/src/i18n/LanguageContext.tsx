import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { en, type Dictionary, type UiKey } from './en'
import { ka } from './ka'
import { useGeorgianCaps } from './georgianCaps'
import { localize, splitLang, type Lang } from './lang'

export { LANGS, localize, splitLang, type Lang } from './lang'
export type { UiKey } from './en'

/**
 * Site-wide language — a port of boulder-website's `LanguageContext.jsx`.
 *
 * The URL is the language: `/ka/…` is Georgian, anything else English
 * (`lang.ts`). So a shared link opens in the language it was copied in, and
 * switching is a navigation to the same page under the other prefix — which is
 * why the contract hands out `switchHref` rather than a setter. A context
 * rather than per-component state because language reaches every string on the
 * page, so there must be exactly one source of truth that re-renders them all.
 *
 * `'ka'` is the ISO 639-1 code for Georgian. The header button SHOWS "ᲒᲔ" (the
 * local convention), but code and `<html lang>` speak ISO.
 *
 * Must sit inside the router: it reads the location. Under the browser router
 * `pathname` is already stripped of the basename, and under the hash router it
 * is the path inside the fragment, so neither mode needs special handling.
 */

const DICTIONARIES: Record<Lang, Dictionary> = { en, ka }

/** Where an explicit switch is remembered. Same naming as `boulder.theme`. */
const LANG_STORAGE_KEY = 'boulder.lang'

export interface LanguageValue {
  lang: Lang
  /** The UI string for `key` in the current language. */
  t: (key: UiKey) => string
  /** A language-free router path (`/work/x`) in the current language (`/ka/work/x`). */
  href: (path: string) => string
  /** This page — path, query and fragment — in the other language. */
  switchHref: string
}

const LanguageContext = createContext<LanguageValue | null>(null)

function readSaved(): Lang | null {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY)
    return saved === 'en' || saved === 'ka' ? saved : null
  } catch {
    // Site data blocked: there is no saved choice.
    return null
  }
}

function save(lang: Lang): void {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang)
  } catch {
    // Not worth failing a render over.
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { pathname, search, hash } = useLocation()
  const navigate = useNavigate()
  const { lang, rest } = splitLang(pathname)
  const here = `${rest}${search}${hash}`

  // The SAVED language still counts on an English address with no prefix: a
  // reader who chose Georgian before is taken to the Georgian address of the
  // page they opened (a bookmark, a link someone pasted in English). An
  // explicit /ka address is never moved, whatever was saved. Decided once, on
  // arrival, and nothing is drawn until it has happened, so English never
  // flashes.
  const [arrivalRedirect] = useState(() =>
    lang === 'en' && readSaved() === 'ka' ? localize(here, 'ka') : null,
  )
  const [redirecting, setRedirecting] = useState(arrivalRedirect !== null)

  // A passive effect, not a layout one. The router subscribes to history in
  // its own layout effect, and a parent's effects run after its children's, so
  // a navigate() from a layout effect here lands before the router listens:
  // the address bar says /ka and the page stays English, demo links and all.
  // Passive effects run after every layout effect, so here it is listening.
  // Both updates commit in one render, which is already the Georgian page.
  useEffect(() => {
    if (!arrivalRedirect) return
    navigate(arrivalRedirect, { replace: true })
    setRedirecting(false)
    // On arrival only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A language change after arrival is the reader's choice (the switch, or a
  // link in the other language), so it is remembered. Arriving is not: opening
  // someone's /ka link must not turn the next visit to `/` Georgian.
  const previous = useRef(lang)
  useEffect(() => {
    if (previous.current !== lang) save(lang)
    previous.current = lang
  }, [lang])

  // Screen readers switch pronunciation off this, and `:root:lang(ka)` in
  // boulder.css repoints the font tokens to Google Sans. Layout, so the first
  // Georgian paint is already in the Georgian face.
  useLayoutEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  useGeorgianCaps(lang)

  const t = useCallback((key: UiKey) => DICTIONARIES[lang][key] ?? en[key] ?? key, [lang])
  const href = useCallback(
    (path: string) => localize(path.startsWith('/') ? path : `/${path}`, lang),
    [lang],
  )
  const switchHref = localize(here, lang === 'en' ? 'ka' : 'en')

  const value = useMemo<LanguageValue>(
    () => ({ lang, t, href, switchHref }),
    [lang, t, href, switchHref],
  )

  return <LanguageContext.Provider value={value}>{redirecting ? null : children}</LanguageContext.Provider>
}

export function useLang(): LanguageValue {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLang must be used inside <LanguageProvider>')
  return ctx
}

/**
 * Fills the `{name}` holes in a dictionary string: `fill(t('meta.project'),
 * { name })`. A hole with no value is left as written, so a missed variable is
 * visible on the page rather than silently blank.
 */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (hole, name: string) =>
    name in vars ? String(vars[name]) : hole,
  )
}
