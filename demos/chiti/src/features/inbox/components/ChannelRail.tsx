import { Bot, Inbox } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ChannelGlyph } from '@/components/chat'
import { Tooltip } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { Channel } from '@/types'

import type { ChannelFilter } from '../types'

const CHANNEL_ORDER: Channel[] = ['web_widget', 'whatsapp', 'telegram', 'facebook_messenger', 'instagram', 'tiktok']
const FILTERS: ChannelFilter[] = ['all', ...CHANNEL_ORDER, 'bot']

export interface ChannelRailProps {
  value: ChannelFilter
  onChange: (value: ChannelFilter) => void
  counts: Record<ChannelFilter, number> | undefined
  /** Horizontal strip (mobile) instead of the 64px vertical rail. */
  horizontal?: boolean
}

export function ChannelRail({ value, onChange, counts, horizontal }: ChannelRailProps) {
  const { t } = useTranslation(['inbox', 'common'])
  return (
    <nav
      aria-label={t('inbox:rail.label')}
      className={cn(
        'shrink-0 bg-panel',
        horizontal
          ? 'flex gap-1 overflow-x-auto border-b border-line px-2 py-1.5'
          : 'flex w-16 flex-col items-center gap-1 overflow-y-auto border-r border-line py-3',
      )}
    >
      {FILTERS.map((filter) => {
        const active = value === filter
        const count = counts?.[filter] ?? 0
        const label = t(`common:channel.${filter}`)
        return (
          <Tooltip key={filter} content={`${label}${counts ? ` · ${count}` : ''}`} side={horizontal ? 'bottom' : 'right'}>
            <button
              type="button"
              aria-label={`${label}, ${t('inbox:rail.count', { count })}`}
              aria-pressed={active}
              onClick={() => onChange(filter)}
              className={cn(
                'relative grid shrink-0 place-items-center rounded-ui text-muted transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                horizontal ? 'size-10' : 'size-11',
                active ? 'bg-accent-soft text-accent' : 'hover:bg-hover hover:text-ink',
              )}
            >
              {active && !horizontal ? <span aria-hidden className="absolute -left-2 top-2 h-7 w-[3px] rounded-r-full bg-accent" /> : null}
              {filter === 'all' ? (
                <Inbox size={20} strokeWidth={1.75} />
              ) : filter === 'bot' ? (
                <Bot size={20} strokeWidth={1.75} />
              ) : (
                <ChannelGlyph channel={filter} size={20} />
              )}
              {count > 0 ? (
                <span
                  aria-hidden
                  className={cn(
                    'tabular absolute -right-0.5 -top-0.5 grid min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-semibold leading-[18px]',
                    active ? 'bg-accent text-on-accent' : 'bg-sunken text-ink ring-1 ring-line',
                  )}
                >
                  {count > 99 ? '99+' : count}
                </span>
              ) : null}
            </button>
          </Tooltip>
        )
      })}
    </nav>
  )
}
