/**
 * The one piece of chrome every demo shares: it says what this is, who built
 * it, and lets the visitor drive it — switch role, sign out, reset, leave.
 *
 * It is deliberately *not* in the demo's palette. Each demo is dressed as its
 * own product; this bar is Boulder's, and looks the same on all seven, on a
 * light page or a dark one. Styles live in `demo-kit.css` (every class
 * `bdk-`, every variable `--bdk-`), unlayered so a demo's Tailwind preflight
 * cannot restyle it.
 *
 * Portalled into `document.body`, so a transformed ancestor in the demo's
 * layout can never turn `position: fixed` into "fixed to that box".
 */
import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactPortal } from 'react'
import { createPortal } from 'react-dom'

import type { Lang } from './i18n'
import { portfolioUrl } from './router'
import { accountInitial, type DemoAccount } from './session'

/** Every string the bar renders. Pass `ka` or `en` from `DEMO_BAR_STRINGS`, or your own. */
export interface DemoBarStrings {
  /** The pill's label. */
  badge: string
  /** Pill's accessible name while collapsed. */
  open: string
  /** The panel's collapse button. */
  collapse: string
  /** Small caps above the product name. */
  eyebrow: string
  /** One line on what the visitor is looking at. */
  note: string
  /** Heading over the account switcher. */
  accounts: string
  /** Chip on the signed-in account. */
  current: string
  /** Shown above the switcher when nobody is signed in. */
  signedOut: string
  signOut: string
  reset: string
  /** Announced (aria-live) after a reset. */
  resetDone: string
  portfolio: string
  /** The X beside the pill — hides the bar until reload. */
  dismiss: string
  /** Footer credit. */
  builtBy: string
}

/**
 * Ready-made strings for both demo languages.
 * The Georgian set wants a native speaker's read before launch.
 */
export const DEMO_BAR_STRINGS: Record<Lang, DemoBarStrings> = {
  en: {
    badge: 'Live demo',
    open: 'Open demo controls',
    collapse: 'Collapse demo controls',
    eyebrow: 'Interactive demo',
    note: 'No backend — everything runs in your browser. Changes last until you reload.',
    accounts: 'Try it as',
    current: 'Current',
    signedOut: 'Signed out — pick an account to sign in.',
    signOut: 'Sign out',
    reset: 'Reset demo data',
    resetDone: 'Demo data restored.',
    portfolio: 'Back to portfolio',
    dismiss: 'Hide demo bar',
    builtBy: 'Built by Boulder',
  },
  ka: {
    badge: 'ცოცხალი დემო',
    open: 'დემოს მართვის პანელის გახსნა',
    collapse: 'დემოს მართვის პანელის დახურვა',
    eyebrow: 'ინტერაქტიული დემო',
    note: 'სერვერი არ გამოიყენება — ყველაფერი თქვენს ბრაუზერში მუშაობს. ცვლილებები გვერდის განახლებამდე ინახება.',
    accounts: 'გამოსცადეთ როგორც',
    current: 'მიმდინარე',
    signedOut: 'არ ხართ შესული — შესასვლელად აირჩიეთ ანგარიში.',
    signOut: 'გასვლა',
    reset: 'დემო მონაცემების აღდგენა',
    resetDone: 'დემო მონაცემები აღდგენილია.',
    portfolio: 'პორტფოლიოში დაბრუნება',
    dismiss: 'დემო პანელის დამალვა',
    builtBy: 'შექმნა Boulder-მა',
  },
}

/** Props for `<DemoBar>`. */
export interface DemoBarProps {
  /** The demo's product name, as the panel's title. */
  product: string
  /** The seeded accounts the switcher lists. */
  accounts: readonly DemoAccount[]
  /** The signed-in account's id, or null. */
  currentId: string | null
  /** Sign in as this account — typically `session.signIn(id)` plus a navigate. */
  onSwitch: (id: string) => void
  /** Sign out. Omit to hide the action (a demo without a login screen). */
  onSignOut?: (() => void) | undefined
  /** Restore the seed — typically `store.reset()` plus clearing any query cache. */
  onReset: () => void
  /** Overrides on top of the English defaults; pass `DEMO_BAR_STRINGS.ka` for Georgian. */
  strings?: Partial<DemoBarStrings> | undefined
  /** Which corner. Default `'bottom-left'`. */
  position?: 'bottom-left' | 'bottom-right' | undefined
  /** Start expanded on wide screens. Phones always start collapsed to the pill. */
  defaultOpen?: boolean | undefined
  /**
   * `import.meta.env.BASE_URL`; "Back to portfolio" resolves two levels above
   * it (`portfolioUrl`). Without it the link falls back to the origin root.
   */
  baseUrl?: string | undefined
}

