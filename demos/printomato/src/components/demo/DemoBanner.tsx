import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowUpRight, ChevronUp, RotateCcw, X } from 'lucide-react'

import { cn } from '@/lib/cn'
import { resetStore } from '@/demo/store'
import { Badge, Button, IconButton } from '@/components/ui/primitives'
import { useToast } from '@/components/ui/Toast'

/**
 * Resolved against the build's base path rather than the current route, so it
 * points at the portfolio root from `/photos` and `/devices/3/photos` alike.
 * A demo served at the domain root has no portfolio above it and lands back on
 * itself — which is the honest answer for that deployment.
 */
const PORTFOLIO_URL = new URL('../../', new URL(import.meta.env.BASE_URL, window.location.href)).href

/**
 * The one piece of chrome that is not part of the original console: it says
 * what this is. Anchored bottom-left, clear of the sticky header and under
 * every overlay, and dismissible for anyone who wants the product on its own.
 *
 * On a phone it starts collapsed to the badge alone. Left open it was a
 * full-width bar wrapping to three rows across the bottom of the viewport,
 * parked over the last photo tile, the last payments row and the pagination
 * control on every list page until someone found the X.
 */
export function DemoBanner() {
  const { t } = useTranslation()
  const client = useQueryClient()
  const toast = useToast()
  const [dismissed, setDismissed] = useState(false)
  const [expanded, setExpanded] = useState(false)

  if (dismissed) return null

  const reset = () => {
    resetStore()
    client.clear()
    toast.success(t('demo.resetTitle'), t('demo.resetBody'))
  }

  return (
    <aside
      aria-label={t('demo.badge')}
      className="fixed bottom-3 left-3 z-30 max-w-[calc(100vw-1.5rem)] sm:bottom-4 sm:left-4 sm:max-w-none"
    >
      <div
        className={
          'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-control border border-hairline-strong ' +
          'bg-surface-2/95 px-3 py-2.5 shadow-raised backdrop-blur-md sm:flex-nowrap'
        }
      >
        {/* Below sm the badge is the handle for the rest; from sm up the bar is
            always open and the static badge takes over. */}
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          className="flex items-center gap-1.5 rounded-full sm:hidden"
        >
          <Badge tone="gold" dot pulse>
            {t('demo.badge')}
          </Badge>
          <ChevronUp
            className={cn('size-3.5 text-ink-faint transition-transform', expanded && 'rotate-180')}
            aria-hidden
          />
        </button>

        <span className="hidden sm:inline-flex">
          <Badge tone="gold" dot pulse>
            {t('demo.badge')}
          </Badge>
        </span>

        <div
          className={cn(
            'w-full flex-wrap items-center gap-x-3 gap-y-2 sm:flex sm:w-auto sm:flex-nowrap',
            expanded ? 'flex' : 'hidden',
          )}
        >
          <p className="min-w-0 flex-1 text-xs leading-relaxed text-ink-faint sm:max-w-[19rem]">
            {t('demo.body')}
          </p>

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <Button
              size="sm"
              onClick={reset}
              icon={<RotateCcw className="size-3.5" aria-hidden />}
            >
              {t('demo.reset')}
            </Button>

            <a
              href={PORTFOLIO_URL}
              className={
                'inline-flex h-8 items-center gap-1 rounded-[8px] border border-hairline px-2.5 text-[13px] ' +
                'text-ink-muted transition-colors hover:border-hairline-strong hover:text-ink'
              }
            >
              {t('demo.portfolio')}
              <ArrowUpRight className="size-3.5" aria-hidden />
            </a>

            <IconButton size="sm" label={t('demo.dismiss')} onClick={() => setDismissed(true)}>
              <X className="size-3.5" />
            </IconButton>
          </div>
        </div>
      </div>
    </aside>
  )
}
