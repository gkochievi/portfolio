import { MoreHorizontal } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Badge,
  Button,
  Callout,
  Card,
  ConfirmDialog,
  DataTable,
  DropdownMenu,
  EmptyState,
  IconButton,
  SearchInput,
  SecretOnceDialog,
  Skeleton,
  Switch,
  Toolbar,
  toast,
  type Column,
  type MenuItem,
} from '@/components/ui'
import { useFormat } from '@/lib/format'
import type { AppUser, LimitsConfig } from '@/types'
import { useErrorText, useRegisteredLimits, useRegisteredUsers, useSaveRegisteredLimits, useUserMutations } from '../api'
import { LimitsFields } from '../components/LimitsFields'
import { fromDraft, serverToDraftField, toDraft, type LimitsDraft } from '../components/limits'
import { UserLimitsDialog } from '../components/UserLimitsDialog'

type Dialogs = { kind: 'limits' | 'reset' | 'delete'; user: AppUser } | null

/** Console > Registered users: tier defaults, then everyone with a personal account. */
export default function RegisteredUsersPage() {
  const { t } = useTranslation('consolePlatform')
  const f = useFormat()
  const errorText = useErrorText()
  const defaults = useRegisteredLimits()
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const users = useRegisteredUsers(q)
  const { update, remove, resetPassword } = useUserMutations()
  const [dialog, setDialog] = useState<Dialogs>(null)
  const [secret, setSecret] = useState<{ name: string; value: string } | null>(null)

  useEffect(() => {
    const id = setTimeout(() => setQ(search.trim()), 250)
    return () => clearTimeout(id)
  }, [search])

  const name = (u: AppUser) => u.display_name || u.email
  const target = dialog?.user ?? null

  const toggle = async (u: AppUser, is_active: boolean) => {
    try {
      await update.mutateAsync({ id: u.id, is_active })
      toast.success(t(is_active ? 'users.toast.activated' : 'users.toast.deactivated', { name: name(u) }))
    } catch (e) {
      toast.error(errorText.text(e))
    }
  }

  const menu = (u: AppUser): MenuItem[] => [
    { label: t('users.menu.limits'), onSelect: () => setDialog({ kind: 'limits', user: u }) },
    { label: t('users.menu.reset'), onSelect: () => setDialog({ kind: 'reset', user: u }) },
    { type: 'separator' },
    { label: t('users.menu.delete'), danger: true, onSelect: () => setDialog({ kind: 'delete', user: u }) },
  ]

  const used = (u: AppUser) => {
    const d = defaults.data
    const cap = (k: 'analyses' | 'tts' | 'conversions', fallback: number | undefined) => u.limits[k] ?? fallback
    return [
      { k: 'analyses' as const, limit: cap('analyses', d?.max_analyses_per_day) },
      { k: 'tts' as const, limit: cap('tts', d?.max_tts_per_day) },
      { k: 'conversions' as const, limit: cap('conversions', d?.max_conversions_per_day) },
    ]
  }

  const columns: Column<AppUser>[] = [
    {
      key: 'email',
      header: t('users.columns.email'),
      sortable: (u) => u.email.toLowerCase(),
      cell: (u) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-ink">{u.email}</div>
          <div className="truncate text-xs text-muted sm:hidden">{u.display_name}</div>
        </div>
      ),
    },
    { key: 'display_name', header: t('users.columns.name'), sortable: true, hideBelow: 'sm' },
    {
      key: 'is_active',
      header: t('users.columns.active'),
      sortable: (u) => Number(u.is_active),
      cell: (u) => (
        <Switch
          size="sm"
          checked={u.is_active}
          onCheckedChange={(on) => void toggle(u, on)}
          aria-label={`${t('users.columns.active')}: ${u.email}`}
        />
      ),
    },
    { key: 'created_at', header: t('users.columns.created'), sortable: true, hideBelow: 'lg', cell: (u) => <span className="whitespace-nowrap">{f.date(u.created_at)}</span> },
    {
      key: 'last_login_at',
      header: t('users.columns.lastLogin'),
      sortable: (u) => (u.last_login_at ? Date.parse(u.last_login_at) : 0),
      hideBelow: 'md',
      cell: (u) => (u.last_login_at ? <span className="whitespace-nowrap">{f.relative(u.last_login_at)}</span> : <span className="text-muted">{t('common.never')}</span>),
    },
    {
      key: 'used',
      header: t('users.columns.used'),
      hideBelow: 'md',
      cell: (u) => (
        <div className="flex flex-col items-start gap-1">
          <span className="tabular whitespace-nowrap text-[13px]" title={t('users.usedCell', { analyses: u.used.analyses, tts: u.used.tts, conversions: u.used.conversions })}>
            {used(u).map((x, i) => (
              <span key={x.k}>
                {i ? ' · ' : ''}
                <span className="text-muted">{t(`users.usedShort.${x.k}`)}</span> {f.number(u.used[x.k])}
                {x.limit != null ? <span className="text-muted">/{f.number(x.limit)}</span> : null}
              </span>
            ))}
          </span>
          {Object.keys(u.limits).length ? (
            <Badge size="sm" tone="accent">
              {t('users.override')}
            </Badge>
          ) : null}
        </div>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">{t('actions.edit')}</span>,
      align: 'right',
      width: 56,
      cell: (u) => (
        <DropdownMenu align="end" items={menu(u)} trigger={<IconButton label={t('actions.more', { name: name(u) })} icon={<MoreHorizontal />} size="sm" />} />
      ),
    },
  ]

  return (
    <div className="animate-panel-in space-y-6">
      <TierDefaults />

      <section>
        <Toolbar>
          <SearchInput value={search} onChange={setSearch} placeholder={t('users.search')} className="w-full sm:w-80" />
        </Toolbar>
        {users.isError ? (
          <Callout
            tone="danger"
            title={t('errors.loadFailed')}
            action={
              <Button size="sm" onClick={() => void users.refetch()}>
                {t('actions.retry')}
              </Button>
            }
          />
        ) : (
          <DataTable
            rows={users.data}
            loading={users.isLoading}
            columns={columns}
            rowKey={(u) => u.id}
            defaultSort={{ key: 'created_at', dir: 'desc' }}
            empty={q ? <EmptyState compact title={t('users.noMatch')} /> : <EmptyState title={t('users.emptyTitle')} body={t('users.emptyBody')} />}
          />
        )}
      </section>

      {dialog?.kind === 'limits' && defaults.data ? (
        <UserLimitsDialog user={dialog.user} defaults={defaults.data} onClose={() => setDialog(null)} />
      ) : null}

      <ConfirmDialog
        open={dialog?.kind === 'reset'}
        onOpenChange={(open) => !open && setDialog(null)}
        title={t('users.reset.title', { name: target ? name(target) : '' })}
        body={t('users.reset.body')}
        confirmLabel={t('users.reset.confirm')}
        onConfirm={async () => {
          if (!target) return
          try {
            const result = await resetPassword.mutateAsync(target.id)
            setSecret({ name: name(target), value: result.password })
            setDialog(null)
          } catch (e) {
            toast.error(errorText.text(e))
          }
        }}
      />

      <ConfirmDialog
        open={dialog?.kind === 'delete'}
        onOpenChange={(open) => !open && setDialog(null)}
        danger
        title={t('users.delete.title', { name: target ? name(target) : '' })}
        body={t('users.delete.body')}
        confirmLabel={t('users.delete.confirm')}
        onConfirm={async () => {
          if (!target) return
          try {
            await remove.mutateAsync(target.id)
            toast.success(t('users.toast.deleted', { name: name(target) }))
            setDialog(null)
          } catch (e) {
            toast.error(errorText.text(e))
          }
        }}
      />

      <SecretOnceDialog
        open={secret !== null}
        onOpenChange={(open) => !open && setSecret(null)}
        title={t('users.secret.title', { name: secret?.name ?? '' })}
        secret={secret?.value ?? null}
        label={t('users.secret.label')}
        note={t('users.secret.note')}
      />
    </div>
  )
}

