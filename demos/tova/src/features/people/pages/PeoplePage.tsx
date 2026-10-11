/** /admin/people (superadmin): accounts sorted by role then createdAt, role chips, create, role change, suspend/restore, delete. */
import { Ban, RotateCcw, UserPlus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Avatar,
  Badge,
  Button,
  Card,
  Chip,
  DataTable,
  EmptyState,
  ErrorState,
  FilterBar,
  InlineConfirm,
  PageHeader,
  Select,
  Skeleton,
  Tooltip,
  toast,
  toastError,
  type Column,
} from '@/components/ui'
import { useLang } from '@/i18n'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/format'
import { useCurrentUser } from '@/shell/session'
import type { Role, User } from '@/types'
import { useDeleteUser, useUpdateUser, useUsers } from '../api'
import { CreateUserSheet, ROLES } from '../components/CreateUserSheet'

type Filter = Role | 'ALL'
const MOBILE_PAGE = 20

const nameOf = (user: User) => `${user.firstName} ${user.lastName}`.trim() || user.email

export default function PeoplePage() {
  const { t } = useTranslation('people')
  const lang = useLang()
  const me = useCurrentUser()
  const users = useUsers()
  const update = useUpdateUser()
  const remove = useDeleteUser()
  const [filter, setFilter] = useState<Filter>('ALL')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [mobileLimit, setMobileLimit] = useState(MOBILE_PAGE)
  const [busyId, setBusyId] = useState<string | null>(null)

  const counts = useMemo(() => {
    const result: Record<Filter, number> = { ALL: 0, SUPERADMIN: 0, ADMIN: 0, SUPERVISOR: 0, PLAYER: 0 }
    for (const user of users.data ?? []) {
      result.ALL += 1
      result[user.role] += 1
    }
    return result
  }, [users.data])

  const rows = useMemo(
    () => (users.data ? users.data.filter((user) => filter === 'ALL' || user.role === filter) : undefined),
    [users.data, filter],
  )

  const roleOptions = ROLES.map((role) => ({ value: role, label: t(`common:roles.${role}`) }))

  async function changeRole(user: User, role: Role) {
    if (role === user.role) return
    setBusyId(user.id)
    try {
      await update.mutateAsync({ id: user.id, patch: { role } })
      toast.success(t('people.toasts.roleChanged', { name: nameOf(user), role: t(`common:roles.${role}`) }))
    } catch (error) {
      toastError(error)
    } finally {
      setBusyId(null)
    }
  }

  async function toggleSuspend(user: User) {
    setBusyId(user.id)
    try {
      await update.mutateAsync({ id: user.id, patch: { disabled: !user.disabled } })
      toast.success(t(user.disabled ? 'people.toasts.restored' : 'people.toasts.suspended', { name: nameOf(user) }))
    } catch (error) {
      toastError(error)
    } finally {
      setBusyId(null)
    }
  }

  async function deleteUser(user: User) {
    try {
      await remove.mutateAsync(user.id)
      toast.success(t('people.toasts.deleted', { name: nameOf(user) }))
    } catch (error) {
      toastError(error)
    }
  }

  const isSelf = (user: User) => user.id === me?.id

  const renderName = (user: User) => (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar name={nameOf(user)} size="sm" tone={user.role === 'PLAYER' ? 'muted' : 'primary'} />
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span
            className={cn('min-w-0 max-w-full truncate font-medium text-ink', user.disabled && 'text-muted line-through')}
            title={nameOf(user)}
          >
            {nameOf(user)}
          </span>
          {isSelf(user) && (
            <Badge tone="accent" size="sm">
              {t('people.you')}
            </Badge>
          )}
          {user.disabled && (
            <Badge tone="danger" size="sm">
              {t('people.suspended')}
            </Badge>
          )}
          {user.guest && (
            <Badge tone="neutral" size="sm">
              {t('people.guest')}
            </Badge>
          )}
        </div>
      </div>
    </div>
  )

  const renderContact = (user: User) => (
    <div className="min-w-0 text-sm">
      <div className="truncate text-ink" title={user.email}>
        {user.email}
      </div>
      {user.username && (
        <div className="truncate font-mono text-xs text-muted" title={`@${user.username}`}>
          @{user.username}
        </div>
      )}
    </div>
  )

  const renderRole = (user: User) => {
    const select = (
      <div className="w-40">
        <Select
          size="sm"
          value={user.role}
          onValueChange={(value) => void changeRole(user, value as Role)}
          options={roleOptions}
          disabled={isSelf(user) || busyId === user.id}
          aria-label={t('people.changeRole', { name: nameOf(user) })}
        />
      </div>
    )
    return isSelf(user) ? (
      <Tooltip content={t('people.selfLocked')}>
        <span tabIndex={0} className="inline-block rounded-chip">
          {select}
        </span>
      </Tooltip>
    ) : (
      select
    )
  }

  const renderActions = (user: User) => {
    if (user.role === 'SUPERADMIN') {
      return (
        <span className="ml-auto block max-w-[12rem] whitespace-normal text-right text-xs leading-snug text-muted">
          {isSelf(user) ? t('people.selfLocked') : t('people.superLocked')}
        </span>
      )
    }
    return (
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <Button
          size="sm"
          variant={user.disabled ? 'secondary' : 'outline'}
          loading={busyId === user.id && update.isPending}
          leftIcon={user.disabled ? <RotateCcw className="size-4" /> : <Ban className="size-4" />}
          onClick={() => void toggleSuspend(user)}
        >
          {user.disabled ? t('people.restore') : t('people.suspend')}
        </Button>
        <InlineConfirm
          iconOnly
          label={t('people.deleteLabel')}
          question={t('people.deleteQuestion', { name: nameOf(user) })}
          onConfirm={() => deleteUser(user)}
          busy={remove.isPending && remove.variables === user.id}
        />
      </div>
    )
  }

  const columns: Column<User>[] = [
    { id: 'name', header: t('people.name'), cell: renderName, className: 'max-w-[15rem]' },
    { id: 'contact', header: t('people.emailUsername'), cell: renderContact, className: 'max-w-[14rem]', hideBelow: 'lg' },
    { id: 'role', header: t('fields.role'), cell: renderRole, width: '11rem' },
    {
      id: 'joined',
      header: t('people.joined'),
      cell: (user) => <span className="tabular-nums text-muted">{formatDate(user.createdAt, lang)}</span>,
      hideBelow: 'lg',
    },
    { id: 'actions', header: <span className="sr-only">{t('people.actions')}</span>, cell: renderActions, align: 'right' },
  ]

  const filters: Filter[] = ['ALL', ...ROLES]
  const empty = <EmptyState compact title={t('people.emptyTitle')} description={t('people.emptyDescription')} />

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t('people.title')}
        description={t('people.description')}
        actions={
          <Button size="sm" leftIcon={<UserPlus className="size-4" />} onClick={() => setSheetOpen(true)}>
            {t('people.newUser')}
          </Button>
        }
      />

      <FilterBar aria-label={t('people.filterLabel')}>
        {filters.map((value) => (
          <Chip
            key={value}
            active={filter === value}
            count={users.data ? counts[value] : undefined}
            aria-pressed={filter === value}
            onClick={() => {
              setFilter(value)
              setMobileLimit(MOBILE_PAGE)
            }}
          >
            {value === 'ALL' ? t('people.filterAll') : t(`common:roles.${value}`)}
          </Chip>
        ))}
      </FilterBar>

      {users.isError ? (
        <ErrorState error={users.error} onRetry={() => void users.refetch()} />
      ) : (
        <>
          {/* Tablet and desktop: the table. */}
          <div className="hidden md:block">
            <DataTable
              columns={columns}
              rows={rows}
              getRowId={(user) => user.id}
              loading={users.isLoading}
              empty={empty}
              rowClassName={(user) => (isSelf(user) ? 'bg-own-row' : '')}
            />
          </div>

          {/* Phones: one card per account. */}
          <div className="flex flex-col gap-3 md:hidden">
            {!rows ? (
              Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-36 w-full rounded-card" />)
            ) : rows.length === 0 ? (
              empty
            ) : (
              <>
                {rows.slice(0, mobileLimit).map((user) => (
                  <Card key={user.id} padding="sm" className={cn('flex flex-col gap-3', isSelf(user) && 'bg-own-row')}>
                    {renderName(user)}
                    {renderContact(user)}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      {renderRole(user)}
                      <span className="text-xs tabular-nums text-muted">{formatDate(user.createdAt, lang)}</span>
                    </div>
                    <div className="border-t border-line pt-3">{renderActions(user)}</div>
                  </Card>
                ))}
                {rows.length > mobileLimit && (
                  <Button variant="secondary" block onClick={() => setMobileLimit((limit) => limit + MOBILE_PAGE)}>
                    {t('people.showMore')}
                  </Button>
                )}
              </>
            )}
          </div>
        </>
      )}

      <CreateUserSheet open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  )
}
