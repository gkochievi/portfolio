import { MoreHorizontal, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import {
  Badge,
  Button,
  Callout,
  ConfirmDialog,
  DataTable,
  DropdownMenu,
  EmptyState,
  Field,
  IconButton,
  Input,
  SearchInput,
  SecretOnceDialog,
  StatusChip,
  Toolbar,
  toast,
  type Column,
  type MenuItem,
} from '@/components/ui'
import { setActingTenantId } from '@/demo'
import { useFormat } from '@/lib/format'
import { queryClient } from '@/lib/queryClient'
import type { Tenant } from '@/types'
import { useErrorText, useTenantMutations, useTenants } from '../api'
import { TenantFormDialog } from '../components/TenantFormDialog'
import { TenantUsersDrawer } from '../components/TenantUsersDrawer'

type Dialogs =
  | { kind: 'form'; tenant: Tenant | null }
  | { kind: 'rotate'; tenant: Tenant }
  | { kind: 'pause'; tenant: Tenant }
  | { kind: 'delete'; tenant: Tenant }
  | null

/** Console > Workspaces: the table of customer workspaces and everything you can do to one. */
export default function TenantsPage() {
  const { t, i18n } = useTranslation('consolePlatform')
  const f = useFormat()
  const navigate = useNavigate()
  const errorText = useErrorText()
  const tenants = useTenants()
  const { update, remove, rotate } = useTenantMutations()
  const [filter, setFilter] = useState('')
  const [dialog, setDialog] = useState<Dialogs>(null)
  const [usersFor, setUsersFor] = useState<string | null>(null)
  const [secret, setSecret] = useState<{ title: string; value: string } | null>(null)
  const [typed, setTyped] = useState('')
  const ka = i18n.language === 'ka'
  const display = (tn: Tenant) => (ka ? tn.name_ka : tn.name)
  const close = () => {
    setDialog(null)
    setTyped('')
  }

  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return tenants.data
    return tenants.data?.filter((tn) => [tn.name, tn.name_ka, tn.slug, tn.region].some((v) => v.toLowerCase().includes(q)))
  }, [tenants.data, filter])

  const usersTenant = tenants.data?.find((tn) => tn.id === usersFor) ?? null

  const openWorkspace = (tn: Tenant) => {
    setActingTenantId(tn.id)
    queryClient.clear()
    toast.success(t('tenants.toast.opened', { name: display(tn) }))
    void navigate('/workspace/calls')
  }

  const setActive = async (tn: Tenant, is_active: boolean) => {
    try {
      await update.mutateAsync({ id: tn.id, is_active })
      toast.success(t(is_active ? 'tenants.toast.activated' : 'tenants.toast.deactivated', { name: display(tn) }))
    } catch (error) {
      toast.error(errorText.text(error))
    }
  }

  const menu = (tn: Tenant): MenuItem[] => [
    { label: t('tenants.menu.open'), onSelect: () => openWorkspace(tn) },
    { label: t('tenants.menu.users'), onSelect: () => setUsersFor(tn.id) },
    { label: t('tenants.menu.edit'), onSelect: () => setDialog({ kind: 'form', tenant: tn }) },
    { label: t('tenants.menu.rotate'), onSelect: () => setDialog({ kind: 'rotate', tenant: tn }) },
    tn.is_active
      ? { label: t('tenants.menu.deactivate'), onSelect: () => setDialog({ kind: 'pause', tenant: tn }) }
      : { label: t('tenants.menu.activate'), onSelect: () => void setActive(tn, true) },
    { type: 'separator' },
    { label: t('tenants.menu.delete'), danger: true, onSelect: () => setDialog({ kind: 'delete', tenant: tn }) },
  ]

  const columns: Column<Tenant>[] = [
    {
      key: 'name',
      header: t('tenants.columns.name'),
      sortable: (tn) => display(tn).toLowerCase(),
      cell: (tn) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-ink">{display(tn)}</div>
          <div className="truncate text-xs text-muted" lang={ka ? 'en' : 'ka'}>
            {ka ? tn.name : tn.name_ka}
          </div>
        </div>
      ),
    },
    { key: 'slug', header: t('tenants.columns.slug'), sortable: true, hideBelow: 'md', cell: (tn) => <span className="font-mono text-[13px]">{tn.slug}</span> },
    { key: 'industry', header: t('tenants.columns.industry'), sortable: (tn) => t(`industries.${tn.industry}`), hideBelow: 'lg', cell: (tn) => t(`industries.${tn.industry}`) },
    { key: 'region', header: t('tenants.columns.region'), sortable: true, hideBelow: 'lg' },
    {
      key: 'is_active',
      header: t('tenants.columns.status'),
      sortable: (tn) => Number(tn.is_active),
      cell: (tn) => (
        <StatusChip tone={tn.is_active ? 'success' : 'neutral'}>{tn.is_active ? t('tenants.active') : t('tenants.inactive')}</StatusChip>
      ),
    },
    { key: 'users', header: t('tenants.columns.users'), sortable: true, align: 'right', hideBelow: 'sm', cell: (tn) => <span className="tabular">{f.number(tn.users)}</span> },
    { key: 'documents', header: t('tenants.columns.documents'), sortable: true, align: 'right', hideBelow: 'md', cell: (tn) => <span className="tabular">{f.number(tn.documents)}</span> },
    { key: 'api_key_hint', header: t('tenants.columns.apiKey'), hideBelow: 'lg', cell: (tn) => <span className="font-mono text-xs text-muted">{tn.api_key_hint}</span> },
    { key: 'created_at', header: t('tenants.columns.created'), sortable: true, hideBelow: 'md', cell: (tn) => f.date(tn.created_at) },
    {
      key: 'actions',
      header: <span className="sr-only">{t('actions.edit')}</span>,
      align: 'right',
      width: 56,
      cell: (tn) => (
        <DropdownMenu
          align="end"
          items={menu(tn)}
          trigger={<IconButton label={t('actions.more', { name: display(tn) })} icon={<MoreHorizontal />} size="sm" />}
        />
      ),
    },
  ]

  const target = dialog && dialog.kind !== 'form' ? dialog.tenant : null

  return (
    <div className="animate-panel-in">
      <div className="mb-4">
        <h2 className="font-display text-xl font-semibold text-ink">{t('tenants.title')}</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">{t('tenants.description')}</p>
      </div>
      <Toolbar
        end={
          <Button variant="primary" icon={<Plus />} onClick={() => setDialog({ kind: 'form', tenant: null })}>
            {t('tenants.new')}
          </Button>
        }
      >
        <SearchInput value={filter} onChange={setFilter} placeholder={t('tenants.search')} className="w-full sm:w-72" />
      </Toolbar>

      {tenants.isError ? (
        <Callout
          tone="danger"
          title={t('errors.loadFailed')}
          action={
            <Button size="sm" onClick={() => void tenants.refetch()}>
              {t('actions.retry')}
            </Button>
          }
        />
      ) : (
        <DataTable
          rows={rows}
          loading={tenants.isLoading}
          columns={columns}
          rowKey={(tn) => tn.id}
          defaultSort={{ key: 'created_at', dir: 'desc' }}
          onRowClick={(tn) => setUsersFor(tn.id)}
          empty={
            filter ? (
              <EmptyState compact title={t('tenants.noMatch')} />
            ) : (
              <EmptyState title={t('tenants.emptyTitle')} body={t('tenants.emptyBody')} />
            )
          }
        />
      )}

      {dialog?.kind === 'form' ? (
        <TenantFormDialog
          tenant={dialog.tenant}
          onOpenChange={(open) => !open && close()}
          onSaved={({ tenant, created }) => {
            if (created) {
              toast.success(t('tenants.toast.created', { name: display(tenant) }))
              setSecret({ title: t('tenants.secret.createdTitle', { name: display(tenant) }), value: created.api_key })
            } else {
              toast.success(t('tenants.toast.updated'))
            }
          }}
        />
      ) : null}

      <ConfirmDialog
        open={dialog?.kind === 'rotate'}
        onOpenChange={(open) => !open && close()}
        title={t('tenants.rotate.title', { name: target ? display(target) : '' })}
        body={t('tenants.rotate.body')}
        confirmLabel={t('tenants.rotate.confirm')}
        onConfirm={async () => {
          if (!target) return
          try {
            const result = await rotate.mutateAsync(target.id)
            toast.success(t('tenants.toast.rotated'))
            setSecret({ title: t('tenants.secret.rotatedTitle', { name: display(target) }), value: result.api_key })
            close()
          } catch (error) {
            toast.error(errorText.text(error))
          }
        }}
      />

      <ConfirmDialog
        open={dialog?.kind === 'pause'}
        onOpenChange={(open) => !open && close()}
        danger
        title={t('tenants.deactivate.title', { name: target ? display(target) : '' })}
        body={t('tenants.deactivate.body')}
        confirmLabel={t('tenants.deactivate.confirm')}
        onConfirm={async () => {
          if (target) await setActive(target, false)
          close()
        }}
      />

      <ConfirmDialog
        open={dialog?.kind === 'delete'}
        onOpenChange={(open) => !open && close()}
        danger
        title={t('tenants.delete.title', { name: target ? display(target) : '' })}
        body={t('tenants.delete.body')}
        confirmLabel={t('tenants.delete.confirm')}
        confirmDisabled={!target || typed.trim() !== target.slug}
        onConfirm={async () => {
          if (!target) return
          try {
            await remove.mutateAsync({ id: target.id, confirm_slug: typed.trim() })
            queryClient.removeQueries({ queryKey: ['workbench'] })
            toast.success(t('tenants.toast.deleted', { name: display(target) }))
            close()
          } catch (error) {
            toast.error(errorText.text(error))
          }
        }}
      >
        <Field label={t('tenants.delete.typeSlug', { slug: target?.slug ?? '' })}>
          <Input mono value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </Field>
      </ConfirmDialog>

      {usersTenant ? <TenantUsersDrawer tenant={usersTenant} onClose={() => setUsersFor(null)} /> : null}

      <SecretOnceDialog
        open={secret !== null}
        onOpenChange={(open) => !open && setSecret(null)}
        title={secret?.title}
        secret={secret?.value ?? null}
        label={t('tenants.secret.label')}
        note={t('tenants.secret.note')}
      />
      <Badge className="hidden">{tenants.data?.length ?? 0}</Badge>
    </div>
  )
}
