import { Lock, Pencil, Trash2, UserPlus, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
  ErrorState,
  IconButton,
  PageHeader,
  RoleBadge,
  SearchInput,
  Select,
  StatusChip,
  Toolbar,
  Tooltip,
  toast,
  type Column,
} from '@/components/ui'
import { isAccessError, messageOf } from '@/api/client'
import { fmtDateTime, timeAgo } from '@/lib/format'
import { useInvalidateOn } from '@/lib/live'
import { useLang } from '@/shell/state'
import { useMe } from '@/shell/useMe'
import type { ConsoleUser, UserType } from '@/types'
import { peopleKeys, useDeleteUser, useUsers } from '../api'
import { CreateUserDialog } from '../components/CreateUserDialog'
import { EditUserDialog } from '../components/EditUserDialog'
import { RoleLegend } from '../components/RoleLegend'
import { RoleMappingsCard } from '../components/RoleMappingsCard'
import { SecretDialog, type SecretInfo } from '../components/SecretDialog'
import { userLabel } from '../lib'

type TypeFilter = 'all' | UserType

const TYPE_TONE = { ldap: 'info', internal: 'neutral', api_service: 'bronze' } as const

export default function PeoplePage() {
  const { t } = useTranslation(['people', 'common'])
  const lang = useLang()
  const { me, can } = useMe()
  const users = useUsers()
  const remove = useDeleteUser()
  useInvalidateOn('users:changed', peopleKeys.users)
  useInvalidateOn('demo:reset', peopleKeys.all)

  const [search, setSearch] = useState('')
  const [type, setType] = useState<TypeFilter>('all')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<ConsoleUser | null>(null)
  const [deleting, setDeleting] = useState<ConsoleUser | null>(null)
  const [secret, setSecret] = useState<SecretInfo | null>(null)

  const myUsername = me?.persona.username.toLowerCase() ?? ''
  const isSelf = (u: ConsoleUser) => u.username.toLowerCase() === myUsername
  const deleteBlock = (u: ConsoleUser): string | null =>
    u.role === 'superadmin' ? t('row.deleteSuperadmin') : isSelf(u) ? t('row.deleteSelf') : null

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return (users.data ?? []).filter((u) => {
      if (type !== 'all' && u.userType !== type) return false
      if (!needle) return true
      return `${u.username} ${u.displayName ?? ''} ${u.email ?? ''} ${u.description}`.toLowerCase().includes(needle)
    })
  }, [users.data, search, type])

  const disabledCount = (users.data ?? []).filter((u) => !u.isActive).length
  const groupUserCount = (users.data ?? []).filter((u) => u.userType === 'ldap' && u.accessMode === 'group').length

  const confirmDelete = async () => {
    if (!deleting) return
    const name = userLabel(deleting)
    try {
      await remove.mutateAsync(deleting.id)
      toast.success(t('toast.deleted', { name }))
      setDeleting(null)
    } catch (e) {
      toast.error(messageOf(e))
      setDeleting(null)
    }
  }

  const columns: Column<ConsoleUser>[] = [
    {
      id: 'username',
      header: t('col.username'),
      sortValue: (u) => u.username.toLowerCase(),
      cell: (u) => (
        <div className="min-w-0">
          <span className="block max-w-[220px] truncate font-mono text-[13px] text-ink" title={u.username}>
            {u.username}
          </span>
          <span className="block max-w-[220px] truncate text-xs text-muted md:hidden">{u.displayName ?? t('noDisplayName')}</span>
        </div>
      ),
    },
    {
      id: 'name',
      header: t('col.name'),
      hideBelow: 'md',
      sortValue: (u) => (u.displayName ?? '').toLowerCase(),
      cell: (u) =>
        u.displayName ? (
          <span className="block max-w-[260px] truncate" title={u.displayName}>
            {u.displayName}
          </span>
        ) : (
          <span className="text-faint" aria-label={t('noDisplayName')} title={t('noDisplayName')}>
            —
          </span>
        ),
    },
    {
      id: 'type',
      header: t('col.type'),
      hideBelow: 'md',
      sortValue: (u) => u.userType,
      cell: (u) => (
        <span title={t(`typeTitle.${u.userType}`)}>
          <Badge tone={TYPE_TONE[u.userType]}>{t(`types.${u.userType}`)}</Badge>
        </span>
      ),
    },
    { id: 'role', header: t('col.role'), sortValue: (u) => u.role, cell: (u) => <RoleBadge role={u.role} /> },
    {
      id: 'status',
      header: t('col.status'),
      hideBelow: 'sm',
      sortValue: (u) => (u.isActive ? 0 : 1),
      cell: (u) => <StatusChip tone={u.isActive ? 'success' : 'neutral'}>{u.isActive ? t('status.active') : t('status.disabled')}</StatusChip>,
    },
    {
      id: 'lastLogin',
      header: t('col.lastLogin'),
      hideBelow: 'lg',
      sortValue: (u) => (u.lastLoginAt ? Date.parse(u.lastLoginAt) : 0),
      cell: (u) =>
        u.lastLoginAt ? (
          <span className="whitespace-nowrap" title={fmtDateTime(u.lastLoginAt, lang)}>
            {timeAgo(u.lastLoginAt, lang)}
          </span>
        ) : (
          <span className="text-muted">{t('common:states.never')}</span>
        ),
    },
    {
      id: 'actions',
      header: <span className="sr-only">{t('col.actions')}</span>,
      align: 'right',
      cell: (u) => {
        const block = deleteBlock(u)
        const label = userLabel(u)
        return (
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <IconButton label={t('row.edit', { name: label })} icon={Pencil} variant="ghost" size="sm" onClick={() => setEditing(u)} />
            {block ? (
              <Tooltip content={block}>
                <span tabIndex={0} className="inline-flex" aria-label={block}>
                  <IconButton label={t('row.delete', { name: label })} icon={Lock} variant="ghost" size="sm" disabled />
                </span>
              </Tooltip>
            ) : (
              <IconButton label={t('row.delete', { name: label })} icon={Trash2} variant="danger" size="sm" onClick={() => setDeleting(u)} />
            )}
          </div>
        )
      },
    },
  ]

  const forbidden = users.isError && isAccessError(users.error)

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        meta={
          users.data ? (
            <span className="tabular text-sm text-muted">
              {t('count', { count: users.data.length })}
              {disabledCount > 0 ? ` · ${t('disabledCount', { count: disabledCount })}` : ''}
            </span>
          ) : undefined
        }
        actions={
          can('users') ? (
            <Button variant="primary" icon={UserPlus} onClick={() => setCreating(true)}>
              {t('add')}
            </Button>
          ) : undefined
        }
      />

      {forbidden ? (
        <EmptyState icon={Lock} title={t('common:states.forbidden')} />
      ) : (
        <Card>
          <div className="p-3">
            <Toolbar>
              <div className="w-full min-w-[200px] sm:w-[320px]">
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder={t('search.placeholder')}
                  aria-label={t('search.label')}
                />
              </div>
              <div className="w-[170px]">
                <Select<TypeFilter>
                  size="sm"
                  aria-label={t('filter.type')}
                  value={type}
                  onValueChange={setType}
                  options={[
                    { value: 'all', label: t('filter.all') },
                    { value: 'ldap', label: t('types.ldap') },
                    { value: 'internal', label: t('types.internal') },
                    { value: 'api_service', label: t('types.api_service') },
                  ]}
                />
              </div>
            </Toolbar>
          </div>
          {users.isError ? (
            <ErrorState error={users.error} onRetry={() => void users.refetch()} />
          ) : (
            <DataTable<ConsoleUser>
              columns={columns}
              rows={rows}
              rowKey={(u) => u.id}
              loading={users.isLoading}
              pageSize={25}
              onRowClick={(u) => setEditing(u)}
              rowClassName={(u) => (u.isActive ? '' : 'opacity-70')}
              empty={
                (users.data ?? []).length === 0 ? (
                  <EmptyState icon={Users} title={t('table.emptyTitle')} body={t('table.emptyBody')} />
                ) : (
                  <EmptyState
                    icon={Users}
                    title={t('table.noMatchTitle')}
                    body={t('table.noMatchBody')}
                    action={
                      <Button
                        size="sm"
                        onClick={() => {
                          setSearch('')
                          setType('all')
                        }}
                      >
                        {t('common:actions.clearFilters')}
                      </Button>
                    }
                  />
                )
              }
            />
          )}
        </Card>
      )}

      {!forbidden && (
        <div className="grid items-start gap-6 xl:grid-cols-2">
          <RoleLegend users={users.data} />
          <RoleMappingsCard groupUserCount={groupUserCount} />
        </div>
      )}

      {creating && <CreateUserDialog onClose={() => setCreating(false)} onSecret={setSecret} />}
      {editing && (
        <EditUserDialog
          key={editing.id}
          user={editing}
          isSelf={isSelf(editing)}
          onClose={() => setEditing(null)}
          onSecret={setSecret}
        />
      )}
      <SecretDialog secret={secret} onClose={() => setSecret(null)} />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open && !remove.isPending) setDeleting(null)
        }}
        tone="danger"
        title={t('delete.title', { name: deleting ? userLabel(deleting) : '' })}
        body={t('delete.body')}
        confirmLabel={t('delete.confirm')}
        busy={remove.isPending}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  )
}
