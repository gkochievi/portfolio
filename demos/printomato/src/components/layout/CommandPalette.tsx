import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CornerDownLeft, Megaphone, Printer, Search } from 'lucide-react'

import { cn } from '@/lib/cn'
import { useOverlay } from '@/lib/overlay'
import { useOptions } from '@/lib/queries'
import { NAV_ITEMS } from './AppShell'

interface Entry {
  id: string
  label: string
  meta?: string
  group: string
  to: string
  icon: React.ComponentType<{ className?: string }>
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: options } = useOptions(open)
  const [term, setTerm] = useState('')
  const [cursor, setCursor] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // autoFocus is off: the search input carries its own autoFocus attribute.
  useOverlay({ open, onClose, containerRef: panelRef, autoFocus: false })

  useEffect(() => {
    if (open) {
      setTerm('')
      setCursor(0)
    }
  }, [open])

  const entries = useMemo<Entry[]>(() => {
    const pages: Entry[] = NAV_ITEMS.map((item) => ({
      id: `page-${item.to}`,
      label: t(item.labelKey),
      group: 'Pages',
      to: item.to,
      icon: item.icon,
    }))

    const devices: Entry[] = (options?.devices ?? []).map((device) => ({
      id: `device-${device.id}`,
      label: device.name,
      meta: device.device_id,
      group: t('nav.devices'),
      to: `/devices?focus=${device.id}`,
      icon: Printer,
    }))

    const campaigns: Entry[] = (options?.campaigns ?? []).map((campaign) => ({
      id: `campaign-${campaign.id}`,
      label: campaign.name,
      meta: campaign.sponsor,
      group: t('nav.campaigns'),
      to: `/campaigns/${campaign.id}/photos`,
      icon: Megaphone,
    }))

    return [...pages, ...devices, ...campaigns]
  }, [options, t])

  const results = useMemo(() => {
    const needle = term.trim().toLowerCase()
    const matched = needle
      ? entries.filter(
          (entry) =>
            entry.label.toLowerCase().includes(needle) || entry.meta?.toLowerCase().includes(needle),
        )
      : entries.slice(0, 12)
    return matched.slice(0, 40)
  }, [entries, term])

  useEffect(() => setCursor(0), [term])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setCursor((current) => Math.min(current + 1, results.length - 1))
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setCursor((current) => Math.max(current - 1, 0))
      } else if (event.key === 'Enter') {
        event.preventDefault()
        const target = results[cursor]
        if (target) {
          navigate(target.to)
          onClose()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, results, cursor, navigate, onClose])

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  if (!open) return null

  let lastGroup = ''

  return createPortal(
    <div className="fixed inset-0 z-[170] flex items-start justify-center px-4 pt-[12vh]">
      <div className="animate-fade absolute inset-0 bg-void/80 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('common.search')}
        className="animate-rise relative w-full max-w-xl overflow-hidden rounded-panel border border-hairline-strong bg-surface shadow-raised"
      >
        <div className="flex items-center gap-3 border-b border-hairline px-4">
          <Search className="size-4 shrink-0 text-ink-faint" />
          <input
            autoFocus
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder={t('common.searchPlaceholder')}
            className="h-13 w-full bg-transparent py-4 text-[15px] text-ink placeholder:text-ink-faint/70 focus:outline-none"
          />
          <kbd className="numeral shrink-0 rounded border border-hairline bg-void/60 px-1.5 py-0.5 text-[10px] text-ink-faint">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-1.5">
          {results.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-ink-faint">No matches</p>
          )}
          {results.map((entry, index) => {
            const showGroup = entry.group !== lastGroup
            lastGroup = entry.group
            const active = index === cursor
            return (
              <div key={entry.id}>
                {showGroup && <p className="label-caps px-2.5 pt-3 pb-1.5">{entry.group}</p>}
                <button
                  type="button"
                  data-active={active}
                  onMouseEnter={() => setCursor(index)}
                  onClick={() => {
                    navigate(entry.to)
                    onClose()
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-control px-2.5 py-2.5 text-left transition-colors',
                    active ? 'bg-gold/12 text-ink' : 'text-ink-muted hover:bg-white/4',
                  )}
                >
                  <entry.icon className={cn('size-4 shrink-0', active ? 'text-gold' : 'text-ink-faint')} />
                  <span className="min-w-0 flex-1 truncate text-sm">{entry.label}</span>
                  {entry.meta && (
                    <span className="numeral shrink-0 text-[11px] text-ink-faint">{entry.meta}</span>
                  )}
                  {active && <CornerDownLeft className="size-3.5 shrink-0 text-gold" />}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>,
    document.body,
  )
}
