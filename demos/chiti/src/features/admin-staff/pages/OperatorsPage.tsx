import { useMemo, useState } from 'react'
import { UserPlus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ConfirmDialog, EmptyState, ErrorState, PageHeader, SearchInput, Skeleton, Button, toast, Card } from '@/components/ui'
import { useAccount } from '@/lib/account'
import { personName } from '@/lib/format'
import type { Operator } from '@/types'

import { useDeleteStaff, useEndOperatorChats, useForceLogout, useForceStatus, useOperators } from '../api'
import { AuditLogDialog } from '../components/AuditLogDialog'
import { OperatorCard, type OperatorAction } from '../components/OperatorCard'
import { StaffFormDialog } from '../components/StaffFormDialog'
import { useStaffErrors } from '../errors'

type Confirm = { type: 'delete' | 'logout' | 'endChats'; operator: Operator } | null

export default function OperatorsPage() {
  const { t, i18n } = useTranslation('adminStaff')
  const tc = useTranslation().t
  const account = useAccount()
  const errors = useStaffErrors()
  const canManage = account?.role === 'admin'

  const [q, setQ] = useState('')
  const operators = useOperators(q.trim())
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Operator | null>(null)
  const [auditFor, setAuditFor] = useState<Operator | null>(null)
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const forceStatus = useForceStatus()
  const forceLogout = useForceLogout()
  const endChats = useEndOperatorChats()
  const remove = useDeleteStaff('operator')

  const rows = operators.data ?? []
  const summary = useMemo(
    () => ({ online: rows.filter((row) => row.status === 'online').length, away: rows.filter((row) => row.status === 'away').length }),
    [rows],
  )
  const nameOf = (operator: Operator) => personName(operator.name, i18n.language)

  const setStatus = async (operator: Operator, paused: boolean) => {
    setPendingId(operator.id)
    try {
      await forceStatus.mutateAsync({ id: operator.id, paused })
      toast.success(t(paused ? 'operators.toast.paused' : 'operators.toast.resumed', { name: nameOf(operator) }))
    } catch (error) {
      toast.error(errors.text(error))
    } finally {
      setPendingId(null)
    }
  }

  const onAction = (action: OperatorAction, operator: Operator) => {
    if (action === 'edit') {
      setEditing(operator)
      setFormOpen(true)
    } else if (action === 'audit') setAuditFor(operator)
    else if (action === 'pause') void setStatus(operator, true)
    else if (action === 'unpause') void setStatus(operator, false)
    else setConfirm({ type: action, operator })
  }

  const runConfirm = async () => {
    if (!confirm) return
    const { type, operator } = confirm
    const name = nameOf(operator)
    try {
      if (type === 'delete') {
        const result = await remove.mutateAsync(operator.id)
        toast.success(result.requeued ? t('operators.toast.deletedRequeued', { name, count: result.requeued }) : t('operators.toast.deleted', { name }))
      } else if (type === 'logout') {
        await forceLogout.mutateAsync(operator.id)
        toast.success(t('operators.toast.loggedOut', { name }))
      } else {
        const result = await endChats.mutateAsync(operator.id)
        toast.success(result.ended > 0 ? t('operators.toast.ended', { count: result.ended }) : t('operators.toast.endedNone', { name }))
      }
    } catch (error) {
      toast.error(errors.text(error))
      throw error
    }
  }

  const confirmCopy = confirm
    ? {
        delete: { title: 'operators.confirm.deleteTitle', body: 'operators.confirm.deleteBody', action: 'operators.confirm.deleteAction', danger: true },
        logout: { title: 'operators.confirm.logoutTitle', body: 'operators.confirm.logoutBody', action: 'operators.confirm.logoutAction', danger: true },
        endChats: { title: 'operators.confirm.endTitle', body: 'operators.confirm.endBody', action: 'operators.confirm.endAction', danger: true },
      }[confirm.type]
    : null

  const searching = q.trim().length > 0

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('operators.title')}
        description={canManage ? t('operators.description') : t('operators.descriptionSupervisor')}
        meta={
          operators.data ? (
            <span className="tabular text-[13px] text-muted">
              {t('operators.count', { count: rows.length })} · {t('operators.onlineSummary', summary)}
            </span>
          ) : null
        }
        actions={
          canManage ? (
            <Button
              leftIcon={<UserPlus size={18} strokeWidth={1.75} />}
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
            >
              {t('operators.add')}
            </Button>
          ) : null
        }
      />

      <div className="max-w-md">
        <SearchInput value={q} onChange={setQ} debounceMs={150} placeholder={t('operators.searchPlaceholder')} aria-label={tc('actions.search')} />
      </div>

      {operators.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label={tc('states.loading')}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Card key={i} padding="md" className="space-y-3">
              <div className="flex gap-3">
                <Skeleton className="size-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-3 w-3/4" />
            </Card>
          ))}
        </div>
      ) : operators.isError ? (
        <ErrorState title={t('operators.loadError')} description={errors.text(operators.error)} onRetry={() => void operators.refetch()} retryLabel={tc('actions.retry')} />
      ) : rows.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            illustration="nest"
            title={searching ? t('operators.noResultsTitle') : t('operators.emptyTitle')}
            description={searching ? t('operators.noResultsDescription', { q: q.trim() }) : t('operators.emptyDescription')}
            action={
              !searching && canManage ? (
                <Button
                  leftIcon={<UserPlus size={18} strokeWidth={1.75} />}
                  onClick={() => {
                    setEditing(null)
                    setFormOpen(true)
                  }}
                >
                  {t('operators.add')}
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((operator) => (
            <li key={operator.id} className="flex *:w-full">
              <OperatorCard operator={operator} canManage={canManage} busy={pendingId === operator.id} onAction={onAction} />
            </li>
          ))}
        </ul>
      )}

      {!canManage ? <p className="text-[13px] text-muted">{t('operators.readOnlyNote')}</p> : null}

      {canManage ? <StaffFormDialog kind="operator" open={formOpen} onOpenChange={setFormOpen} staff={editing} /> : null}
      {canManage ? <AuditLogDialog operator={auditFor} onOpenChange={(open) => !open && setAuditFor(null)} /> : null}

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(open) => !open && setConfirm(null)}
        tone={confirmCopy?.danger ? 'danger' : 'default'}
        title={confirm && confirmCopy ? t(confirmCopy.title, { name: nameOf(confirm.operator) }) : ''}
        description={confirm && confirmCopy ? t(confirmCopy.body) : undefined}
        confirmLabel={confirmCopy ? t(confirmCopy.action) : undefined}
        onConfirm={runConfirm}
      >
        {confirm?.type === 'delete' && confirm.operator.activeChatCount > 0 ? (
          <p className="text-[13px] font-medium text-warning">{t('operators.confirm.deleteChats', { count: confirm.operator.activeChatCount })}</p>
        ) : null}
      </ConfirmDialog>
    </div>
  )
}
