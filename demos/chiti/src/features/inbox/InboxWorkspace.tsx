/**
 * The operator inbox ("the nest"): channel rail, queue + my chats, the
 * conversation pane and the 340px drawer (customer context / copilot, or the
 * history panel). `/operator` and the `/live` split desk mount the same thing.
 * Layout follows the width of its own container, so it also works embedded:
 * < 768px stacked views (list -> thread -> drawer), < 1180px the drawer
 * overlays the thread, wider it sits beside it.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { IconButton, toast } from '@/components/ui'
import { OperatorDrawer, HistoryPanel } from '@/features/operator-tools'
import { errorMessage } from '@/lib/api'
import { cn } from '@/lib/cn'
import { useBusEvent } from '@/lib/realtime'
import type { CopilotRef } from '@/types'

import { useClaim, useInbox } from './api'
import { ChannelRail } from './components/ChannelRail'
import { ConversationList } from './components/ConversationList'
import { ThreadPane, type InsertRequest } from './components/ThreadPane'
import { useElementWidth } from './lib'
import type { ChannelFilter } from './types'

export interface InboxWorkspaceProps {
  /** Compact chrome for the /live split view (no page header, narrower list). */
  embedded?: boolean
}

type Panel = 'none' | 'drawer' | 'history'

export function InboxWorkspace({ embedded = false }: InboxWorkspaceProps) {
  const { t } = useTranslation(['inbox', 'common'])
  const [rootRef, width] = useElementWidth<HTMLDivElement>()
  const layout = width < 768 ? 'stacked' : width < 1180 ? 'overlay' : 'inline'

  const inbox = useInbox()
  const claim = useClaim()
  const [filter, setFilter] = useState<ChannelFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mobileView, setMobileView] = useState<'list' | 'thread'>('list')
  const [panelChoice, setPanelChoice] = useState<Panel | null>(null)
  const [insert, setInsert] = useState<InsertRequest | null>(null)
  const [takingId, setTakingId] = useState<string | null>(null)

  const panel: Panel = panelChoice ?? (layout === 'inline' && !embedded ? 'drawer' : 'none')

  // Open the first of my chats on wide screens, once.
  const autoSelected = useRef(false)
  useEffect(() => {
    if (autoSelected.current || layout === 'stacked' || selectedId || !inbox.data) return
    autoSelected.current = true
    const first = inbox.data.mine[0]
    if (first) setSelectedId(first.id)
  }, [inbox.data, layout, selectedId])

  useBusEvent('demo:reset', () => {
    autoSelected.current = false
    setSelectedId(null)
    setMobileView('list')
    setPanelChoice(null)
    setInsert(null)
  })

  const select = useCallback((sessionId: string) => {
    setSelectedId(sessionId)
    setMobileView('thread')
  }, [])

  const take = useCallback(
    (sessionId: string) => {
      setTakingId(sessionId)
      claim.mutate(sessionId, {
        onSuccess: (session) => {
          toast.success(t('inbox:queue.taken', { name: session.customerName }))
          select(sessionId)
        },
        onError: (error) => toast.error(errorMessage(error, t('inbox:error.take'))),
        onSettled: () => setTakingId(null),
      })
    },
    [claim, select, t],
  )

  const closeThread = useCallback(() => {
    setSelectedId(null)
    setMobileView('list')
  }, [])

  const toggle = (next: Exclude<Panel, 'none'>) => setPanelChoice(panel === next ? 'none' : next)

  const onInsert = useCallback((text: string, ref?: Omit<CopilotRef, 'action'>) => {
    setInsert({ nonce: Date.now() + Math.random(), text, ref, mode: ref ? 'replace' : 'append' })
    setPanelChoice((current) => (current === null ? current : 'none'))
    setMobileView('thread')
  }, [])

  const list = (
    <ConversationList
      data={inbox.data}
      loading={inbox.isLoading}
      error={inbox.isError}
      onRetry={() => void inbox.refetch()}
      filter={filter}
      selectedId={selectedId}
      onSelect={select}
      onTake={take}
      takingId={takingId}
    />
  )

  const thread = (
    <ThreadPane
      sessionId={selectedId}
      inbox={inbox.data}
      embedded={embedded}
      stacked={layout === 'stacked'}
      drawerOpen={panel === 'drawer'}
      historyOpen={panel === 'history'}
      onToggleDrawer={() => toggle('drawer')}
      onToggleHistory={() => toggle('history')}
      onBack={() => setMobileView('list')}
      insert={insert}
      onTake={take}
      takingId={takingId}
      onClosed={closeThread}
    />
  )

  const panelBody =
    panel === 'history' ? (
      <HistoryPanel onClose={() => setPanelChoice('none')} />
    ) : panel === 'drawer' && selectedId ? (
      <OperatorDrawer sessionId={selectedId} onInsert={onInsert} onClose={() => setPanelChoice('none')} />
    ) : null

  if (layout === 'stacked') {
    return (
      <div ref={rootRef} className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-bg">
        {mobileView === 'list' ? (
          <>
            <ChannelRail horizontal value={filter} onChange={setFilter} counts={inbox.data?.channelCounts} />
            {list}
          </>
        ) : (
          thread
        )}
        {panelBody && mobileView === 'thread' ? (
          <div className="absolute inset-0 z-20 flex flex-col bg-panel animate-fade-in">
            <div className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-2">
              <IconButton label={t('inbox:thread.backToChat')} icon={<ArrowLeft />} onClick={() => setPanelChoice('none')} />
              <span className="font-display text-sm font-semibold">{panel === 'history' ? t('inbox:thread.toggleHistory') : t('inbox:thread.toggleDrawer')}</span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{panelBody}</div>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div ref={rootRef} className="relative flex h-full min-h-0 w-full overflow-hidden bg-bg">
      <ChannelRail value={filter} onChange={setFilter} counts={inbox.data?.channelCounts} />
      <aside
        aria-label={t('inbox:list.label')}
        className={cn('flex min-h-0 shrink-0 flex-col border-r border-line bg-panel', embedded ? 'w-[272px]' : 'w-80')}
      >
        {list}
      </aside>
      {thread}
      {panelBody ? (
        <aside
          aria-label={panel === 'history' ? t('inbox:thread.toggleHistory') : t('inbox:thread.toggleDrawer')}
          className={cn(
            'flex min-h-0 w-[340px] max-w-full flex-col border-l border-line bg-panel',
            layout === 'overlay' ? 'absolute inset-y-0 right-0 z-20 shadow-pop animate-slide-in-right' : 'shrink-0',
          )}
        >
          {panelBody}
        </aside>
      ) : null}
    </div>
  )
}
