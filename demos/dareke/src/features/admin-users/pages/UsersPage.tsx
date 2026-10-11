/** /admin/users: users and the role matrix (admin, super_admin). */
import { KeyRound, MoreHorizontal, Pencil, Power, ShieldCheck, UserPlus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Alert,
  Avatar,
  Badge,
  Button,
  DataTable,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  IconButton,
  PageHeader,
  SearchInput,
  Segmented,
  Select,
  StatusPill,
  Toolbar,
  Tooltip,
  type Column,
} from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import { useLocalized } from '@/lib/localized'
import type { Role, User } from '@/types'

import { useUsers, type ActiveFilter, type UserFilters } from '../api'
import { GrantSuperAdminDialog, ResetPasswordDialog, ToggleActiveDialog, UserFormDialog } from '../components/UserDialogs'
import { ROLE_TONE, useActor, useErrorText } from '../components/shared'
import { canEdit, canGrantSuperAdmin, canToggleActive, filterableRoles } from '../rules'

const ICON = { size: 18, strokeWidth: 1.75 } as const

export default function UsersPage() {
  const { t } = useTranslation('people')
  const tc = useTranslation().t
  const l = useLocalized()
  const errs = useErrorText()
  const actor = useActor()

  const [filters, setFilters] = useState<UserFilters>({ role: 'all', q: '', active: 'all' })
  const users = useUsers(filters)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [resetting, setResetting] = useState<User | null>(null)
  const [toggling, setToggling] = useState<User | null>(null)
  const [granting, setGranting] = useState<User | null>(null)

  const roleOptions = useMemo(
    () => [{ value: 'all', label: t('users.filters.allRoles') }, ...(actor ? filterableRoles(actor) : []).map((role) => ({ value: role, label: tc(`roles.${role}`) }))],
    [actor, t, tc],
  )

  const columns = useMemo<Column<User>[]>(() => {
    if (!actor) return []
    return [
      {
        key: 'name',
        header: t('users.columns.name'),
        sortValue: (u) => l(u.displayName),
        cell: (u) => (
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={l(u.displayName)} size={30} tone={u.isActive ? undefined : 'muted'} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={u.isActive ? 'truncate font-medium text-ink' : 'truncate font-medium text-muted'}>{l(u.displayName)}</span>
                {u.id === actor.id && (
                  <Badge tone="lime" variant="solid">
                    {t('users.you')}
                  </Badge>
                )}
              </div>
              <div className="truncate font-mono text-xs text-muted md:hidden">{u.username}</div>
            </div>
          </div>
        ),
      },
      { key: 'username', header: t('users.columns.username'), hideOnMobile: true, sortValue: (u) => u.username, cell: (u) => <span className="font-mono text-xs">{u.username}</span> },
      { key: 'email', header: t('users.columns.email'), hideOnMobile: true, sortValue: (u) => u.email, cell: (u) => <span className="text-muted">{u.email}</span> },
      {
        key: 'role',
        header: t('users.columns.role'),
        sortValue: (u) => ['super_admin', 'admin', 'supervisor', 'operator'].indexOf(u.role),
        cell: (u) => (
          <Badge tone={ROLE_TONE[u.role]} variant={u.role === 'super_admin' ? 'solid' : 'soft'}>
            {tc(`roles.${u.role}`)}
          </Badge>
        ),
      },
      {
        key: 'ext',
        header: t('users.columns.extension'),
        sortValue: (u) => u.sipExtension ?? '',
        cell: (u) =>
          u.sipExtension ? (
            <Badge tone="ink" variant="outline" mono>
              {u.sipExtension}
            </Badge>
          ) : u.role === 'operator' ? (
            <Badge tone="warning">{t('users.noExtension')}</Badge>
          ) : (
            <span className="text-muted">-</span>
          ),
      },
      {
        key: 'active',
        header: t('users.columns.active'),
        sortValue: (u) => (u.isActive ? 0 : 1),
        cell: (u) =>
          u.isActive ? (
            <StatusPill size="sm" tone="success" label={t('users.activePill')} icon={<ShieldCheck size={14} strokeWidth={1.75} />} />
          ) : (
            <StatusPill size="sm" tone="muted" pattern="outline" label={t('users.inactivePill')} icon={<Power size={14} strokeWidth={1.75} />} />
          ),
      },
      {
        key: 'lastLogin',
        header: t('users.columns.lastLogin'),
        hideOnMobile: true,
        sortValue: (u) => (u.lastLoginAt ? Date.parse(u.lastLoginAt) : 0),
        cell: (u) => <span className="font-mono text-xs text-muted">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : t('users.neverSignedIn')}</span>,
      },
      {
        key: 'actions',
        header: <span className="sr-only">{t('users.columns.actions')}</span>,
        align: 'right',
        width: 64,
        cell: (u) => (
          <RowActions
            user={u}
            actor={actor}
            onEdit={(user) => {
              setEditing(user)
              setFormOpen(true)
            }}
            onReset={setResetting}
            onToggle={setToggling}
            onGrant={setGranting}
          />
        ),
      },
    ]
  }, [actor, t, tc, l])

  if (!actor) return null
  const rows = users.data
  const filtered = filters.role !== 'all' || filters.q.trim() !== '' || filters.active !== 'all'

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <PageHeader
        title={t('pages.UsersPage')}
        description={t('users.description')}
        actions={
          <Button
            variant="dial"
            icon={<UserPlus {...ICON} />}
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            {t('users.create')}
          </Button>
        }
      />

      <Alert tone="info" title={t('users.matrixTitle')}>
        {t(actor.role === 'super_admin' ? 'users.matrix.super_admin' : 'users.matrix.admin')}
      </Alert>

      <Toolbar
        end={rows ? <span className="text-sm text-muted tabular">{t('users.count', { count: rows.length })}</span> : null}
      >
        <Select
          aria-label={t('users.filters.role')}
          className="w-full sm:w-44"
          value={filters.role}
          onValueChange={(v) => setFilters((f) => ({ ...f, role: v as Role | 'all' }))}
          options={roleOptions}
        />
        <div className="w-full sm:w-72">
          <SearchInput value={filters.q} onChange={(q) => setFilters((f) => ({ ...f, q }))} placeholder={t('users.filters.search')} />
        </div>
        <Segmented
          aria-label={t('users.filters.status')}
          value={filters.active}
          onChange={(v) => setFilters((f) => ({ ...f, active: v as ActiveFilter }))}
          options={[
            { value: 'all', label: t('users.filters.all') },
            { value: 'active', label: t('users.filters.active') },
            { value: 'inactive', label: t('users.filters.inactive') },
          ]}
        />
      </Toolbar>

      {users.isError && !rows ? (
        <EmptyState
          title={t('users.loadError')}
          description={errs.text(errorMessage(users.error))}
          action={
            <Button variant="outline" onClick={() => void users.refetch()}>
              {tc('actions.retry')}
            </Button>
          }
        />
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(u) => u.id}
          loading={users.isLoading}
          pageSize={0}
          rowClassName={(u) => (u.isActive ? undefined : 'opacity-70')}
          empty={
            <EmptyState
              compact
              title={t('users.emptyTitle')}
              description={t('users.emptyHint')}
              action={
                filtered ? (
                  <Button variant="outline" size="sm" onClick={() => setFilters({ role: 'all', q: '', active: 'all' })}>
                    {tc('actions.clearFilters')}
                  </Button>
                ) : undefined
              }
            />
          }
        />
      )}

      <UserFormDialog open={formOpen} onOpenChange={setFormOpen} actor={actor} user={editing} />
      <ResetPasswordDialog user={resetting} onClose={() => setResetting(null)} />
      <ToggleActiveDialog user={toggling} onClose={() => setToggling(null)} />
      <GrantSuperAdminDialog user={granting} onClose={() => setGranting(null)} />
    </div>
  )
}

