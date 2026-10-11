/** /console/bot-control - the global kill switch and per-workspace autopilot / stop. OWNED BY: copilot. */
import { OctagonX, Play, Power } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { errorMessage } from '@/api/client'
import { Badge, Button, Callout, Card, ConfirmDialog, DataTable, PageHeader, Skeleton, StatTile, StatusChip, Switch, toast, type Column } from '@/components/ui'
import { useFormat } from '@/lib/format'
import { useBotControl, useCopilotSync, useSetGlobalKill, useSetTenantBot } from '../api'
import type { ControlRow } from '../types'

type Reason = 'global' | 'stopped' | 'inactive' | 'off' | 'no_docs' | 'ok'

export default function BotControlPage() {
  const { t, i18n } = useTranslation('copilot')
  const f = useFormat()
  const query = useBotControl()
  const setKill = useSetGlobalKill()
  const setTenant = useSetTenantBot()
  const [confirm, setConfirm] = useState<'stop' | 'resume' | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  useCopilotSync()

  const data = query.data
  const globalOff = data?.kill.global_disabled ?? false

  const reasonOf = (row: ControlRow): Reason =>
    globalOff ? 'global' : row.disabled ? 'stopped' : !row.is_active ? 'inactive' : !row.autopilot ? 'off' : row.public_docs === 0 ? 'no_docs' : 'ok'
  const name = (row: ControlRow) => (i18n.language === 'ka' ? row.name_ka : row.name)

  const run = async (id: string, patch: { disabled?: boolean; autopilot_enabled?: boolean }, message: string) => {
    setPending(id)
    try {
      await setTenant.mutateAsync({ id, ...patch })
      toast.success(message)
    } catch (error) {
      toast.error(errorMessage(error, t('control.error')))
    } finally {
      setPending(null)
    }
  }

  const applyGlobal = async () => {
    const stop = confirm === 'stop'
    try {
      await setKill.mutateAsync(stop)
      toast.success(stop ? t('control.stoppedToast') : t('control.resumedToast'))
    } catch (error) {
      toast.error(errorMessage(error, t('control.error')))
      throw error
    }
  }

  const columns: Column<ControlRow>[] = [
    {
      key: 'name',
      header: t('control.workspace'),
      sortable: (row) => name(row).toLowerCase(),
      cell: (row) => (
        <div className="min-w-0">
          <div className="truncate font-medium">{name(row)}</div>
          {!row.is_active ? <Badge size="sm" tone="neutral">{t('control.inactive')}</Badge> : null}
        </div>
      ),
    },
    {
      key: 'autopilot',
      header: t('control.autopilot'),
      sortable: (row) => Number(row.autopilot),
      cell: (row) => (
        <Switch
          size="sm"
          checked={row.autopilot}
          disabled={pending === row.id || (!row.autopilot && row.public_docs === 0)}
          aria-label={t('control.autopilotFor', { name: name(row) })}
          onCheckedChange={(on) => void run(row.id, { autopilot_enabled: on }, on ? t('control.autopilotOn', { name: name(row) }) : t('control.autopilotOff', { name: name(row) }))}
        />
      ),
    },
    {
      key: 'docs',
      header: t('control.publicDocs'),
      align: 'right',
      hideBelow: 'sm',
      sortable: (row) => row.public_docs,
      cell: (row) => <span className="tabular">{f.number(row.public_docs)}</span>,
    },
    {
      key: 'state',
      header: t('control.state'),
      sortable: (row) => Number(row.reachable),
      cell: (row) => {
        const reason = reasonOf(row)
        return (
          <StatusChip tone={reason === 'ok' ? 'success' : reason === 'off' || reason === 'inactive' ? 'neutral' : reason === 'no_docs' ? 'warning' : 'danger'}>
            {t(`control.reason.${reason}`)}
          </StatusChip>
        )
      },
    },
    {
      key: 'action',
      header: <span className="sr-only">{t('control.actions')}</span>,
      align: 'right',
      cell: (row) =>
        row.disabled ? (
          <Button size="sm" variant="secondary" icon={<Play className="size-3.5" />} loading={pending === row.id} onClick={() => void run(row.id, { disabled: false }, t('control.resumedFor', { name: name(row) }))}>
            {t('control.resume')}
          </Button>
        ) : (
          <Button size="sm" variant="danger-ghost" icon={<OctagonX className="size-3.5" />} loading={pending === row.id} onClick={() => void run(row.id, { disabled: true }, t('control.stoppedFor', { name: name(row) }))}>
            {t('control.stop')}
          </Button>
        ),
    },
  ]

  const reachable = data?.rows.filter((r) => reasonOf(r) === 'ok').length ?? 0
  const stopped = data?.rows.filter((r) => r.disabled).length ?? 0
  const autopilotOn = data?.rows.filter((r) => r.autopilot).length ?? 0

  return (
    <>
      <PageHeader title={t('control.title')} description={t('control.description')} />
      {query.isLoading ? (
        <div className="space-y-5">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : query.isError || !data ? (
        <Callout tone="danger" title={t('loadError')} action={<Button size="sm" onClick={() => void query.refetch()}>{t('retry')}</Button>}>
          {errorMessage(query.error, t('loadError'))}
        </Callout>
      ) : (
        <div className="space-y-5">
          <Card className={globalOff ? 'border-danger/40 bg-danger/5' : undefined}>
            <div className="flex flex-wrap items-center gap-4">
              <span aria-hidden className={`grid size-11 shrink-0 place-items-center rounded-full ${globalOff ? 'bg-danger/15 text-danger' : 'bg-success/15 text-success'}`}>
                <Power className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-sans text-base font-semibold">{globalOff ? t('control.globalOffTitle') : t('control.globalOnTitle')}</h2>
                <p className="mt-0.5 text-sm text-muted">{globalOff ? t('control.globalOffBody') : t('control.globalOnBody')}</p>
                {data.kill.updated_by ? (
                  <p className="mt-1 text-xs text-subtle">{t('control.lastChange', { who: data.kill.updated_by, when: f.relative(data.kill.updated_at) })}</p>
                ) : null}
              </div>
              {globalOff ? (
                <Button variant="primary" icon={<Play className="size-4" />} onClick={() => setConfirm('resume')}>
                  {t('control.resumeAll')}
                </Button>
              ) : (
                <Button variant="danger" icon={<OctagonX className="size-4" />} onClick={() => setConfirm('stop')}>
                  {t('control.stopAll')}
                </Button>
              )}
            </div>
          </Card>

          <div className="grid gap-3 sm:grid-cols-3">
            <StatTile label={t('control.statAutopilot')} value={f.number(autopilotOn)} hint={t('control.ofWorkspaces', { total: data.rows.length })} />
            <StatTile label={t('control.statReachable')} value={f.number(reachable)} hint={t('control.reachableHint')} tone={reachable > 0 ? 'success' : undefined} />
            <StatTile label={t('control.statStopped')} value={f.number(stopped)} hint={t('control.stoppedHint')} tone={stopped > 0 ? 'danger' : undefined} />
          </div>

          <DataTable<ControlRow>
            rows={data.rows}
            columns={columns}
            rowKey={(row) => row.id}
            pageSize={0}
            defaultSort={{ key: 'name', dir: 'asc' }}
            caption={t('control.tableCaption')}
          />
        </div>
      )}

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={confirm === 'stop' ? t('control.confirmStopTitle') : t('control.confirmResumeTitle')}
        body={confirm === 'stop' ? t('control.confirmStopBody') : t('control.confirmResumeBody')}
        confirmLabel={confirm === 'stop' ? t('control.stopAll') : t('control.resumeAll')}
        danger={confirm === 'stop'}
        onConfirm={applyGlobal}
      />
    </>
  )
}
