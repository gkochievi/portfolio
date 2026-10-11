/** /admin/activity: the audit trail in five sections, live via 'activity:new'. Admin only. */
import { useState } from 'react'
import {
  Activity,
  Ban,
  ChevronDown,
  CircleCheck,
  Clock,
  Download,
  Eraser,
  Eye,
  EyeOff,
  FileText,
  GitBranch,
  LogIn,
  LogOut,
  MessageSquareWarning,
  Pause,
  Pencil,
  Play,
  Plug,
  Power,
  Send,
  Settings,
  ShieldCheck,
  Trash2,
  Undo2,
  Unplug,
  UserCheck,
  UserPlus,
  UserX,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge, Button, Card, EmptyState, ErrorState, Pagination, PageHeader, SearchInput, DateRangePicker, lastDays, type DateRange, Select, Skeleton, Tabs, TabsList, TabsTrigger } from '@/components/ui'
import { cn } from '@/lib/cn'
import { useBusEvent, useNow } from '@/lib/realtime'
import { formatDateTime, formatRelative } from '@/lib/format'
import type { ActivityAction, ActivityLog, ActivitySection } from '@/types'

import { useActivity, useDebounced } from '../api'
import { useLang } from '../shared'

const SECTIONS: ActivitySection[] = ['auth', 'users', 'chats', 'reports', 'integrations']
const ROLES = ['operator', 'admin', 'supervisor', 'customer', 'system'] as const

const ICONS: Partial<Record<ActivityAction, LucideIcon>> = {
  operator_login: LogIn,
  admin_login: LogIn,
  supervisor_login: LogIn,
  customer_login: LogIn,
  operator_logout: LogOut,
  admin_logout: LogOut,
  customer_disconnect: UserX,
  operator_pause: Pause,
  operator_resume: Play,
  operator_claim_session: UserCheck,
  operator_end_session: CircleCheck,
  admin_end_session: CircleCheck,
  admin_end_operator_chats: CircleCheck,
  operator_return_to_queue: Undo2,
  operator_send_template: FileText,
  admin_send_message: Send,
  admin_intervention_start: Eye,
  admin_intervention_stop: EyeOff,
  admin_clear_queue: Eraser,
  admin_force_operator_status: Power,
  admin_force_operator_logout: Power,
  admin_create_operator: UserPlus,
  admin_create_admin: UserPlus,
  admin_create_supervisor: UserPlus,
  admin_update_operator: Pencil,
  admin_update_admin: Pencil,
  admin_update_supervisor: Pencil,
  admin_delete_operator: Trash2,
  admin_delete_admin: Trash2,
  admin_delete_supervisor: Trash2,
  admin_purge_sessions: Trash2,
  admin_update_settings: Settings,
  admin_update_working_hours: Clock,
  admin_update_faq: GitBranch,
  admin_ban_client: Ban,
  admin_unban_client: ShieldCheck,
  admin_download_report: Download,
  admin_save_integration: Plug,
  admin_test_integration: Zap,
  admin_delete_integration: Unplug,
  admin_moderate_comment: MessageSquareWarning,
}

function ActivityRow({ row, now, fresh }: { row: ActivityLog; now: number; fresh: boolean }) {
  const { t } = useTranslation('adminInsights')
  const { t: tc } = useTranslation()
  const lang = useLang()
  const [open, setOpen] = useState(false)
  const Icon = ICONS[row.action] ?? Activity
  const details = Object.entries(row.metadata)
  const actorRole = row.actorRole === 'system' ? t('activity.system') : tc(`role.${row.actorRole}`)
  const panelId = `activity-${row.id}`
  return (
    <li className={cn('border-b border-line last:border-b-0', fresh && 'animate-hop')}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-hover focus-visible:bg-hover sm:px-4"
      >
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Icon size={18} strokeWidth={1.75} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-medium text-ink">{t(`activity.actions.${row.action}`, { defaultValue: row.action.replace(/_/g, ' ') })}</span>
            {row.targetLabel ? <span className="max-w-full truncate text-sm text-muted">{row.targetLabel}</span> : null}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
            <Badge size="sm" tone={row.actorRole === 'system' ? 'muted' : 'outline'}>
              {actorRole}
            </Badge>
            <span className="truncate">{row.actorName}</span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2 pt-0.5 text-xs text-muted">
          <time dateTime={row.createdAt} title={formatDateTime(row.createdAt, lang)} className="tabular">
            {formatRelative(row.createdAt, lang, now)}
          </time>
          <ChevronDown size={16} strokeWidth={1.75} className={cn('transition-transform', open && 'rotate-180')} aria-hidden />
        </span>
      </button>
      {open ? (
        <div id={panelId} className="mx-3 mb-3 rounded-ui border border-line bg-sunken p-3 sm:ml-[3.75rem] sm:mr-4">
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted">{t('activity.details.when')}</dt>
              <dd className="text-ink tabular">{formatDateTime(row.createdAt, lang)}</dd>
            </div>
            {row.ipAddress ? (
              <div>
                <dt className="text-xs text-muted">{t('activity.details.ip')}</dt>
                <dd className="font-mono text-ink">{row.ipAddress}</dd>
              </div>
            ) : null}
            {details.map(([key, value]) => (
              <div key={key}>
                <dt className="text-xs text-muted">{t(`activity.meta.${key}`, { defaultValue: key.replace(/_/g, ' ') })}</dt>
                <dd className="break-words text-ink">{value === null || value === '' ? '-' : typeof value === 'boolean' ? tc(value ? 'actions.enable' : 'actions.disable') : String(value)}</dd>
              </div>
            ))}
          </dl>
          {details.length === 0 ? <p className="mt-2 text-xs text-muted">{t('activity.details.none')}</p> : null}
        </div>
      ) : null}
    </li>
  )
}

