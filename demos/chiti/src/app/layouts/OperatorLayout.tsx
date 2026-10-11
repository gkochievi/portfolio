import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Inbox, MonitorSmartphone, UserRound } from 'lucide-react'

import type { OperatorStatus } from '@/types'
import { request } from '@/lib/api'
import { signOut, useAccount } from '@/lib/account'
import { useBusEvent } from '@/lib/realtime'
import { cn } from '@/lib/cn'
import { pickText } from '@/lib/format'
import { Logo } from '@/components/brand'
import { Badge, SegmentedControl, Tooltip, toast } from '@/components/ui'
import { TeamChatLauncher } from '@/features/team'
import { useRouteGuard } from '../components/Guard'
import { HeaderControls } from '../components/HeaderControls'
import { useMe } from '../session'

const navCls = ({ isActive }: { isActive: boolean }) =>
  cn(
    'inline-flex h-9 items-center gap-2 rounded-ui px-3 text-[13px] font-medium transition-colors [&_svg]:size-[18px]',
    isActive ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-hover hover:text-ink',
  )

/** Operator console: slim top bar (tenant, online/away, team chat, profile) over a full-height page. */
export function OperatorLayout() {
  const guard = useRouteGuard()
  const { t, i18n } = useTranslation('shell')
  const account = useAccount()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const me = useMe()
  const operator = me.data?.operator ?? null

  useBusEvent('operator:force-logout', (p) => {
    if (account?.role === 'operator' && p.operatorId === account.staffId) {
      signOut()
      navigate('/login', { replace: true })
      qc.clear()
      toast.warning(t('toast.forceLogout'), { id: 'force-logout' })
    }
  })

  const status = useMutation({
    mutationFn: (next: Exclude<OperatorStatus, 'offline'>) => request('PATCH', '/operator/status', { body: { status: next } }),
    onSuccess: (_d, next) => {
      void qc.invalidateQueries({ queryKey: ['me'] })
      toast.success(t('header.statusChanged', { status: t(`common:operatorStatus.${next}`) }), { id: 'op-status' })
    },
    onError: () => toast.error(t('common:states.error')),
  })

  if (guard) return guard
  const current = operator?.status === 'away' ? 'away' : 'online'

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-bg">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-panel px-3 sm:gap-3 sm:px-4">
        <NavLink to="/operator" className="flex items-center rounded-ui focus-visible:outline-2 focus-visible:outline-accent" aria-label="Chiti">
          <Logo size={28} showWordmark={false} className="sm:hidden" />
          <Logo size={28} className="hidden sm:inline-flex" />
        </NavLink>
        <span aria-hidden className="hidden h-6 w-px bg-line md:block" />
        <div className="hidden min-w-0 flex-col leading-tight md:flex">
          <span className="truncate text-[13px] font-semibold text-ink">{pickText(me.data?.tenant?.name, i18n.language)}</span>
          <span className="text-[11px] text-muted">{t('surface.operator')}</span>
        </div>
        <nav aria-label={t('nav.main')} className="ml-1 hidden items-center gap-1 md:flex">
          <NavLink to="/operator" end className={navCls}>
            <Inbox strokeWidth={1.75} />
            {t('nav.inbox')}
          </NavLink>
          <NavLink to="/operator/profile" className={navCls}>
            <UserRound strokeWidth={1.75} />
            {t('nav.profile')}
          </NavLink>
          <NavLink to="/live" className={navCls}>
            <MonitorSmartphone strokeWidth={1.75} />
            {t('nav.liveDesk')}
          </NavLink>
        </nav>
        <div className="flex-1" />
        {operator?.pausedBy === 'admin' && operator.status === 'away' ? (
          <Badge tone="warning" className="hidden lg:inline-flex">
            {t('header.forcedPause')}
          </Badge>
        ) : null}
        <Tooltip content={t('header.statusLabel')}>
          <span>
            <SegmentedControl
              aria-label={t('header.statusLabel')}
              size="sm"
              value={current}
              onChange={(v) => v !== current && status.mutate(v)}
              options={[
                { value: 'online', label: <StatusLabel status="online" text={t('common:operatorStatus.online')} /> },
                { value: 'away', label: <StatusLabel status="away" text={t('common:operatorStatus.away')} /> },
              ]}
            />
          </span>
        </Tooltip>
        <TeamChatLauncher />
        <HeaderControls operator={operator} />
      </header>
      <main className="relative min-h-0 flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}

function StatusLabel({ status, text }: { status: 'online' | 'away'; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={cn('size-2 rounded-full', status === 'online' ? 'bg-success' : 'bg-warning')} />
      <span className="hidden sm:inline">{text}</span>
      <span className="sr-only sm:hidden">{text}</span>
    </span>
  )
}
