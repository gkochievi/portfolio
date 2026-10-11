/** Agents tab: assigned operators, remove, and the Manage agents dialog. */
import { AlertTriangle, UserMinus, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Alert, Avatar, Badge, Button, Checkbox, DataTable, Dialog, EmptyState, IconButton, Panel, Skeleton, type Column } from '@/components/ui'
import { cn } from '@/lib/cn'
import { useLocalized } from '@/lib/localized'
import { toast } from '@/lib/toast'
import type { CampaignWithStats, User } from '@/types'

import { useAssignableAgents, useCampaignAgents, useSetAgents } from '../api'
import { useApiErrorText } from './shared'

const i18 = { size: 16, strokeWidth: 1.75 } as const

function ExtensionChip({ user }: { user: User }) {
  const { t } = useTranslation('campaigns')
  return user.sipExtension ? (
    <Badge tone="muted" variant="outline" mono size="sm">
      {t('agents.ext', { ext: user.sipExtension })}
    </Badge>
  ) : (
    <Badge tone="warning" size="sm" icon={<AlertTriangle size={12} strokeWidth={1.75} />}>
      {t('agents.noExtension')}
    </Badge>
  )
}

export function AgentsTab({ campaign }: { campaign: CampaignWithStats }) {
  const { t } = useTranslation('campaigns')
  const { t: tc } = useTranslation()
  const l = useLocalized()
  const errText = useApiErrorText()
  const query = useCampaignAgents(campaign.id)
  const setAgents = useSetAgents(campaign.id)
  const [managing, setManaging] = useState(false)
  const agents = query.data ?? []

  const remove = (user: User) =>
    setAgents.mutate(
      agents.filter((a) => a.id !== user.id).map((a) => a.id),
      {
        onSuccess: () => toast.success(t('agents.removed', { name: l(user.displayName) })),
        onError: (error) => toast.error(t('agents.saveFailed'), { description: errText(error) }),
      },
    )

  const columns: Column<User>[] = [
    {
      key: 'name',
      header: t('agents.name'),
      sortValue: (u) => l(u.displayName),
      cell: (u) => (
        <span className="flex items-center gap-2.5">
          <Avatar name={l(u.displayName)} size={28} />
          <span className="font-medium text-ink">{l(u.displayName)}</span>
          {!u.isActive && (
            <Badge tone="muted" size="sm">
              {tc('states.inactive')}
            </Badge>
          )}
        </span>
      ),
    },
    { key: 'username', header: t('agents.username'), sortValue: (u) => u.username, cell: (u) => <span className="font-mono text-sm text-muted">{u.username}</span>, hideOnMobile: true },
    { key: 'ext', header: t('agents.extension'), sortValue: (u) => u.sipExtension ?? '', cell: (u) => <ExtensionChip user={u} /> },
    {
      key: 'remove',
      header: <span className="sr-only">{tc('actions.remove')}</span>,
      align: 'right',
      width: '48px',
      cell: (u) => <IconButton size="sm" label={t('agents.remove', { name: l(u.displayName) })} icon={<UserMinus {...i18} />} disabled={setAgents.isPending} onClick={() => remove(u)} />,
    },
  ]

  return (
    <div className="space-y-4">
      {!query.isLoading && agents.length === 0 && (
        <Alert tone="warning" title={t('agents.noneTitle')}>
          {t('agents.noneBody')}
        </Alert>
      )}
      {agents.some((a) => !a.sipExtension) && <Alert tone="info">{t('agents.extensionNote')}</Alert>}
      <Panel
        title={t('agents.title', { count: agents.length })}
        padded={false}
        actions={
          <Button size="sm" variant="dial" icon={<Users {...i18} />} onClick={() => setManaging(true)}>
            {t('agents.manage')}
          </Button>
        }
      >
        {query.isError ? (
          <div className="p-4">
            <Alert tone="danger" title={tc('states.error')} action={<Button size="sm" onClick={() => void query.refetch()}>{tc('actions.retry')}</Button>}>
              {errText(query.error)}
            </Alert>
          </div>
        ) : (
          <DataTable
            rows={agents}
            columns={columns}
            rowKey={(u) => u.id}
            loading={query.isLoading}
            framed={false}
            pageSize={0}
            empty={
              <EmptyState
                title={t('agents.emptyTitle')}
                description={t('agents.emptyHint')}
                action={
                  <Button variant="dial" icon={<Users {...i18} />} onClick={() => setManaging(true)}>
                    {t('agents.manage')}
                  </Button>
                }
              />
            }
          />
        )}
      </Panel>
      <ManageAgentsDialog open={managing} onOpenChange={setManaging} campaign={campaign} assigned={agents} />
    </div>
  )
}

function ManageAgentsDialog({
  open,
  onOpenChange,
  campaign,
  assigned,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  campaign: CampaignWithStats
  assigned: User[]
}) {
  const { t } = useTranslation('campaigns')
  const { t: tc } = useTranslation()
  const l = useLocalized()
  const errText = useApiErrorText()
  const options = useAssignableAgents(campaign.id, open)
  const save = useSetAgents(campaign.id)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (open) setSelected(new Set(assigned.map((a) => a.id)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Assigned-but-deactivated agents stay visible so they can be removed.
  const list = [...(options.data ?? []), ...assigned.filter((a) => !(options.data ?? []).some((o) => o.id === a.id))]

  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  const submit = () =>
    save.mutate([...selected], {
      onSuccess: (users) => {
        toast.success(t('agents.saved', { count: users.length }))
        onOpenChange(false)
      },
      onError: (error) => toast.error(t('agents.saveFailed'), { description: errText(error) }),
    })

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={t('agents.manageTitle')}
      description={t('agents.manageHint', { name: l(campaign.name) })}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-muted">{t('agents.selected', { count: selected.size })}</span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {tc('actions.cancel')}
            </Button>
            <Button variant="dial" loading={save.isPending} onClick={submit}>
              {tc('actions.save')}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        {selected.size === 0 && <Alert tone="warning">{t('agents.zeroWarning')}</Alert>}
        {options.isLoading ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : options.isError ? (
          <Alert tone="danger">{errText(options.error)}</Alert>
        ) : (
          <div className="grid max-h-[50vh] gap-2 overflow-auto sm:grid-cols-2">
            {list.map((user) => {
              const on = selected.has(user.id)
              return (
                <label
                  key={user.id}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-card border p-3 transition-colors',
                    on ? 'border-ink bg-sunken' : 'border-hairline hover:bg-sunken',
                  )}
                >
                  <Checkbox checked={on} onCheckedChange={(v) => toggle(user.id, v)} />
                  <Avatar name={l(user.displayName)} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink">{l(user.displayName)}</span>
                    <span className="block truncate font-mono text-xs text-muted">{user.username}</span>
                  </span>
                  <ExtensionChip user={user} />
                </label>
              )
            })}
          </div>
        )}
      </div>
    </Dialog>
  )
}
