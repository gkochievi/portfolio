import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Eraser, MessagesSquare } from 'lucide-react'

import { PageHeader, Button, Card, EmptyState, ErrorState, SkeletonRow, Tabs, TabsList, TabsTrigger, ConfirmDialog, toast } from '@/components/ui'
import { errorMessage } from '@/api/client'
import { useAccount } from '@/lib/account'
import { cn } from '@/lib/cn'
import { useNow } from '@/lib/realtime'

import { useAdminSessions, useClearQueue, useSpectateDetail } from '../api'
import { SessionRow } from '../components/SessionRow'
import { SpectateThread } from '../components/SpectateThread'
import type { AdminSessionTab } from '../types'

const TABS: AdminSessionTab[] = ['live', 'pending', 'inactive', 'today']
const isTab = (value: string | null): value is AdminSessionTab => TABS.includes(value as AdminSessionTab)

/** Opens the tab a deep-linked chat belongs to when the URL names a chat but no tab. */
function TabFromSession({ sessionId, onTab }: { sessionId: string; onTab: (tab: AdminSessionTab) => void }) {
  const detail = useSpectateDetail(sessionId)
  const status = detail.data?.session.status
  useEffect(() => {
    if (!status) return
    onTab(status === 'waiting' ? 'pending' : status === 'inactive' ? 'inactive' : status === 'ended' ? 'today' : 'live')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])
  return null
}

export default function ChatsPage() {
  const { t } = useTranslation(['adminLive', 'common'])
  const account = useAccount()
  const canAct = account?.role === 'admin'
  const [params, setParams] = useSearchParams()
  const sessionId = params.get('session')
  const tabParam = params.get('tab')
  const tab: AdminSessionTab = isTab(tabParam) ? tabParam : 'live'
  const query = useAdminSessions(tab)
  const clear = useClearQueue()
  const nowMs = useNow(1_000)
  const [confirmClear, setConfirmClear] = useState(false)

  const update = (patch: Record<string, string | null>, replace = false) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        for (const [key, value] of Object.entries(patch)) {
          if (value === null) next.delete(key)
          else next.set(key, value)
        }
        return next
      },
      { replace },
    )
  }

  const counts = query.data?.counts
  const rows = query.data?.rows ?? []

  const emptyKey = `${tab}Title` as const
  const hasSelection = Boolean(sessionId)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t('chats.title')}
        description={canAct ? t('chats.subtitle') : t('chats.subtitleReadOnly')}
        actions={
          canAct && tab === 'pending' ? (
            <Button
              variant="danger-outline"
              leftIcon={<Eraser size={18} strokeWidth={1.75} />}
              disabled={!counts || counts.pending === 0}
              onClick={() => setConfirmClear(true)}
            >
              {t('chats.clear.button')}
            </Button>
          ) : undefined
        }
      />

      {sessionId && !isTab(tabParam) ? <TabFromSession sessionId={sessionId} onTab={(next) => update({ tab: next }, true)} /> : null}

      <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <Card padding="none" className={cn('flex min-h-0 flex-col overflow-hidden lg:h-[calc(100dvh-13rem)] lg:min-h-[32rem]', hasSelection && 'hidden lg:flex')}>
          <Tabs value={tab} onValueChange={(next) => update({ tab: next })} className="border-b border-line px-2">
            <TabsList className="w-full overflow-x-auto">
              {TABS.map((key) => (
                <TabsTrigger key={key} value={key} count={counts?.[key]}>
                  {t(`chats.tabs.${key}`)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="min-h-0 flex-1 overflow-y-auto" role="group" aria-label={t(`chats.tabs.${tab}`)}>
            {query.isPending ? (
              <div className="space-y-1 p-2">
                {[0, 1, 2, 3].map((i) => (
                  <SkeletonRow key={i} />
                ))}
              </div>
            ) : query.isError ? (
              <ErrorState title={t('chats.loadError')} description={errorMessage(query.error)} onRetry={() => void query.refetch()} retryLabel={t('common:actions.retry')} />
            ) : rows.length === 0 ? (
              <EmptyState
                illustration="nest"
                title={t(`chats.empty.${emptyKey}`)}
                description={t(`chats.empty.${tab}Text`)}
                compact
              />
            ) : (
              rows.map((row) => (
                <SessionRow
                  key={row.id}
                  session={row}
                  nowMs={nowMs}
                  selected={row.id === sessionId}
                  showEndSummary={tab === 'today'}
                  onSelect={(id) => update({ session: id })}
                />
              ))
            )}
          </div>
        </Card>

        <Card padding="none" className={cn('min-h-0 overflow-hidden lg:h-[calc(100dvh-13rem)] lg:min-h-[32rem]', !hasSelection && 'hidden lg:block')}>
          {sessionId ? (
            <SpectateThread
              key={sessionId}
              sessionId={sessionId}
              canAct={canAct}
              onBack={() => update({ session: null })}
              className="h-[calc(100dvh-11rem)] min-h-[28rem] lg:h-full"
            />
          ) : (
            <EmptyState icon={<MessagesSquare size={28} strokeWidth={1.5} />} title={t('chats.select.title')} description={t('chats.select.text')} />
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        tone="danger"
        title={t('chats.clear.title')}
        description={t('chats.clear.description', { count: counts?.pending ?? 0 })}
        confirmLabel={t('chats.clear.confirm')}
        cancelLabel={t('common:actions.cancel')}
        onConfirm={async () => {
          try {
            const result = await clear.mutateAsync()
            toast.success(t('chats.clear.done', { count: result.cleared }))
          } catch (error) {
            toast.error(errorMessage(error, t('chats.clear.empty')))
            throw error
          }
        }}
      />
    </div>
  )
}
