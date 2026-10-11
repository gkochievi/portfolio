import { ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Card, CardBody, CardHeader, RoleBadge } from '@/components/ui'
import { USER_ROLES } from '@/lib/rbac'
import type { ConsoleUser } from '@/types'

/** Every role with a one-line description and how many users hold it. */
export function RoleLegend({ users }: { users: ConsoleUser[] | undefined }) {
  const { t } = useTranslation('people')
  const counts = new Map<string, number>()
  for (const u of users ?? []) counts.set(u.role, (counts.get(u.role) ?? 0) + 1)
  return (
    <Card>
      <CardHeader icon={ShieldCheck} title={t('legend.title')} subtitle={t('legend.subtitle')} />
      <CardBody>
        <ul className="divide-y divide-line">
          {USER_ROLES.map((role) => (
            <li key={role} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:gap-4">
              <div className="flex shrink-0 items-center justify-between gap-3 sm:w-[210px]">
                <RoleBadge role={role} />
                {users && <span className="tabular text-xs text-muted">{t('legend.members', { count: counts.get(role) ?? 0 })}</span>}
              </div>
              <p className="min-w-0 text-sm text-muted">{t(`roleDesc.${role}`)}</p>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  )
}