export default function ActivityPage() {
  const { t } = useTranslation('adminInsights')
  const { t: tc } = useTranslation()
  const [section, setSection] = useState<ActivitySection>('auth')
  const [q, setQ] = useState('')
  const [role, setRole] = useState('all')
  const [range, setRange] = useState<DateRange | null>(null)
  const [page, setPage] = useState(1)
  const [freshIds, setFreshIds] = useState<Set<string>>(() => new Set())
  const now = useNow(30_000)

  const debouncedQ = useDebounced(q, 300)
  const query = useActivity({ section, q: debouncedQ.trim(), role, from: range?.from, to: range?.to, page })

  useBusEvent('activity:new', (row) => {
    setFreshIds((current) => new Set(current).add(row.id))
    setTimeout(() => setFreshIds((current) => (current.delete(row.id) ? new Set(current) : current)), 2500)
  })

  const reset = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value)
    setPage(1)
  }
  const rows = query.data?.rows ?? []
  const total = query.data?.total ?? 0
  const pageSize = query.data?.pageSize ?? 20
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const filtered = Boolean(q.trim() || role !== 'all' || range)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t('activity.title')}
        description={t('activity.description')}
        meta={
          <Badge tone="success" dot>
            {t('activity.live')}
          </Badge>
        }
      />

      <Tabs value={section} onValueChange={(value) => { setSection(value as ActivitySection); setPage(1) }} variant="underline">
        <TabsList aria-label={t('activity.sections.label')}>
          {SECTIONS.map((value) => (
            <TabsTrigger key={value} value={value}>
              {t(`activity.sections.${value}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[200px] flex-1 sm:max-w-sm">
          <SearchInput value={q} onChange={reset(setQ)} placeholder={t('activity.search')} aria-label={t('activity.search')} />
        </div>
        <div className="w-44">
          <Select
            aria-label={t('activity.actorRole')}
            value={role}
            onValueChange={reset(setRole)}
            options={[{ value: 'all', label: t('activity.allRoles') }, ...ROLES.map((value) => ({ value, label: value === 'system' ? t('activity.system') : tc(`role.${value}`) }))]}
          />
        </div>
        {range ? (
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker value={range} onChange={reset(setRange)} presets={[7, 30, 90]} />
            <Button variant="ghost" size="sm" onClick={() => { setRange(null); setPage(1) }}>
              {t('activity.anyTime')}
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => { setRange(lastDays(7)); setPage(1) }}>
            {t('activity.filterByDate')}
          </Button>
        )}
      </div>

      <Card padding="none" className="overflow-hidden">
        {query.isLoading ? (
          <div className="flex flex-col gap-3 p-4" aria-busy>
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : query.isError && !query.data ? (
          <ErrorState title={tc('states.error')} onRetry={() => void query.refetch()} retryLabel={tc('actions.retry')} />
        ) : rows.length === 0 ? (
          <EmptyState compact illustration="nest" title={filtered ? tc('states.noResults') : t('activity.empty.title')} description={filtered ? t('activity.empty.filtered') : t('activity.empty.description')} />
        ) : (
          <ul aria-label={t(`activity.sections.${section}`)}>
            {rows.map((row) => (
              <ActivityRow key={row.id} row={row} now={now} fresh={freshIds.has(row.id)} />
            ))}
          </ul>
        )}
      </Card>

      {total > pageSize ? <Pagination page={page} pageCount={pageCount} onPageChange={setPage} total={total} pageSize={pageSize} /> : null}
    </div>
  )
}
