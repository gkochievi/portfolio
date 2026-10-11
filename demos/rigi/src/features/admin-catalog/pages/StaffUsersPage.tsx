import { useMemo, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'

import {
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  DateText,
  FilterBar,
  IconButton,
  PageHeader,
  SearchInput,
  Select,
  SelectItem,
  toast,
  type Column,
} from '@/components/ui'
import { ActiveChip } from '@/components/status'
import { localName } from '@/lib/format'
import { useStaffMe } from '@/lib/session'
import type { StaffRole, StaffUser } from '@/types'

import { apiErrorMessage, useDeleteStaffUser, useStaffUsers } from '../api'

const ROLES: StaffRole[] = ['superadmin', 'accountant', 'l1_employee', 'technician']

export default function StaffUsersPage() {
  const { t } = useTranslation(['admin-catalog', 'common'])
  const navigate = useNavigate()
  const me = useStaffMe()
  const { data, error, refetch, isLoading } = useStaffUsers()
  const del = useDeleteStaffUser()
  const [q, setQ] = useState('')
  const [role, setRole] = useState('all')
  const [target, setTarget] = useState<StaffUser | null>(null)

  const rows = useMemo(() => {
    if (!data) return undefined
    const needle = q.trim().toLowerCase()
    return data.filter(
      (u) =>
        (role === 'all' || u.role === role) &&
        (!needle || u.fullName.toLowerCase().includes(needle) || u.fullNameKa.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle)),
    )
  }, [data, q, role])

  const confirmDelete = async () => {
    if (!target) return
    try {
      await del.mutateAsync(target.id)
      toast.success(t('users.deleted'))
      setTarget(null)
    } catch (e) {
      toast.error(apiErrorMessage(t, e))
      setTarget(null)
    }
  }

  const columns: Column<StaffUser>[] = [
    {
      key: 'name',
      header: t('users.col.name'),
      sortable: true,
      sortValue: (u) => localName(u).toLowerCase(),
      cell: (u) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={u.fullName} size="sm" />
          <span className="truncate font-medium text-ink">{localName(u)}</span>
          {u.id === me?.id ? <Badge tone="primary" dot={false}>{t('users.you')}</Badge> : null}
        </div>
      ),
    },
    { key: 'email', header: t('users.col.email'), sortable: true, hideBelow: 'md', cell: (u) => <span className="text-muted">{u.email}</span> },
    {
      key: 'role',
      header: t('users.col.role'),
      sortable: true,
      sortValue: (u) => ROLES.indexOf(u.role),
      cell: (u) => <Badge tone={u.role === 'superadmin' ? 'primary' : 'outline'} dot={false}>{t(`common:role.${u.role}`)}</Badge>,
    },
    {
      key: 'technicianType',
      header: t('users.col.technicianType'),
      hideBelow: 'lg',
      sortable: true,
      sortValue: (u) => u.technicianType ?? '',
      cell: (u) => (u.technicianType ? <span>{t(`common:technicianType.${u.technicianType}`)}</span> : <span className="text-subtle">—</span>),
    },
    {
      key: 'active',
      header: t('users.col.active'),
      sortable: true,
      sortValue: (u) => (u.isActive ? 1 : 0),
      cell: (u) => <ActiveChip active={u.isActive} />,
    },
    {
      key: 'lastLogin',
      header: t('users.col.lastLogin'),
      hideBelow: 'sm',
      sortable: true,
      sortValue: (u) => u.lastLoginAt ?? '',
      cell: (u) => (u.lastLoginAt ? <DateText value={u.lastLoginAt} withTime /> : <span className="text-subtle">{t('users.never')}</span>),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: '92px',
      cell: (u) => (
        <div className="flex justify-end gap-0.5">
          <IconButton label={t('common:actions.edit')} size="sm" icon={<Pencil />} onClick={() => navigate(`/admin/users/${u.id}/edit`)} />
          <IconButton
            label={u.id === me?.id ? t('users.cannotDeleteSelf') : t('common:actions.delete')}
            size="sm"
            variant="destructive-ghost"
            icon={<Trash2 />}
            disabled={u.id === me?.id}
            onClick={() => setTarget(u)}
          />
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        eyebrow={t('users.eyebrow')}
        title={t('users.title')}
        description={t('users.description')}
        actions={
          <Button icon={<Plus />} asChild>
            <Link to="/admin/users/new">{t('users.new')}</Link>
          </Button>
        }
      />
      <FilterBar
        onClear={q || role !== 'all' ? () => (setQ(''), setRole('all')) : undefined}
        actions={rows ? <span className="num text-xs text-muted">{t('users.count', { count: rows.length })}</span> : null}
      >
        <SearchInput value={q} onChange={setQ} placeholder={t('users.searchPlaceholder')} className="w-full sm:w-72" aria-label={t('users.searchPlaceholder')} />
        <Select value={role} onValueChange={setRole} aria-label={t('users.col.role')} className="w-full sm:w-52">
          <SelectItem value="all">{t('users.allRoles')}</SelectItem>
          {ROLES.map((r) => (
            <SelectItem key={r} value={r}>
              {t(`common:role.${r}`)}
            </SelectItem>
          ))}
        </Select>
      </FilterBar>
      <DataTable
        columns={columns}
        rows={isLoading ? undefined : rows}
        getRowId={(u) => u.id}
        rowHref={(u) => `/admin/users/${u.id}/edit`}
        error={error ? (error as Error).message : undefined}
        onRetry={() => void refetch()}
        initialSort={{ key: 'role', dir: 'asc' }}
        pageSize={0}
        empty={{ title: q || role !== 'all' ? t('users.emptyFiltered') : t('users.empty') }}
      />

      <ConfirmDialog
        open={Boolean(target)}
        onOpenChange={(o) => !o && setTarget(null)}
        title={t('users.deleteTitle', { name: target ? localName(target) : '' })}
        description={t('users.deleteBody')}
        confirmLabel={t('common:actions.delete')}
        tone="danger"
        onConfirm={() => void confirmDelete()}
        pending={del.isPending}
      />
    </div>
  )
}
