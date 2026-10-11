/** Searchable campaign picker: a LiveDot per row (green = enabled, grey = disabled). Local because it needs rich rows. */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Command } from 'cmdk'
import { Check, ChevronsUpDown, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge, LiveDot } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { Campaign } from '@/types'

interface Props {
  campaigns: readonly Campaign[]
  value: string | null
  onChange: (id: string) => void
  disabled?: boolean
}

export function CampaignPicker({ campaigns, value, onChange, disabled }: Props) {
  const { t } = useTranslation('campaigns')
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const selected = campaigns.find((c) => c.id === value)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const haystack = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of campaigns) map.set(c.id, `${c.name} ${c.id} ${t(`types.${c.type}`)}`.toLowerCase())
    return map
  }, [campaigns, t])

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('picker.label')}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-11 w-full items-center justify-between gap-3 rounded-[8px] border border-line-strong bg-panel px-3 text-left text-[14px] text-ink transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          {selected && <LiveDot tone={selected.enabled ? 'success' : 'neutral'} still={!selected.enabled} />}
          <span className={cn('min-w-0 truncate font-medium', !selected && 'font-normal text-faint')}>
            {selected ? selected.name : t('picker.placeholder')}
          </span>
        </span>
        <ChevronsUpDown size={15} className="shrink-0 text-muted" aria-hidden />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-[60] overflow-hidden rounded-[10px] border border-pop-border bg-panel shadow-pop animate-pop-in">
          <Command
            filter={(id, search) => ((haystack.get(id) ?? '').includes(search.trim().toLowerCase()) ? 1 : 0)}
          >
            <div className="flex items-center gap-2 border-b border-line px-3">
              <Search size={15} className="text-muted" aria-hidden />
              <Command.Input
                autoFocus
                placeholder={t('picker.search')}
                className="h-10 w-full bg-transparent text-sm text-ink outline-none placeholder:text-faint"
              />
            </div>
            <Command.List className="scrollbar-thin max-h-[320px] overflow-y-auto p-1">
              <Command.Empty className="px-3 py-6 text-center text-[13px] text-muted">{t('picker.empty')}</Command.Empty>
              {campaigns.map((c) => (
                <Command.Item
                  key={c.id}
                  value={c.id}
                  onSelect={() => {
                    onChange(c.id)
                    setOpen(false)
                  }}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm data-[selected=true]:bg-hover"
                >
                  <Check size={14} className={cn('shrink-0 text-primary', c.id === value ? 'opacity-100' : 'opacity-0')} aria-hidden />
                  <LiveDot tone={c.enabled ? 'success' : 'neutral'} still={!c.enabled} />
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  <Badge tone="neutral" className="hidden shrink-0 sm:inline-flex">
                    {t(`types.${c.type}`)}
                  </Badge>
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </div>
      )}
    </div>
  )
}
