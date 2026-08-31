import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

type Mode = 'light' | 'dark'

const KEY = 'boulder.theme'

/**
 * Boulder's own toggle is bespoke sun/moon vector art from the Figma file. This
 * is the same behaviour in the site's existing icon set rather than a
 * pixel-copy of that artwork — the brand tokens, the 300ms bounce and the
 * `data-theme` contract are what actually carry the identity.
 *
 * The choice is remembered, and an unset choice follows the operating system.
 * `index.html` applies the same rule inline before first paint, so the page
 * never flashes the wrong theme on load.
 */
function readMode(): Mode {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // Site data blocked: fall through to the system preference.
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>(() =>
    (document.documentElement.getAttribute('data-theme') as Mode) || 'light',
  )

  useEffect(() => {
    setMode(readMode())
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode)
    // The boot script in index.html only sets this for the first paint; keep
    // the browser chrome in step when the theme changes afterwards.
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', mode === 'dark' ? '#0b0c17' : '#f4f3fb')
  }, [mode])

  const next = mode === 'dark' ? 'light' : 'dark'

  /** Persisted only here: an unset choice keeps following the operating
   *  system, so merely visiting must not freeze the current OS theme in. */
  function choose(picked: Mode) {
    setMode(picked)
    try {
      localStorage.setItem(KEY, picked)
    } catch {
      // Not worth failing a render over.
    }
  }

  return (
    <button
      type="button"
      onClick={() => choose(next)}
      aria-label={`Switch to ${next} mode`}
      className="grid size-9 place-items-center border border-hairline text-ink transition-colors duration-300 ease-bounce hover:border-hairline-strong"
    >
      {mode === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  )
}
