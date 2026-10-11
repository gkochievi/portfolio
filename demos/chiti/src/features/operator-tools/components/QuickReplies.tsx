import { useEffect, useRef, useState } from 'react'
import { Command } from 'cmdk'
import { CornerDownLeft, Zap } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { IconButton, Skeleton } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { QuickReplyCategory } from '@/types'

import { useQuickReplies } from '../api'
import type { QuickReplyView } from '../types'

const CATEGORIES: QuickReplyCategory[] = ['greetings', 'delivery', 'payment', 'closing']

/** Quick-replies popover: cmdk search over the tenant's replies, grouped by category. */
export function QuickReplies({ sessionId, customerLang, onInsert }: { sessionId: string; customerLang: string; onInsert: (text: string) => void }) {
  const { t } = useTranslation('operatorTools')
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const replies = useQuickReplies(sessionId, open)

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const pick = (reply: QuickReplyView) => {
    onInsert(reply.content)
    setOpen(false)
  }

  return (
    <div ref={root} className="relative">
      <IconButton
        label={t('quick.title')}
        icon={<Zap />}
        variant="muted"
        size="sm"
        active={open}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      />
      {open ? (
        <div
          role="dialog"
          aria-label={t('quick.title')}
          className="absolute bottom-full left-0 z-30 mb-2 w-[min(380px,calc(100vw-32px))] animate-pop-in overflow-hidden rounded-modal border border-line bg-panel text-ink shadow-pop"
        >
          <Command label={t('quick.title')} loop>
            <div className="border-b border-line px-3 py-2">
              <Command.Input
                autoFocus
                placeholder={t('quick.search')}
                className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
              />
            </div>
            <Command.List className="max-h-72 overflow-y-auto p-1.5">
              {replies.isLoading ? (
                <div className="space-y-2 p-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : replies.isError ? (
                <p className="p-3 text-[13px] text-danger" role="alert">
                  {t('quick.loadError')}
                </p>
              ) : (
                <>
                  <Command.Empty className="p-4 text-center text-[13px] text-muted">{t('quick.empty')}</Command.Empty>
                  {CATEGORIES.map((category) => {
                    const items = (replies.data ?? []).filter((reply) => reply.category === category)
                    if (items.length === 0) return null
                    return (
                      <Command.Group
                        key={category}
                        heading={t(`quick.category.${category}`)}
                        className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-[11.5px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted"
                      >
                        {items.map((reply) => (
                          <Command.Item
                            key={reply.id}
                            value={`${reply.title} ${reply.id}`}
                            keywords={[reply.content]}
                            onSelect={() => pick(reply)}
                            className={cn(
                              'group flex cursor-pointer items-start gap-2 rounded-ui px-2 py-1.5',
                              'data-[selected=true]:bg-hover',
                            )}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
                                {reply.title}
                                {reply.lang !== customerLang ? (
                                  <span className="rounded-sm bg-sunken px-1 font-mono text-[10px] uppercase text-muted">{reply.lang}</span>
                                ) : null}
                              </p>
                              <p className="line-clamp-2 text-xs leading-snug text-muted">{reply.content}</p>
                            </div>
                            <span className="mt-0.5 hidden shrink-0 items-center gap-1 text-[11px] text-accent group-data-[selected=true]:inline-flex">
                              <CornerDownLeft size={12} aria-hidden />
                              {t('quick.insert')}
                            </span>
                          </Command.Item>
                        ))}
                      </Command.Group>
                    )
                  })}
                </>
              )}
            </Command.List>
          </Command>
        </div>
      ) : null}
    </div>
  )
}