const NARROW = '(max-width: 639px)'
const AVATAR_FALLBACKS = ['#5c4de8', '#ff3366', '#3b3d74'] as const
const RESET_FLASH_MS = 2400

function isNarrowViewport(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(NARROW).matches
}

function withDefaults(overrides: Partial<DemoBarStrings> | undefined): DemoBarStrings {
  const merged: DemoBarStrings = { ...DEMO_BAR_STRINGS.en }
  if (!overrides) return merged
  // Key by key, so an explicit `undefined` in the overrides cannot blank a label.
  for (const key of Object.keys(merged) as (keyof DemoBarStrings)[]) {
    const value = overrides[key]
    if (typeof value === 'string') merged[key] = value
  }
  return merged
}

/** The boulder from Boulder's logo (boulder.ge), mark only — no wordmark. */
const BOULDER_MARK_PATH =
  'M292.41,69.76c-6.4-3.46-13.64-5.56-20.83-7.47-.23-.06-7.86-1.88-8.02-1.92-.46-.1-.93-.18-1.4-.27.03,0,.06,0,.08,0,.91-.11,6.24-2.35,6.7-2.82.7-.72,1.5-1.25,2.39-1.66.86-.4,2.36-2.85,2.58-2.94.31-.13.6-.28.77-.46.38-.1,3.13-1.49,3.29-1.68.29-.38.54-.79.81-1.18.24-.36.46-.68.24-1.17-.17-.38,1.78-3.53,1.96-3.9.24-.46.59-.82.46-1.4-.03-.1.04-.31.2-.31.19,0,.18-.08.23-.23.21-.62.31-1.25.47-1.88.08-.28.71-1.68.83-1.86.53-.88.98-1.76,1.31-2.73.11-.31.93-2.38.6-2.56-.53-.29-.88-.82-1.25-1.25-.28-.33-.46-.74-.92-.93-.08-.03-.19,0-.22-.13-.18-.81-3.71-3.35-3.89-3.67-.05-.09,3.5-3.9,3.42-4.66-.02-.14,1.05-2.03.91-2.19-.31-.36-.71-.65-.9-1.12-.04-.1-.76-1.17-1-1.41-.97-.89-1.96-1.76-2.93-2.64-.04-.04-.48-1.02-.98-1.45-.8-.68-1.61-1.32-2.42-1.99-.1-.08-3.16-1.37-3.64-1.45-.36-.07-.43-.14-.3-.46.24-.56.56-1.1.67-1.71-.21-.06-.03-.29-.19-.43-.41-.36-.78-.78-1.1-1.22-.21-.29-.41-.57-.73-.75-.93-.51-1.78-1.17-2.53-1.89-.51-.48-1.1-.79-1.65-1.17-.76-.51-1.57-.95-2.26-1.53C262.48.65,255.79,0,255.41,0c-.74-.02-3.1,1.23-3.45,1.84-1.17,2.08-2.49,4.06-3.82,6.04-.24.35-.36.75-.86.83-.44.08-.83-.02-1.25-.14-.62-.18-1.27-.56-1.89-.38-.73.23-1.39.14-2.09.04-1.15-.14-2.24-.51-3.36-.76-.53-.11-1.67.26-1.97.73-.17.28-.82,4.02-.86,4.27-.16.94-.58,1.75-.94,2.61-.13.3-4.21.66-4.81,1.17-.71.6-4.08,3.27-4.45,2.95-.35-.32-.68-.29-.98-.02-.34.29-.94.43-.88,1.07,0,.04-.04.11-.08.15-.5.58-.58,1.3-.71,2.01-.19,1.01-.28,2.03-.29,3.06,0,.56.11,6.14.08,7.16-.03.81-.16,1.61-.14,2.42.02.58.63,8.78.63,9.06-.01.7.71,1.1.77,1.77,0,.06.16.1.24.13,1.15.47,2.32.91,3.47,1.39,1.67.7,3.27,1.56,4.91,2.3,1.39.63,2.76,1.3,4.14,1.96.99.49,1.97.98,2.96,1.47.66.33,1.29.78,1.99.93.56.12,1.07.23,1.59.51,1.76.95,3.57,1.81,5.33,2.76.56.3,1.2.49,1.77.9-.05,0-.09,0-.14.01-.42.15-1.37.91-1.62,1.38-.06.12,0,.25.13.31.32.13.64.26.96.39.27.1.16.45-.13.43-.2,0-.37.01-.49.07-.18.08-1.53,1.12-1.36,1.4h-.01c2.38.79,4.66,1.79,6.9,2.84.27.13.11.49-.18.43-8.26-1.7-16.66-4.06-25.11-4.06-.06,0-.11.01-.16.04-3.59,2.27.31,2.05,2.44,2.78,0,0,.01,0,.02,0,7.82,2.03,15.53,4.46,23,7.33.3.12.13.51-.19.43-16.89-4.7-34.53-6.95-52.28-5.98-.03,0-.07,0-.1.02-.74.3-1.33.88-1.76,1.47-.25.85,2.25.57,2.9.81.01,0,.03.01.04.01,16.27,2.91,33.22,6.64,46.91,15.19.25.16.03.5-.25.4-23.98-8.71-50.15-14.23-75.96-9.66-.31.05-.26.46.06.45,26.86-.98,53.5,2.9,77.82,13.07.01,0,.02,0,.03.01,1.14.31,2.44.77,3.42-.08.01,0,.02-.02.04-.02,10.84-6.18-29.52-17.14-41.44-19.53-.31-.06-.25-.46.06-.45,16.09.24,31.64,4.02,46.77,8.43,2.42.8,4.98,1.44,6.2-1.1.02-.04.03-.1.01-.14-.19-.66-.77-.89-1.39-1.23-5.85-3.1-12.27-5.24-18.71-7.28-.31-.1-.17-.5.15-.44,5.97,1.21,11.96,2.44,17.76,4.14.01,0,.03,0,.04.01,1.08.52,2.27-.45,2.7-1.3.05-.1,0-.23-.1-.29-.21-.11-.43-.22-.65-.32-.25-.12-.13-.45.15-.43.96.08,1.83-.24,2.61-1.49.32-.35-1.22-.89-1.52-1.07-.01,0-.02-.01-.04-.02-2.29-.94-4.6-1.84-6.9-2.77-.29-.12-.13-.49.18-.43,10.43,2.27,20.88,4.76,30.9,8.17.3.1.51-.26.23-.41ZM227.67,29.02c-.04,1.55-.28,3.11-.27,4.66,0,.63-.18,1.26-.1,1.89.06.06.11.11.18.17.13.1.09.08.11.2.05.31.01.67-.03.99-.04.38-.09.8-.24,1.15-.06.17-.01.13-.14.09-.16-.04-.56-.23-.63-.38-.06-.13.01-.31.03-.44.02-.15.05-.29.08-.44-.11-.29-.08-.6-.08-.88.03-1.02-.29-1.95-.58-2.9-.07-.22-.09-.46-.07-.7.03-.48-.34-.41-.6-.41-.31,0-.18.28-.18.43.03,1.04-.26,2.07-.13,3.11.01.11.04.24-.13.28-.21.04-.29-.11-.34-.26-.07-.23-.13-.46-.16-.69-.11-.04-.22-.08-.34-.08,0-.08-.08-.09-.09-.15-.03-.14.05-.36.06-.5.03-.66,0-1.34-.04-2-.01-.25-.03-.5-.03-.75-.02.07-.04.14-.06.21h-.06c0-.78,0-1.56,0-2.34,0-.28.32-.38.36-.69.08-.54-.04-1.06-.03-1.59.02-1.4.01-2.8,0-4.19,0-.24-.09-.43-.2-.65-.18-.36-.1-.91.22-1.25.19-.21.28-.61.58-.6.41.01.8.17,1.17.35.29.05.59.08.88.14.19.04.38.1.58.17,0,.18,0,.36-.01.55.28.28.42.68.37,1.17-.18,1.66.07,3.31.1,4.96,0,.48-.18.88-.2,1.35ZM265.72,47.52c-.29.15-.33.52-.47.87-.04.11.07.34-.11.34-.24,0-.52-.05-.72-.18-.21-.13-.26-.5-.64-.35-.08.03-.11-.19-.06-.22.56-.34-.13-.91.23-1.28-.38-.59.28-1.4.89-1.59,0,.32,1.12,1.37,1.12,1.41-.11.34.08.82-.25,1ZM271.34,47.98c-.13.63-.43.94-1.09,1.21-.78.33-1.28.05-1.86-.26-.02-.01-.03-.02-.04-.03,0,0,0,0-.01,0-.09-.03-.18-.08-.23-.14-.2-.23-.03-.33.13-.51.16-.21.27-.19.49-.31-.01-.29.03-.78.42-.8.04,0,.09,0,.14.01.04-.11.09-.18.18-.18.46,0,.91-.17,1.36-.11.28.04.57.86.51,1.14ZM280.03,30.85c.41-.66.66-.6,1.15-.03.58.68,1.16,1.35,1.78,1.99.34.35.38.76.23,1.13-.2.51-.32,1.03-.36,1.56-.03.38-.37.65-.35,1.02.06,1.42-.77,2.56-1.28,3.77-.56,1.35-1.12,2.71-1.72,4.05-.05.11-.1.22-.14.33-.03.21-.06.41-.08.61-.13,1.08-.86,2.12-1.32,3.1-.08.17-.26.43-.44.48-.08.08-.18.12-.27.14-.19.04-.5-.13-.66-.36-.68-.96-1.5-1.76-2.42-2.49-.48-.38-.83-.87-.95-1.5-.04-.22-.06-.55-.36-.52-.31.02-.74,0-.85.38-.13.45-.6.66-.68,1.12,0,.02,0,.04-.01.05.03.06.05.13.04.19-.29,0-.56.09-.86.12-.53.04-1.07.08-1.59.09-.38,0-.76,0-1.14-.03-.23-.01-.44-.08-.67-.08-.11-.19-.33-.34-.48-.51-.16-.19-.34-.36-.48-.55-.19-.28.03-.36.19-.63.12-.19.24-.39.38-.58,0-.08.04-.18.09-.28.14-.28.38-.52.55-.78.87-1.32,2.6-1.87,3.79-2.86.47-.39.89-.85,1.37-1.23.28-.22.57-.4.83-.64.15-.14.28-.29.43-.42.04-.03.1-.08.17-.14,0,0,0,0,0,0,.22-.25.46-.5.68-.73.5-.53.97-1.15,1.49-1.69.7-.72,1.35-1.47,2.1-2.15.65-.6,1.35-1.15,1.84-1.95ZM241.51,30.73c-.13.36-.59.4-.7.82-.18.74-.09,1.48-.08,2.21.02.98-.14,1.91-.66,2.75-.03.04-.08.09-.11.14-.16.27-.14.83-.61.66-.25-.09-.61-.14-.78-.38-.48-.13-.96-.31-1.45-.38-.19-.03-.26-.04-.41-.17-.13-.1-.26-.29-.4-.36-.13-.06-.37-.01-.52,0-.21,0-.31.07-.51.16-.41.18-.81.38-1.22.55-.17.08-.43.19-.61.19-.01-.21-.04-.42-.09-.63-.06-.01-.11-.06-.15-.12-.17-.28,0-.59.01-.88,0-.17.42-2.25.58-2.8.26-.9.4-1.83.17-2.71-.33-1.26.55-2.06.95-3.04.26-.62.58-1.21.55-1.91,0-.21.16-.29.28-.33.56-.19.4-.63.45-1.05.09-.68.02-1.35.04-2.03,0-.16-.02-.29-.06-.45-.14-.52.03-1.91-.11-2.5-.41-1.8.04-3.55.44-5.3.06-.26.13-.53.16-.8.07-.57.31-1.08.54-1.59.03-.07.09-.15.08-.21-.24-.7.27-1.14.56-1.67.11-.21,2.16.12,2.5.27.4.18.8.4,1.27.41.12,0,.35-.04.38.15.03.2.39.56.75.72.15.07.12.18.12.29.01.55,0,1.09.01,1.64,0,.17-.04.36.08.51.11.13.21.28.38,0,.31-.51.61-1.04.79-1.6.17-.55.48-.58.86-.32.4.26.96.28,1.23.76,0,.01.03.04.04.04,1.14-.09.68.69.62,1.2-.14,1.33-.29,2.65-.48,3.97-.16,1.1-.34,2.2-.38,3.32-.03.89-.61,1.59-.97,2.35-.92,1.93-1.97,3.8-2.66,5.85-.25.76-.56,1.51-.85,2.27ZM250.07,36.65c-.13.15-.18.13-.39.1-.54-.06-1.06-.19-1.6-.21-.6-.03-1.18.02-1.77.14-.24.05-.58.07-.79.21-.21.13-.28.5-.38.72-.16.38-.43.33-.82.33-.37,0-.59-.13-.86-.37-.03-.02-.05-.04-.07-.07,0,0,0,0,0,0-.11-.18-1.02-1.05-.88-1.57.18-.7.13-1.41.04-2.11-.11-.18-.22-.35-.34-.53-.21-.31-.28-.66-.2-1.03.12-.53.21-1.1.37-1.63.16-.51.38-1.03.73-1.46.2-.24.38-.6.66-.75-.04.44-.15.9-.21,1.35,0,.01,0,.02,0,.03.04,0,.08.01.13.03.16-.7.44-1.41.87-1.9.53-.61.93-1.3,1.4-1.94.51-.71.99-1.46,1.41-2.23.19-.34.39-.76.01-1.19-.2-.23.13-.43.28-.56.58-.51,1.04-1.07,1.42-1.76.3-.55.85-1.01,1.22-1.58.15-.23.19-.48.36-.71.62-.88,1.19-1.8,1.79-2.7.41-.62.88-1.22,1.27-1.82.39-.6.84-1.19,1.2-1.84-.04.19-.08.39-.11.6-.43,2.36-1.67,4.42-2.49,6.63-.32.86-.71,1.72-.93,2.79.39-.39.55-.76.71-1.11.69-1.41,1.62-2.69,2.31-4.1.55-1.09.92-2.26,1.42-3.37.83-1.87,1.17-3.92,2.12-5.72.61-1.16,1.3-2.29,2.02-3.39.59-.89,1.33-1.66,1.82-2.63.44.24.76.6,1.15.88.39.29.92.41,1.33.73,1.01.78,2.07,1.5,3.03,2.33.81.7,1.67,1.35,2.4,2.15.19.21.19.36.18.6-.09,1.12-.68,2.06-1.1,3.04-.85,1.96-1.79,3.87-2.69,5.8-.63,1.37-1.3,2.71-1.75,4.16-.04.12-.14.25.06.39,1.49-2.04,3-4.05,4.35-6.34.15.85-.19,1.46-.39,2.09-.5,1.59-1.23,3.09-2.02,4.56-.23.42-.55.79-.78,1.21-.09.18-.36.45-.06.61.3.16.47-.17.53-.39.06-.2.18-.34.26-.51.11-.22.17-.42.58-.4.33.01.44-.57.61-.91.57-1.19,1.11-2.39,1.66-3.59.25-.54.24-1.13.34-1.7.07-.4.17-.8.29-1.18.07-.21.24-.38.06-.65-.11-.15.13-.38.29-.48.58-.36.97-.93,1.53-1.32.36-.25.31-.76.63-1.09.28-.29.48-.3.76-.06.59.5,1.1,1.04,1.59,1.64.56.7,1.31,1.25,1.94,1.91,1.39,1.43,2.76,2.88,4.15,4.32.24.24.5.46.68.78.38.68.31,1.12-.34,1.62-.13.09-.08.19-.12.29-.26.69-.61,1.32-1.22,1.76-.17.13.07.2-.05.36-.9,1.19-1.76,2.41-2.63,3.63-.05.07-.08.16-.12.26.03.02.04.04.04.06.06.19-.3.35-.44.43-.1.06-.41.28-.53.27-.04,0-.14-.1-.21-.18-.19-.04-.38-.12-.48-.14-.37-.09-.75-.11-1.12-.16-.44-.06-.92-.12-1.34-.25-.42-.13-.82-.32-1.25-.44-.63-.19-1.36-.07-2.02-.16-.32-.04-.64,0-.96-.05-.35-.05-.71-.12-1.07-.2-.7-.15-1.42-.33-2.13-.29-.92.04-1.77.16-2.68.01-.71-.11-1.42-.03-2.14-.07-.71-.03-1.42-.21-2.11-.32-.22-.04-.42-.11-.63-.19-.2-.08-.75-.15-.83-.17-.55-.13-.73.29-1.06.59-.66.62-1.15,1.41-1.94,1.91-.21.13-.3.46-.44.7-.54.93-1.23,1.72-2.36,1.77-.36.02-.83-.1-1.23-.26-.3-.12-.57-.16-.63.29-.02.13-.16.26-.26.36-.33.31-.64.55-.7,1.1-.03.3-.5.66-.76,1-.14.18-.28.36-.41.55-.26.38,1.67-.02,2.19-.3.25-.14.46-.11.64.01.18-.04.61-.06.76.03.11.08.08.15.09.29.03.25,0,.46-.09.71-.1.28-.21.55-.3.84-.11.33-.25.87-.48,1.13Z'

