import { CalendarDays, MessageCircle, MoreVertical, Pause, Play } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Avatar, Button, Card, IconButton, Menu, Pill, type MenuItem } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatDate, personName } from '@/lib/format'
import type { Operator } from '@/types'

export type OperatorAction = 'edit' | 'audit' | 'pause' | 'unpause' | 'logout' | 'endChats' | 'delete'

interface Props {
  operator: Operator
  /** Admin = full controls; supervisor = status controls only. */
  canManage: boolean
  busy?: boolean
  onAction: (action: OperatorAction, operator: Operator) => void
}

const STATUS_TONE = { online: 'success', away: 'warning', offline: 'muted' } as const

export function OperatorCard({ operator, canManage, busy, onAction }: Props) {
  const { t, i18n } = useTranslation('adminStaff')
  const tc = useTranslation().t
  const name = personName(operator.name, i18n.language)
  const pausedByAdmin = operator.status === 'away' && operator.pausedBy === 'admin'
  const statusLabel = pausedByAdmin ? t('operators.pausedByAdmin') : operator.status === 'away' && operator.pausedBy === 'self' ? t('operators.pausedBySelf') : tc(`operatorStatus.${operator.status}`)

  const items: MenuItem[] = []
  if (canManage) {
    items.push({ label: t('operators.menu.edit'), onSelect: () => onAction('edit', operator) })
    items.push({ label: t('operators.menu.audit'), onSelect: () => onAction('audit', operator) })
  }
  if (operator.status === 'online') items.push({ label: t('operators.menu.pause'), icon: <Pause size={16} strokeWidth={1.75} />, onSelect: () => onAction('pause', operator), separated: canManage })
  if (operator.status === 'away') items.push({ label: t('operators.menu.unpause'), icon: <Play size={16} strokeWidth={1.75} />, onSelect: () => onAction('unpause', operator), separated: canManage })
  if (operator.status !== 'offline') items.push({ label: t('operators.menu.logout'), onSelect: () => onAction('logout', operator), tone: 'danger', separated: !canManage || items.length === 0 })
  if (canManage) {
    items.push({ label: t('operators.menu.endChats'), onSelect: () => onAction('endChats', operator), tone: 'danger', disabled: operator.activeChatCount === 0, separated: true })
    items.push({ label: t('operators.menu.delete'), onSelect: () => onAction('delete', operator), tone: 'danger' })
  }

  return (
    <Card padding="md" className={cn('flex flex-col gap-3', operator.status === 'offline' && 'bg-sunken/40')} data-testid="operator-card">
      <div className="flex items-start gap-3">
        <Avatar name={name} avatarId={operator.avatarId} avatarUrl={operator.avatarUrl} size="lg" status={operator.status} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-base font-semibold leading-tight">{name}</h3>
          <p className="truncate text-[13px] text-muted">
            {operator.nickname} · <span className="tabular font-mono">#{operator.operatorNumber}</span>
          </p>
        </div>
        {items.length > 0 ? (
          <Menu
            label={name}
            trigger={<IconButton label={t('operators.menu.label', { name })} icon={<MoreVertical size={18} strokeWidth={1.75} />} variant="ghost" size="sm" loading={busy} />}
            items={items}
          />
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Pill tone={STATUS_TONE[operator.status]} dot size="sm" className={pausedByAdmin ? 'border-warning' : undefined}>
          {statusLabel}
        </Pill>
        {operator.isExternal ? (
          <Pill tone="outline" size="sm">
            {t('operators.external')}
          </Pill>
        ) : null}
      </div>

      <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
        <div className="flex items-center gap-1.5">
          <MessageCircle size={15} strokeWidth={1.75} aria-hidden />
          <dd className={cn(operator.activeChatCount > 0 && 'font-medium text-ink')}>
            {operator.activeChatCount > 0 ? t('operators.activeChats', { count: operator.activeChatCount }) : t('operators.noActiveChats')}
          </dd>
        </div>
        <div className="flex items-center gap-1.5">
          <CalendarDays size={15} strokeWidth={1.75} aria-hidden />
          <dd>{t('operators.created', { date: formatDate(operator.createdAt, i18n.language) })}</dd>
        </div>
      </dl>

      {operator.status !== 'offline' ? (
        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          {operator.status === 'online' ? (
            <Button size="sm" variant="outline" leftIcon={<Pause size={15} strokeWidth={1.75} />} onClick={() => onAction('pause', operator)} disabled={busy}>
              {t('operators.menu.pause')}
            </Button>
          ) : (
            <Button size="sm" variant="secondary" leftIcon={<Play size={15} strokeWidth={1.75} />} onClick={() => onAction('unpause', operator)} disabled={busy}>
              {t('operators.menu.unpause')}
            </Button>
          )}
        </div>
      ) : null}
    </Card>
  )
}
