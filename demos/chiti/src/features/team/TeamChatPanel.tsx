/**
 * Staff team chat (room + DMs). 'overlay' is the operator console's slide-over
 * (list and thread swap in one column); 'page' fills /admin/team with the list
 * on the left and the open thread on the right.
 */
import { useEffect, useState } from 'react'
import { MessagesSquare } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { EmptyState, toast } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { cn } from '@/lib/cn'

import { useConversations, useOpenDirect, useRoster } from './api'
import { ConversationList } from './components/ConversationList'
import { Thread } from './components/Thread'
import type { RosterEntry } from './types'

export interface TeamChatPanelProps {
  variant: 'overlay' | 'page'
  onClose?: () => void
}

export function TeamChatPanel({ variant }: TeamChatPanelProps) {
  const { t } = useTranslation('team')
  const roster = useRoster()
  const conversations = useConversations()
  const openDirect = useOpenDirect()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)

  const rows = conversations.data ?? []
  const room = rows.find((row) => row.kind === 'room')
  const selected = rows.find((row) => row.id === selectedId) ?? null
  const people = new Map((roster.data ?? []).map((entry) => [`${entry.role}:${entry.id}`, entry]))
  // The signed-in person is not in their own roster; their bubbles are right-aligned anyway.

  // On the page layout open the room by default (wide screens show both panes).
  useEffect(() => {
    if (variant === 'page' && !selectedId && room && typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches) {
      setSelectedId(room.id)
    }
  }, [variant, selectedId, room])

  const startDirect = (entry: RosterEntry) => {
    setPending(`${entry.role}:${entry.id}`)
    openDirect.mutate(entry, {
      onSuccess: (row) => setSelectedId(row.id),
      onError: (error) => toast.error(errorMessage(error, t('list.openFailed'))),
      onSettled: () => setPending(null),
    })
  }

  const list = (
    <ConversationList
      room={room}
      roster={roster.data ?? []}
      loading={roster.isLoading || conversations.isLoading}
      error={roster.isError || conversations.isError}
      onRetry={() => {
        void roster.refetch()
        void conversations.refetch()
      }}
      selectedId={selectedId}
      onOpenConversation={setSelectedId}
      onStartDirect={startDirect}
      pendingId={pending}
    />
  )

  const thread = selected ? (
    <Thread key={selected.id} conversation={selected} people={people} onBack={() => setSelectedId(null)} />
  ) : null

  if (variant === 'overlay') {
    return <section aria-label={t('title')} className="h-full min-h-0">{thread ?? list}</section>
  }

  return (
    <section aria-label={t('title')} className="grid h-full min-h-0 overflow-hidden rounded-modal border border-line bg-panel md:grid-cols-[340px_1fr]">
      <div className={cn('min-h-0 border-line md:border-r', selected ? 'hidden md:block' : 'block')}>{list}</div>
      <div className={cn('min-h-0', selected ? 'block' : 'hidden md:block')}>
        {thread ?? (
          <div className="grid h-full place-items-center p-6">
            <EmptyState icon={<MessagesSquare size={22} strokeWidth={1.75} />} title={t('page.pickTitle')} description={t('page.pickDescription')} illustration="nest" />
          </div>
        )}
      </div>
    </section>
  )
}