interface RowActionsProps {
  user: User
  actor: { id: string; role: Role }
  onEdit: (user: User) => void
  onReset: (user: User) => void
  onToggle: (user: User) => void
  onGrant: (user: User) => void
}

function RowActions({ user, actor, onEdit, onReset, onToggle, onGrant }: RowActionsProps) {
  const { t } = useTranslation('people')
  const l = useLocalized()
  if (!canEdit(actor, user)) {
    return (
      <Tooltip content={t('users.readOnlyHint')}>
        <span className="inline-flex">
          <Badge tone="muted" variant="outline">
            {t('users.readOnly')}
          </Badge>
        </span>
      </Tooltip>
    )
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton label={t('actions.menu', { name: l(user.displayName) })} icon={<MoreHorizontal {...ICON} />} size="sm" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          icon={<Pencil {...ICON} />}
          onSelect={() => onEdit(user)}
        >
          {t('actions.edit')}
        </DropdownMenuItem>
        <DropdownMenuItem icon={<KeyRound {...ICON} />} onSelect={() => onReset(user)}>
          {t('actions.resetPassword')}
        </DropdownMenuItem>
        {canGrantSuperAdmin(actor, user) && (
          <DropdownMenuItem icon={<ShieldCheck {...ICON} />} onSelect={() => onGrant(user)}>
            {t('actions.grantSuper')}
          </DropdownMenuItem>
        )}
        {canToggleActive(actor, user) && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem icon={<Power {...ICON} />} danger={user.isActive} onSelect={() => onToggle(user)}>
              {user.isActive ? t('actions.disable') : t('actions.enable')}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
