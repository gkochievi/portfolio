/**
 * The partner's synced call-centre roster with the billing switch and the
 * partner-sync simulation. Owner: licensing. Consumed by partners (?tab=users).
 */
import { RefreshCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Badge, Button, DataTable, DateText, EmptyState, FilterBar, Mono, SearchInput, SegmentedControl, Switch, type Column } from '@/components/ui'
import { useStaffMe } from '@/lib/session'

import { usePartnerUsers, useSetBilling, useSimulateSync, type PartnerUserRow } from '../api'
import { errorText } from '../lib/errors'

export interface SyncedUsersPanelProps {
  partnerId: string
  canEdit: boolean
}

const STATUS_TONE: Record<number, 'success' | 'info' | 'warning' | 'neutral' | 'accent'> = {
  0: 'neutral',
  1: 'success',
  2: 'info',
  3: 'accent',
  4: 'warning',
}

export function SyncedUsersPanel({ partnerId, canEdit }: SyncedUsersPanelProps) {
  const { t } = useTranslation('licensing')
  const me = useStaffMe()
  const isSuper = me?.role === 'superadmin'
  const canBill = canEdit && isSuper
  const users = usePartnerUsers(partnerId)
  const billing = useSetBilling(partnerId)
  const simulate = useSimulateSync(partnerId)
  const [selected, setSelected] = useState<string[]>([])
  const [q, setQ] = useState('')
  const [scope, setScope] = useState<'active' | 'all'>('active')

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return users.data?.filter(
      (u) =>
        (scope === 'all' || u.isActive) &&
        (!needle || [u.username, u.fullName, u.email, u.role, u.licenseName ?? ''].some((v) => v.toLowerCase().includes(needle))),
    )
  }, [users.data, q, scope])

  async function setBilling(userIds: string[], billingEnabled: boolean) {
    try {
      const res = await billing.mutateAsync({ userIds, billingEnabled })
      toast.success(billingEnabled ? t('users.enabledToast', { count: res.updated }) : t('users.disabledToast', { count: res.updated }))
      setSelected([])
    } catch (e) {
      toast.error(errorText(t, e))
    }
  }

  async function runSync() {
    try {
      const res = await simulate.mutateAsync()
      toast.success(t('users.syncToast', { created: res.created, deactivated: res.deactivated }), {
        description: t('users.syncToastDetail', { active: res.active }),
      })
    } catch (e) {
      toast.error(errorText(t, e))
    }
  }

  const columns: Column<PartnerUserRow>[] = [
    {
      key: 'username',
      header: t('users.cols.username'),
      sortable: true,
      sortValue: (u) => u.username,
      cell: (u) => (
        <div className="flex flex-col">
          <span className={u.isActive ? 'font-mono text-xs text-ink' : 'font-mono text-xs text-subtle line-through'}>{u.username}</span>
          <span className="text-xs text-muted sm:hidden">{u.fullName}</span>
        </div>
      ),
    },
    { key: 'fullName', header: t('users.cols.fullName'), sortable: true, sortValue: (u) => u.fullName, hideBelow: 'sm', cell: (u) => <span className="text-ink">{u.fullName}</span> },
    { key: 'role', header: t('users.cols.role'), hideBelow: 'lg', cell: (u) => <span className="text-muted">{u.role}</span> },
    {
      key: 'status',
      header: t('users.cols.status'),
      hideBelow: 'md',
      cell: (u) =>
        u.isActive ? (
          <span className="inline-flex items-center gap-1.5">
            <Badge tone={STATUS_TONE[u.statusCode] ?? 'neutral'}>{u.status}</Badge>
            <Mono>{u.statusCode}</Mono>
          </span>
        ) : (
          <Badge tone="danger">{t('users.deactivated')}</Badge>
        ),
    },
    {
      key: 'license',
      header: t('users.cols.license'),
      sortable: true,
      sortValue: (u) => u.licenseName ?? '',
      cell: (u) => (u.licenseName ? <span className="text-ink">{u.licenseName}</span> : <span className="text-subtle">{t('users.noLicense')}</span>),
    },
    {
      key: 'billed',
      header: t('users.cols.billed'),
      align: 'center',
      cell: (u) =>
        canBill ? (
          <Switch
            checked={u.billingEnabled}
            onCheckedChange={(v) => void setBilling([u.id], v)}
            disabled={billing.isPending}
            aria-label={t('users.billedAria', { user: u.username })}
          />
        ) : (
          <Badge tone={u.billingEnabled ? 'success' : 'neutral'}>{u.billingEnabled ? t('users.billed') : t('users.notBilled')}</Badge>
        ),
    },
    {
      key: 'syncedAt',
      header: t('users.cols.syncedAt'),
      hideBelow: 'md',
      sortable: true,
      sortValue: (u) => u.syncedAt,
      cell: (u) => <DateText value={u.syncedAt} withTime />,
    },
  ]

  const activeCount = users.data?.filter((u) => u.isActive).length ?? 0
  const billedCount = users.data?.filter((u) => u.isActive && u.billingEnabled).length ?? 0

  return (
    <div className="space-y-3">
      <FilterBar
        actions={
          isSuper && canEdit ? (
            <Button size="sm" variant="secondary" icon={<RefreshCcw />} loading={simulate.isPending} onClick={() => void runSync()}>
              {t('users.simulate')}
            </Button>
          ) : null
        }
      >
        <div className="w-full sm:w-64">
          <SearchInput value={q} onChange={setQ} placeholder={t('users.search')} />
        </div>
        <SegmentedControl
          size="sm"
          value={scope}
          onChange={(v) => setScope(v as 'active' | 'all')}
          options={[
            { value: 'active', label: t('users.scopeActive') },
            { value: 'all', label: t('users.scopeAll') },
          ]}
        />
        <span className="text-sm text-muted">{t('users.summary', { active: activeCount, billed: billedCount })}</span>
      </FilterBar>

      {canBill && selected.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-hairline bg-sunken px-3 py-2 text-sm">
          <span className="text-ink">{t('common:table.selected', { count: selected.length })}</span>
          <Button size="xs" variant="primary" loading={billing.isPending} onClick={() => void setBilling(selected, true)}>
            {t('users.enableBilling')}
          </Button>
          <Button size="xs" variant="secondary" loading={billing.isPending} onClick={() => void setBilling(selected, false)}>
            {t('users.disableBilling')}
          </Button>
          <Button size="xs" variant="ghost" onClick={() => setSelected([])}>
            {t('common:actions.clear')}
          </Button>
        </div>
      ) : null}

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(u) => u.id}
        selectable={canBill}
        selectedIds={selected}
        onSelectedChange={setSelected}
        rowClassName={(u) => (u.isActive ? undefined : 'opacity-60')}
        error={users.error ? errorText(t, users.error) : undefined}
        onRetry={() => void users.refetch()}
        initialSort={{ key: 'username', dir: 'asc' }}
        empty={<EmptyState compact title={q ? t('common:states.noResults') : t('users.empty')} />}
      />
    </div>
  )
}
