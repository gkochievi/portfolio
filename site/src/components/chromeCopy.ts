import type { MouseEvent } from 'react'

import { fill } from '@/i18n/LanguageContext'
import { en, type Dictionary } from '@/i18n/en'
import { ka } from '@/i18n/ka'

/**
 * The chrome's words — the header, the footer and the two controls — in the
 * shape the chrome reads them. The strings themselves live in i18n/en.ts and
 * ka.ts like every other UI string (boulder.ge's data/i18n.js `nav`, `a11y`,
 * `footer`, word for word); this only regroups them, so the components can
 * index `nav[item.id]` and the dictionaries stay the one source of truth.
 */
export type ChromeLang = 'en' | 'ka'

export type NavId = 'team' | 'works' | 'services' | 'stories' | 'connect'

type ChromeCopy = {
  nav: Record<NavId, string>
  a11y: {
    logo: string
    openMenu: string
    closeMenu: string
    themeToggle: string
    langSwitch: string
    navSections: string
  }
  footer: {
    title: string
    subtitle: string
    explore: string
    follow: string
    navLabel: string
    legal: (year: number) => string
    backToTop: string
  }
}

function chromeCopy(d: Dictionary): ChromeCopy {
  return {
    nav: {
      team: d['nav.team'],
      works: d['nav.works'],
      services: d['nav.services'],
      stories: d['nav.stories'],
      connect: d['nav.connect'],
    },
    a11y: {
      logo: d['a11y.logo'],
      openMenu: d['a11y.openMenu'],
      closeMenu: d['a11y.closeMenu'],
      themeToggle: d['a11y.themeToggle'],
      // Names the TARGET language, written in it: whoever hunts for this
      // button is the one who cannot read the current one.
      langSwitch: d['a11y.langSwitch'],
      navSections: d['nav.label'],
    },
    footer: {
      title: d['footer.title'],
      subtitle: d['footer.subtitle'],
      explore: d['footer.explore'],
      follow: d['footer.follow'],
      navLabel: d['footer.navLabel'],
      legal: (year) => fill(d['footer.legal'], { year }),
      backToTop: d['footer.backToTop'],
    },
  }
}

export const CHROME_COPY: Record<ChromeLang, ChromeCopy> = { en: chromeCopy(en), ka: chromeCopy(ka) }

/** boulder.ge itself. Every nav item but "works" leaves the portal for it. */
export const BOULDER_ORIGIN = 'https://boulder.ge'

/**
 * A boulder.ge address in `lang`, by boulder.ge's own rule (router/lang.js
 * `localize`): Georgian hangs off `/ka`, and '/', '/?q' and '/#id' attach to
 * '/ka' itself rather than '/ka/' — '/#team' → '/ka#team',
 * '/services' → '/ka/services'.
 */
export function boulderHref(path: string, lang: ChromeLang): string {
  if (lang !== 'ka') return `${BOULDER_ORIGIN}${path}`
  const local = path === '/' || /^\/[?#]/.test(path) ? `/ka${path.slice(1)}` : `/ka${path}`
  return `${BOULDER_ORIGIN}${local}`
}

/**
 * The header's items, in boulder.ge's order (data/sections.js NAV_ITEMS).
 * `portal` marks "works": that is this site, so it is a router link to the
 * portal's own home and the current item everywhere in it. `path` is the
 * item's address on boulder.ge (for "works" too — the footer of a page that
 * is not the portal has no use for it, but the type stays one shape).
 */
export type NavItem = { id: NavId; path: string; portal?: boolean; accent?: boolean }

export const NAV_ITEMS: readonly NavItem[] = [
  { id: 'team', path: '/#team' },
  { id: 'works', path: '/#works', portal: true },
  { id: 'services', path: '/services' },
  { id: 'stories', path: '/#stories' },
  { id: 'connect', path: '/#connect', accent: true },
]

/**
 * boulder.ge's social links (data/footer.js). They are still placeholders
 * there (`#`), so the footer shows only entries with a real http(s) address —
 * with none, the whole "[follow us]" column goes, exactly as boulder.ge's
 * footer drops it. Fill in the hrefs here when the studio's pages exist.
 */
export const FOOTER_SOCIALS: readonly { id: string; label: string; href: string }[] = [
  { id: 'instagram', label: 'Instagram', href: '#' },
  { id: 'behance', label: 'Behance', href: '#' },
  { id: 'linkedin', label: 'LinkedIn', href: '#' },
  { id: 'facebook', label: 'Facebook', href: '#' },
]

/** ⌘/Ctrl/Shift/Alt or a non-primary button: the browser's click, not ours. */
export function isModifiedClick(event: MouseEvent<Element>): boolean {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0
}

/** Two router paths name the same page, trailing slash or not. */
export function samePath(a: string, b: string): boolean {
  const trim = (p: string) => p.replace(/\/+$/, '') || '/'
  return trim(a) === trim(b)
}

/** Back to the top of the page — at once under reduced motion. */
export function scrollToTop(): void {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
}