/**
 * Boulder's mark — the boulder and its motion strokes from the studio logo.
 * It inherits `currentColor`, so it reads on the bar's dark pill and on any
 * surface a demo wants to credit the studio from.
 */
export function BoulderMark({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="160 -1 134 90"
      width={Math.round(size * 1.49)}
      height={size}
      className={className ?? 'bdk-mark'}
      aria-hidden="true"
      focusable="false"
    >
      <path d={BOULDER_MARK_PATH} fill="currentColor" />
    </svg>
  )
}

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" className="bdk-icon" aria-hidden="true" focusable="false">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const ICON = {
  chevron: 'M4 10l4-4 4 4',
  close: 'M4 4l8 8M12 4l-8 8',
  reset: 'M3 8a5 5 0 1 0 1.6-3.7M3 2.5v3h3',
  arrow: 'M5 11l6-6M6 5h5v5',
  signOut: 'M6.5 3H3.5v10h3M10 5l3 3-3 3M13 8H6.5',
} as const

/**
 * The Boulder demo bar: a "Live demo" pill fixed in a bottom corner that
 * expands into a panel with the product name, a one-click account switcher,
 * sign-out, reset, a way back to the portfolio, and a dismiss that hides the
 * bar until the next reload (in memory — nothing is stored).
 *
 * Keyboard: the pill is a disclosure button (`aria-expanded`); opening it
 * moves focus into the panel (`role="dialog"`, non-modal); Escape closes it
 * and returns focus to the pill; a pointer press outside closes it too.
 */
