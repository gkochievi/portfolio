import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Building2,
  Cpu,
  Globe,
  HeartPulse,
  KeyRound,
  MoreHorizontal,
  Plug,
  Plus,
  ShieldCheck,
  UserCog,
  UserPlus,
  Users,
} from 'lucide-react'

import {
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
  ErrorState,
  FilterChip,
  IconButton,
  KpiTile,
  Menu,
  PageHeader,
  SearchInput,
  toast,
  type Column,
} from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatDate, formatNumber, pickText } from '@/lib/format'

import { useEraseTenant, useOverview, useSuperErrors, useTenantAction, useTenants, type TenantStateFilter } from '../api'
import { CreateTenantDialog } from '../components/CreateTenantDialog'
import { MemberFormDialog } from '../components/MemberFormDialog'
import { OriginsDialog } from '../components/OriginsDialog'
import { CopyButton, StateBadge } from '../components/shared'
import type { MemberRole, TenantRow } from '../types'
import { useLogInAs } from '../useLogInAs'

type Pending = { kind: 'disable' | 'delete' | 'erase'; tenant: TenantRow } | null

export default function TenantsPage() {
  const { t, i18n } = useTranslation('superadmin')
  const lang = i18n.language
  const navigate = useNavigate()
  const errors = useSuperErrors()
  const [q, setQ] = useState('')
  const [state, setState] = useState<TenantStateFilter>('all')
  const overview = useOverview()
  const tenants = useTenants({ q, state })
  const everyone = useTenants({})
  const action = useTenantAction()
  const erase = useEraseTenant()
  const { logInAsFirstAdmin } = useLogInAs()

  const [createTenantOpen, setCreateTenantOpen] = useState(false)
  const [memberDialog, setMemberDialog] = useState<{ role: MemberRole; tenantId?: string; lock?: boolean } | null>(null)
  const [originsFor, setOriginsFor] = useState<TenantRow | null>(null)
  const [pending, setPending] = useState<Pending>(null)

  const all = everyone.data ?? []
  const ov = overview.data

  const run = async (tenant: TenantRow, kind: 'disable' | 'enable' | 'delete' | 'restore') => {
    try {
      await action.mutateAsync({ id: tenant.id, action: kind })
      toast.success(t(`toast.${kind}`, { name: pickText(tenant.name, lang) }))
    } catch (failure) {
      toast.error(errors.text(failure))
      throw failure
    }
  }

  const link = (tenant: TenantRow, tab: string, value: number) => (
    <Link to={`/superadmin/tenants/${tenant.id}?tab=${tab}`} className="link tabular" aria-label={t('table.manageLink', { count: value, tab: t(`tabs.${tab}`) })}>
      {formatNumber(value, lang)}
    </Link>
  )

  const columns: Column<TenantRow>[] = [
    {
      id: 'name',
      header: t('table.tenant'),
      sortValue: (row) => pickText(row.name, lang).toLowerCase(),
      cell: (row) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-ui bg-sunken font-display text-[13px] font-semibold text-ink">
            {pickText(row.name, lang).slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <Link to={`/superadmin/tenants/${row.id}`} className="block truncate font-medium text-ink hover:underline">
              {pickText(row.name, lang)}
            </Link>
            <p className="truncate text-[12px] text-muted">{pickText(row.industry, lang)}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'slug',
      header: t('table.slug'),
      hideBelow: 'md',
      cell: (row) => (
        <span className="inline-flex items-center gap-0.5">
          <code className="font-mono text-[12px] text-muted">{row.slug}</code>
          <CopyButton value={row.slug} label={t('table.copySlug')} />
        </span>
      ),
    },
    { id: 'state', header: t('table.state'), sortValue: (row) => row.state, cell: (row) => <StateBadge state={row.state} /> },
    { id: 'admins', header: t('table.admins'), align: 'right', hideBelow: 'sm', sortValue: (row) => row.counts.admins, cell: (row) => link(row, 'admins', row.counts.admins) },
    { id: 'operators', header: t('table.operators'), align: 'right', hideBelow: 'sm', sortValue: (row) => row.counts.operators, cell: (row) => link(row, 'operators', row.counts.operators) },
    { id: 'supervisors', header: t('table.supervisors'), align: 'right', hideBelow: 'lg', sortValue: (row) => row.counts.supervisors, cell: (row) => link(row, 'supervisors', row.counts.supervisors) },
    { id: 'customers', header: t('table.customers'), align: 'right', hideBelow: 'lg', sortValue: (row) => row.counts.customers, cell: (row) => <span className="tabular">{formatNumber(row.counts.customers, lang)}</span> },
    {
      id: 'origins',
      header: t('table.origins'),
      align: 'right',
      hideBelow: 'md',
      sortValue: (row) => row.allowedOrigins.length,
      cell: (row) => (
        <button
          type="button"
          onClick={() => setOriginsFor(row)}
          className="tabular inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded-ui border border-line px-2 text-[13px] text-ink hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent"
          aria-label={t('table.editOrigins', { count: row.allowedOrigins.length })}
        >
          <Globe size={13} strokeWidth={1.75} aria-hidden />
          {row.allowedOrigins.length}
        </button>
      ),
    },
    {
      id: 'created',
      header: t('table.created'),
      hideBelow: 'lg',
      sortValue: (row) => Date.parse(row.createdAt),
      cell: (row) => <span className="whitespace-nowrap text-muted">{formatDate(row.createdAt, lang)}</span>,
    },
    {
      id: 'menu',
      header: <span className="sr-only">{t('table.actions')}</span>,
      align: 'right',
      width: '48px',
      cell: (row) => (
        <Menu
          align="end"
          trigger={<IconButton size="sm" variant="ghost" label={t('table.rowMenu', { name: pickText(row.name, lang) })} icon={<MoreHorizontal strokeWidth={1.75} />} />}
          items={[
            { label: t('menu.manage'), icon: <Building2 />, onSelect: () => navigate(`/superadmin/tenants/${row.id}`) },
            { label: t('menu.origins'), icon: <Globe />, onSelect: () => setOriginsFor(row) },
            ...(row.state === 'active' ? [{ label: t('menu.disable'), icon: <Plug />, onSelect: () => setPending({ kind: 'disable', tenant: row }), separated: true }] : []),
            ...(row.state === 'disabled' ? [{ label: t('menu.enable'), icon: <Plug />, onSelect: () => void run(row, 'enable').catch(() => undefined), separated: true }] : []),
            ...(row.state !== 'deleted' ? [{ label: t('menu.delete'), icon: <ShieldCheck />, tone: 'danger' as const, onSelect: () => setPending({ kind: 'delete', tenant: row }) }] : []),
            ...(row.state === 'deleted' ? [{ label: t('menu.restore'), icon: <ShieldCheck />, onSelect: () => void run(row, 'restore').catch(() => undefined), separated: true }] : []),
            ...(row.state === 'deleted' ? [{ label: t('menu.erase'), icon: <ShieldCheck />, tone: 'danger' as const, onSelect: () => setPending({ kind: 'erase', tenant: row }) }] : []),
            { label: t('menu.logInAs'), icon: <UserCog />, disabled: row.state !== 'active', separated: true, onSelect: () => void logInAsFirstAdmin(row.id) },
          ]}
        />
      ),
    },
  ]

  const quick = useMemo(
    () => [
      { key: 'tenant', icon: <Building2 />, label: t('quick.createTenant'), onClick: () => setCreateTenantOpen(true) },
      { key: 'admin', icon: <UserPlus />, label: t('quick.createAdmin'), onClick: () => setMemberDialog({ role: 'admin' }) },
      { key: 'operator', icon: <Users />, label: t('quick.createOperator'), onClick: () => setMemberDialog({ role: 'operator' }) },
      { key: 'supervisor', icon: <ShieldCheck />, label: t('quick.createSupervisor'), onClick: () => setMemberDialog({ role: 'supervisor' }) },
      { key: 'platform', icon: <Plug />, label: t('quick.platform'), to: '/superadmin/platform' },
      { key: 'health', icon: <HeartPulse />, label: t('quick.health'), to: '/superadmin/health' },
      { key: 'ai', icon: <KeyRound />, label: t('quick.ai'), to: '/superadmin/ai' },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [i18n.language],
  )

  const tileClass =
    'flex h-full min-h-[84px] flex-col items-start justify-between gap-3 rounded-ui border border-line bg-panel p-3 text-left text-[13px] font-medium text-ink transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent [&_svg]:size-5 [&_svg]:text-accent'

  const counts = ov?.tenants

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('tenants.title')}
        description={t('tenants.description')}
        actions={
          <Button leftIcon={<Plus />} onClick={() => setCreateTenantOpen(true)}>
            {t('quick.createTenant')}
          </Button>
        }
      />

      <section aria-label={t('kpi.label')} className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <KpiTile label={t('kpi.tenants')} value={ov ? formatNumber(ov.tenants.total, lang) : '–'} hint={ov ? t('kpi.tenantsHint', { active: ov.tenants.active }) : undefined} icon={<Building2 />} loading={overview.isLoading} />
        <KpiTile label={t('kpi.admins')} value={ov ? formatNumber(ov.admins, lang) : '–'} icon={<ShieldCheck />} loading={overview.isLoading} />
        <KpiTile label={t('kpi.operators')} value={ov ? formatNumber(ov.operators, lang) : '–'} icon={<Users />} loading={overview.isLoading} />
        <KpiTile label={t('kpi.customers')} value={ov ? formatNumber(ov.customers, lang) : '–'} icon={<UserCog />} loading={overview.isLoading} />
        <KpiTile label={t('kpi.sessions')} value={ov ? formatNumber(ov.sessions, lang) : '–'} icon={<Cpu />} loading={overview.isLoading} />
      </section>

      <section aria-label={t('quick.label')} className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {quick.map((item) =>
          'to' in item && item.to ? (
            <Link key={item.key} to={item.to} className={tileClass}>
              {item.icon}
              {item.label}
            </Link>
          ) : (
            <button key={item.key} type="button" onClick={item.onClick} className={tileClass}>
              {item.icon}
              {item.label}
            </button>
          ),
        )}
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <Card padding="md" className="space-y-4 lg:sticky lg:top-20" aria-label={t('filters.title')}>
          <h2 className="font-display text-[14px] font-semibold text-ink">{t('filters.title')}</h2>
          <SearchInput value={q} onChange={setQ} placeholder={t('filters.search')} />
          <div>
            <p className="mb-2 text-[12px] font-medium text-muted">{t('filters.state')}</p>
            <div className="flex flex-wrap gap-2 lg:flex-col lg:items-stretch">
              {(['all', 'active', 'disabled', 'deleted'] as const).map((value) => (
                <FilterChip
                  key={value}
                  active={state === value}
                  onClick={() => setState(value)}
                  count={value === 'all' ? counts?.total : counts?.[value]}
                >
                  {t(`filters.states.${value}`)}
                </FilterChip>
              ))}
            </div>
          </div>
          {(q || state !== 'all') && (
            <Button variant="ghost" size="sm" onClick={() => { setQ(''); setState('all') }}>
              {t('common:actions.reset')}
            </Button>
          )}
        </Card>

        <div className={cn('min-w-0', tenants.isFetching && !tenants.isLoading && 'opacity-90')}>
          {tenants.isError ? (
            <ErrorState title={t('tenants.error')} onRetry={() => void tenants.refetch()} retryLabel={t('common:actions.retry')} />
          ) : (
            <DataTable<TenantRow>
              columns={columns}
              rows={tenants.data ?? []}
              rowKey={(row) => row.id}
              loading={tenants.isLoading}
              pageSize={10}
              dense
              caption={t('tenants.title')}
              rowClassName={(row) => (row.state === 'deleted' ? 'opacity-70' : '')}
              empty={<EmptyState compact title={t('tenants.empty')} description={t('tenants.emptyHint')} />}
            />
          )}
        </div>
      </div>

      <CreateTenantDialog
        open={createTenantOpen}
        onOpenChange={setCreateTenantOpen}
        onCreateAdmin={(tenant) => setMemberDialog({ role: 'admin', tenantId: tenant.id, lock: true })}
      />
      <MemberFormDialog
        open={memberDialog !== null}
        onOpenChange={(open) => !open && setMemberDialog(null)}
        role={memberDialog?.role ?? 'admin'}
        tenants={all}
        tenantId={memberDialog?.tenantId}
        lockTenant={memberDialog?.lock === true}
      />
      <OriginsDialog tenant={originsFor} onOpenChange={(open) => !open && setOriginsFor(null)} />

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={pending ? t(`confirm.${pending.kind}.title`, { name: pickText(pending.tenant.name, lang) }) : ''}
        description={pending ? t(`confirm.${pending.kind}.description`, { name: pickText(pending.tenant.name, lang) }) : undefined}
        confirmLabel={pending ? t(`confirm.${pending.kind}.action`) : undefined}
        tone={pending?.kind === 'disable' ? 'default' : 'danger'}
        requirePassword={pending?.kind === 'erase'}
        passwordLabel={t('confirm.erase.password')}
        onConfirm={async (password) => {
          if (!pending) return
          const { kind, tenant } = pending
          if (kind === 'erase') {
            try {
              await erase.mutateAsync({ id: tenant.id, password: password ?? '' })
              toast.success(t('toast.erase', { name: pickText(tenant.name, lang) }))
            } catch (failure) {
              toast.error(errors.text(failure))
              throw failure
            }
          } else {
            await run(tenant, kind)
          }
        }}
      />
    </div>
  )
}
