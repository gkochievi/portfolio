import { useMemo, useState } from 'react'
import { MoreVertical, Pencil, Trash2, UserPlus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  Avatar,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  ErrorState,
  IconButton,
  Menu,
  PageHeader,
  Pill,
  SearchInput,
  toast,
  type Column,
} from '@/components/ui'
import { useAccount } from '@/lib/account'
import { formatDate, personName } from '@/lib/format'
import type { Admin, Supervisor } from '@/types'

import { staffNumber, useAdmins, useDeleteStaff, useSupervisors } from '../api'
import { useStaffErrors } from '../errors'
import { StaffFormDialog } from './StaffFormDialog'

type Row = Admin | Supervisor

/** Admin and supervisor management share one table page (admin only). */
export function StaffTablePage({ kind }: { kind: 'admin' | 'supervisor' }) {
  const { t, i18n } = useTranslation('adminStaff')
  const tc = useTranslation().t
  const account = useAccount()
  const errors = useStaffErrors()
  const ns = kind === 'admin' ? 'admins' : 'supervisors'
  const admins = useAdmins()
  const supervisors = useSupervisors()
  const query = kind === 'admin' ? admins : supervisors
  const remove = useDeleteStaff(kind)

  const [q, setQ] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)
  const [deleting, setDeleting] = useState<Row | null>(null)

  const all = (query.data ?? []) as Row[]
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return all
    return all.filter((row) =>
      [row.name.en, row.name.ka, row.nickname, row.email, row.username, staffNumber(kind, row), `#${staffNumber(kind, row)}`].some((field) => field.toLowerCase().includes(needle)),
    )
  }, [all, q, kind])

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const nameOf = (row: Row) => personName(row.name, i18n.language)

  const columns: Column<Row>[] = [
    {
      id: 'name',
      header: t('table.name'),
      sortValue: (row) => nameOf(row).toLowerCase(),
      cell: (row) => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={nameOf(row)} size="sm" />
          <div className="min-w-0">
            <p className="flex items-center gap-2 truncate font-medium">
              <span className="truncate">{nameOf(row)}</span>
              {row.id === account?.staffId ? (
                <Pill tone="accent" size="sm">
                  {t('admins.you')}
                </Pill>
              ) : null}
            </p>
            <p className="truncate text-[12px] text-muted">{row.nickname}</p>
          </div>
        </div>
      ),
    },
    { id: 'number', header: t('table.number'), width: 90, sortValue: (row) => staffNumber(kind, row), cell: (row) => <span className="tabular font-mono text-[13px]">#{staffNumber(kind, row)}</span> },
    { id: 'email', header: t('table.email'), hideBelow: 'md', sortValue: (row) => row.email, cell: (row) => <span className="break-all text-[13px]">{row.email}</span> },
    { id: 'username', header: t('table.username'), hideBelow: 'lg', sortValue: (row) => row.username, cell: (row) => <span className="font-mono text-[13px]">{row.username}</span> },
    { id: 'language', header: t('table.language'), hideBelow: 'lg', cell: (row) => <span className="text-[13px]">{tc(`lang.${row.language}`)}</span> },
    {
      id: 'type',
      header: t('table.type'),
      hideBelow: 'sm',
      cell: (row) => (
        <Pill tone={row.isExternal ? 'outline' : 'muted'} size="sm">
          {row.isExternal ? t('table.external') : t('table.internal')}
        </Pill>
      ),
    },
    { id: 'created', header: t('table.created'), hideBelow: 'lg', sortValue: (row) => Date.parse(row.createdAt), cell: (row) => <span className="tabular text-[13px] text-muted">{formatDate(row.createdAt, i18n.language)}</span> },
    {
      id: 'actions',
      header: <span className="sr-only">{t('table.actions')}</span>,
      align: 'right',
      width: 56,
      cell: (row) => (
        <Menu
          trigger={<IconButton label={t('operators.menu.label', { name: nameOf(row) })} icon={<MoreVertical size={18} strokeWidth={1.75} />} variant="ghost" size="sm" />}
          items={[
            {
              label: t('operators.menu.edit'),
              icon: <Pencil size={16} strokeWidth={1.75} />,
              onSelect: () => {
                setEditing(row)
                setFormOpen(true)
              },
            },
            { label: tc('actions.delete'), icon: <Trash2 size={16} strokeWidth={1.75} />, tone: 'danger', separated: true, onSelect: () => setDeleting(row) },
          ]}
        />
      ),
    },
  ]

  const addButton = (
    <Button leftIcon={<UserPlus size={18} strokeWidth={1.75} />} onClick={openCreate}>
      {t(`${ns}.add`)}
    </Button>
  )

  return (
    <div className="space-y-5">
      <PageHeader title={t(`${ns}.title`)} description={t(`${ns}.description`)} actions={addButton} />
      <div className="max-w-md">
        <SearchInput value={q} onChange={setQ} placeholder={t(`${ns}.searchPlaceholder`)} aria-label={tc('actions.search')} />
      </div>

      {query.isError ? (
        <ErrorState title={t(`${ns}.loadError`)} description={errors.text(query.error)} onRetry={() => void query.refetch()} retryLabel={tc('actions.retry')} />
      ) : (
        <Card padding="none" className="overflow-hidden">
          <DataTable<Row>
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
            loading={query.isPending}
            pageSize={10}
            initialSort={{ id: 'name', dir: 'asc' }}
            empty={
              q.trim()
                ? { title: t(`${ns}.noResultsTitle`), description: tc('states.noResults') }
                : { title: t(`${ns}.emptyTitle`), description: t(`${ns}.emptyDescription`), action: addButton, nest: true }
            }
          />
        </Card>
      )}

      <StaffFormDialog kind={kind} open={formOpen} onOpenChange={setFormOpen} staff={editing} />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        tone="danger"
        title={deleting ? t(`${ns}.confirm.deleteTitle`, { name: nameOf(deleting) }) : ''}
        description={t(`${ns}.confirm.deleteBody`)}
        confirmLabel={t(`${ns}.confirm.deleteAction`)}
        onConfirm={async () => {
          if (!deleting) return
          try {
            await remove.mutateAsync(deleting.id)
            toast.success(t(`${ns}.toast.deleted`, { name: nameOf(deleting) }))
          } catch (error) {
            toast.error(errors.text(error))
            throw error
          }
        }}
      />
    </div>
  )
}
