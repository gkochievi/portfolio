/** Cmd-K: search call records by number / extension / call ID, or jump to a page. */
import { useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Command } from 'cmdk'
import { CornerDownLeft, PhoneCall, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import type { NavGroup } from './nav'

export function CommandSearch({
  open,
  onOpenChange,
  groups,
  canSearchCalls,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  groups: NavGroup[]
  canSearchCalls: boolean
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const q = query.trim()

  const go = (to: string) => {
    onOpenChange(false)
    setQuery('')
    navigate(to)
  }

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) setQuery('')
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay animate-fade-in" />
        <DialogPrimitive.Content className="fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-32px)] max-w-[560px] -translate-x-1/2 overflow-hidden rounded-[10px] border border-pop-border bg-panel text-ink shadow-pop animate-pop-in focus:outline-none">
          <DialogPrimitive.Title className="sr-only">{t('shell:search.open')}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">{t('shell:search.placeholder')}</DialogPrimitive.Description>
          <Command shouldFilter label={t('shell:search.open')}>
            <div className="flex items-center gap-2.5 border-b border-line px-4">
              <Search size={18} strokeWidth={1.75} className="text-muted" aria-hidden />
              <Command.Input
                autoFocus
                value={query}
                onValueChange={setQuery}
                placeholder={t('shell:search.placeholder')}
                className="h-12 w-full bg-transparent text-[15px] outline-none placeholder:text-faint"
              />
              <kbd className="hidden rounded border border-line px-1.5 font-mono text-[11px] text-muted sm:inline">Esc</kbd>
            </div>
            <Command.List className="scrollbar-thin max-h-[min(420px,60vh)] overflow-y-auto p-1.5">
              {q && canSearchCalls && (
                <Command.Group heading={t('shell:search.calls')} className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[12px] [&_[cmdk-group-heading]]:text-muted">
                  <Command.Item
                    value={`__search ${q}`}
                    keywords={[q]}
                    onSelect={() => go(`/calls?number=${encodeURIComponent(q)}`)}
                    className="flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2.5 text-[14px] data-[selected=true]:bg-hover"
                  >
                    <PhoneCall size={17} strokeWidth={1.75} className="text-primary" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{t('shell:search.searchNumber', { q })}</span>
                    <CornerDownLeft size={15} className="text-muted" aria-hidden />
                  </Command.Item>
                </Command.Group>
              )}
              {!q && (
                <div className="px-3 py-3 text-[13px] text-muted">
                  {canSearchCalls ? t('shell:search.empty') : t('shell:search.noCalls')}
                </div>
              )}
              <Command.Group heading={t('shell:search.goTo')} className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[12px] [&_[cmdk-group-heading]]:text-muted">
                {groups.flatMap((g) =>
                  g.items.map((item) => {
                    const Icon = item.icon
                    const label = t(`common:${item.labelKey}`)
                    return (
                      <Command.Item
                        key={item.path}
                        value={`${label} ${item.path}`}
                        onSelect={() => go(item.path)}
                        className="flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-[13.5px] data-[selected=true]:bg-hover"
                      >
                        <Icon size={16} strokeWidth={1.75} className="text-muted" aria-hidden />
                        <span className="flex-1">{label}</span>
                        <span className="text-[12px] text-faint">{t(`common:nav.groups.${g.id}`)}</span>
                      </Command.Item>
                    )
                  }),
                )}
              </Command.Group>
            </Command.List>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
