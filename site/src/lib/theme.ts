import { useCallback, useSyncExternalStore } from 'react'

/**
 * Light / dark, shared by every consumer.
 *
 * The truth is the `data-theme` attribute on `<html>` — the same contract
 * boulder.ge and every rule in `styles/boulder.css` read — so this is a small
 * external store over that attribute rather than React state. Two components
 * calling `useTheme()` cannot disagree, and the pre-paint script in
 * `index.html` (which sets the attribute before React exists) is simply the
 * store's first write.
 *
 * The choice is remembered under `boulder.theme`; an unset choice follows the
 * operating system, live. Only an explicit toggle persists, so merely visiting
 * never freezes the current OS theme in.
 */
export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'boulder.theme'

/** The browser chrome colour per theme: `--page-bg` in boulder.css. Mirrored in index.html. */
const THEME_COLOR: Record<Theme, string> = { light: '#ffffff', dark: '#111224' }

const DARK_QUERY = '(prefers-color-scheme: dark)'

function current(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
}

function saved(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    // Site data blocked: fall through to the system preference.
    return null
  }
}

function apply(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme)
  // The boot script only sets this for the first paint; keep the browser
  // chrome in step afterwards.
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme])
}

const listeners = new Set<() => void>()
let stop: (() => void) | null = null

/**
 * One attribute observer and one media listener for however many subscribers,
 * started with the first and torn down with the last.
 */
function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  if (!stop) {
    const observer = new MutationObserver(() => listeners.forEach((notify) => notify()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    const media = window.matchMedia?.(DARK_QUERY)
    const onSystem = () => {
      if (!saved() && media) apply(media.matches ? 'dark' : 'light')
    }
    media?.addEventListener('change', onSystem)

    stop = () => {
      observer.disconnect()
      media?.removeEventListener('change', onSystem)
      stop = null
    }
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) stop?.()
  }
}

export function useTheme(): { theme: Theme; toggle: () => void } {
  const theme = useSyncExternalStore<Theme>(subscribe, current, () => 'light')

  const toggle = useCallback(() => {
    const next: Theme = current() === 'dark' ? 'light' : 'dark'
    apply(next)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // Not worth failing a click over; the switch still applies this visit.
    }
  }, [])

  return { theme, toggle }
}
