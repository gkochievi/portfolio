import { useTranslation } from 'react-i18next'

import { Avatar, Badge, EmptyState } from '@/components/ui'
import { StatusDot } from '@/components/chat'
import { personName } from '@/lib/format'
import type { Lang } from '@/types'

import type { DashboardOperator } from '../types'

export function OperatorList({ operators, limit }: { operators: DashboardOperator[]; limit: number }) {
  const { t, i18n } = useTranslation(['adminLive', 'common'])
  const lang: Lang = i18n.language?.startsWith('ka') ? 'ka' : 'en'
  if (operators.length === 0) return <EmptyState compact title={t('dashboard.operators.empty')} />
  return (
    <ul className="divide-y divide-line">
      {operators.map((operator) => {
        const busy = limit > 0 && operator.activeChatCount >= limit
        return (
          <li key={operator.id} className="flex items-center gap-3 px-4 py-3">
            <Avatar name={personName(operator.name, lang)} avatarId={operator.avatarId} avatarUrl={operator.avatarUrl} size="sm" status={operator.status} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <StatusDot status={operator.status} />
                <span className="truncate font-medium text-ink">{operator.nickname}</span>
                <span className="tabular text-xs text-muted">#{operator.operatorNumber}</span>
              </div>
              <div className="truncate text-xs text-muted">
                {personName(operator.name, lang)} · {t(`common:operatorStatus.${operator.status}`)}
              </div>
            </div>
            <Badge tone={busy ? 'warning' : operator.activeChatCount > 0 ? 'accent' : 'muted'} size="sm" className="tabular shrink-0">
              {limit > 0
                ? t('dashboard.operators.load', { count: operator.activeChatCount, limit })
                : t('dashboard.operators.loadUnlimited', { count: operator.activeChatCount })}
            </Badge>
          </li>
        )
      })}
    </ul>
  )
}