/* ------------------------------------------------------------ tier defaults */

function TierDefaults() {
  const { t } = useTranslation('consolePlatform')
  const query = useRegisteredLimits()
  if (query.isError)
    return (
      <Callout
        tone="danger"
        title={t('errors.loadFailed')}
        action={
          <Button size="sm" onClick={() => void query.refetch()}>
            {t('actions.retry')}
          </Button>
        }
      />
    )
  return (
    <Card>
      <h2 className="font-display text-lg font-semibold text-ink">{t('users.defaults.title')}</h2>
      <p className="mb-4 mt-0.5 text-sm text-muted">{t('users.defaults.description')}</p>
      {query.data ? <DefaultsForm key={JSON.stringify(query.data)} saved={query.data} /> : <Skeleton className="h-40 w-full" />}
    </Card>
  )
}

function DefaultsForm({ saved }: { saved: LimitsConfig }) {
  const { t } = useTranslation('consolePlatform')
  const errorText = useErrorText()
  const save = useSaveRegisteredLimits()
  const [draft, setDraft] = useState<LimitsDraft>(() => toDraft(saved))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(saved))

  const submit = async () => {
    const { config, errors: found } = fromDraft(draft)
    if (!config) {
      setErrors(Object.fromEntries(Object.entries(found).map(([k, code]) => [k, t(`errors.${code}`)])))
      return
    }
    try {
      await save.mutateAsync(config)
      setErrors({})
      toast.success(t('users.toast.defaults'))
    } catch (e) {
      const fields = errorText.fields(e)
      setErrors(Object.fromEntries(Object.entries(fields).map(([k, v]) => [serverToDraftField[k] ?? k, v])))
      if (!Object.keys(fields).length) toast.error(errorText.text(e))
    }
  }

  return (
    <form
        noValidate
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <LimitsFields draft={draft} onChange={setDraft} errors={errors} />
      <div className="flex gap-2">
        <Button type="submit" variant="primary" loading={save.isPending} disabled={!dirty}>
          {t('actions.save')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={!dirty || save.isPending}
          onClick={() => {
            setDraft(toDraft(saved))
            setErrors({})
          }}
        >
          {t('actions.discard')}
        </Button>
      </div>
    </form>
  )
}