export function DemoBar({
  product,
  accounts,
  currentId,
  onSwitch,
  onSignOut,
  onReset,
  strings,
  position = 'bottom-left',
  defaultOpen = false,
  baseUrl,
}: DemoBarProps): ReactPortal | null {
  const text = withDefaults(strings)
  const [open, setOpen] = useState(() => defaultOpen && !isNarrowViewport())
  const [dismissed, setDismissed] = useState(false)
  const [resetFlash, setResetFlash] = useState(false)

  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const pillRef = useRef<HTMLButtonElement>(null)
  // Only a user-initiated open moves focus; `defaultOpen` must not steal it on load.
  const focusPanelOnOpen = useRef(false)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const id = useId()
  const panelId = `${id}-panel`
  const titleId = `${id}-title`

  useEffect(() => {
    if (!open) return
    if (focusPanelOnOpen.current) {
      focusPanelOnOpen.current = false
      panelRef.current?.focus()
    }
    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current
      if (root && event.target instanceof Node && !root.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  useEffect(() => () => clearTimeout(flashTimer.current), [])

  if (dismissed || typeof document === 'undefined') return null

  const close = (returnFocus: boolean) => {
    setOpen(false)
    if (returnFocus) pillRef.current?.focus()
  }

  const toggle = () => {
    if (open) {
      close(false)
      return
    }
    focusPanelOnOpen.current = true
    setOpen(true)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' || !open) return
    // Ours, not the demo's: an Escape inside the bar must not also close a
    // dialog the demo happens to have open underneath.
    event.stopPropagation()
    close(true)
  }

  const pick = (accountId: string) => {
    if (accountId !== currentId) onSwitch(accountId)
    close(true)
  }

  const signOut = () => {
    onSignOut?.()
    close(true)
  }

  const reset = () => {
    onReset()
    setResetFlash(true)
    clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setResetFlash(false), RESET_FLASH_MS)
  }

  const portfolioHref = baseUrl ? portfolioUrl(baseUrl) : new URL('/', window.location.href).href

  return createPortal(
    <div
      ref={rootRef}
      className={`bdk-root bdk-root--${position}`}
      onKeyDown={onKeyDown}
      data-open={open ? 'true' : 'false'}
    >
      {open && (
        <section
          ref={panelRef}
          id={panelId}
          className="bdk-panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          tabIndex={-1}
        >
          <header className="bdk-head">
            <div className="bdk-head__text">
              <p className="bdk-eyebrow">{text.eyebrow}</p>
              <h2 id={titleId} className="bdk-product">
                {product}
              </h2>
            </div>
            <button type="button" className="bdk-icon-btn" aria-label={text.collapse} onClick={() => close(true)}>
              <span className="bdk-flip">
                <Icon d={ICON.chevron} />
              </span>
            </button>
          </header>

          <p className="bdk-note">{text.note}</p>

          {accounts.length > 0 && (
            <>
              <h3 className="bdk-section-title">{text.accounts}</h3>
              {currentId === null && <p className="bdk-hint">{text.signedOut}</p>}
              <ul className="bdk-list" role="list">
                {accounts.map((account, index) => {
                  const isCurrent = account.id === currentId
                  const avatar = {
                    '--bdk-avatar': account.avatarColor ?? AVATAR_FALLBACKS[index % AVATAR_FALLBACKS.length],
                  } as CSSProperties
                  return (
                    <li key={account.id}>
                      <button
                        type="button"
                        className="bdk-account"
                        aria-current={isCurrent ? 'true' : undefined}
                        onClick={() => pick(account.id)}
                      >
                        <span className="bdk-avatar" style={avatar} aria-hidden="true">
                          {accountInitial(account.name)}
                        </span>
                        <span className="bdk-account__body">
                          <span className="bdk-account__top">
                            <span className="bdk-account__name">{account.name}</span>
                            {account.roleLabel && <span className="bdk-account__role">{account.roleLabel}</span>}
                            {isCurrent && <span className="bdk-current">{text.current}</span>}
                          </span>
                          {account.description && <span className="bdk-account__desc">{account.description}</span>}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          )}

          <div className="bdk-actions">
            <button type="button" className="bdk-btn" onClick={reset}>
              <Icon d={ICON.reset} />
              {text.reset}
            </button>
            {onSignOut && currentId !== null && (
              <button type="button" className="bdk-btn bdk-btn--ghost" onClick={signOut}>
                <Icon d={ICON.signOut} />
                {text.signOut}
              </button>
            )}
          </div>

          <p className="bdk-status" role="status" aria-live="polite">
            {resetFlash ? text.resetDone : ''}
          </p>

          <footer className="bdk-foot">
            <span className="bdk-credit">
              <BoulderMark size={16} />
              {text.builtBy}
            </span>
            {/* `_top`: framed inside the portfolio, leaving must replace the
                portfolio page, not nest a second copy of it in the iframe. */}
            <a className="bdk-btn bdk-btn--primary" href={portfolioHref} target="_top">
              {text.portfolio}
              <Icon d={ICON.arrow} />
            </a>
          </footer>
        </section>
      )}

      <div className="bdk-pill-row">
        <button
          ref={pillRef}
          type="button"
          className="bdk-pill"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          aria-haspopup="dialog"
          aria-label={open ? undefined : `${text.badge} — ${text.open}`}
          onClick={toggle}
        >
          <BoulderMark />
          <span className="bdk-dot" aria-hidden="true" />
          <span className="bdk-pill__label">{text.badge}</span>
          <span className="bdk-chevron">
            <Icon d={ICON.chevron} />
          </span>
        </button>
        <button
          type="button"
          className="bdk-dismiss"
          aria-label={text.dismiss}
          title={text.dismiss}
          onClick={() => setDismissed(true)}
        >
          <Icon d={ICON.close} />
        </button>
      </div>
    </div>,
    document.body,
  )
}
