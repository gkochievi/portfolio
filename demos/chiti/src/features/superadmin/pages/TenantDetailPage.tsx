import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, ArchiveRestore, Power } from 'lucide-react'

import { Button, ErrorState, LoadingBlock, PageHeader, Tabs, TabsContent, TabsList, TabsTrigger, toast } from '@/components/ui'
import { SystemMessage } from '@/app/pages/NotFoundPage'
import { formatDate, pickText } from '@/lib/format'

import { useMembers, useSuperErrors, useTenantAction, useTenants } from '../api'
import { FeaturesTab } from '../components/FeaturesTab'
import { MemberFormDialog } from '../components/MemberFormDialog'
import { MembersTab } from '../components/MembersTab'
import { StaffChatTab } from '../components/StaffChatTab'
import { StateBadge } from '../components/shared'
import type { MemberRole } from '../types'

const TABS = ['admins', 'operators', 'supervisors', 'features', 'chats'] as const
type Tab = (typeof TABS)[number]
const ROLE_OF: Record<'admins' | 'operators' | 'supervisors', MemberRole> = { admins: 'admin', operators: 'operator', supervisors: 'supervisor' }

export default function TenantDetailPage() {
  const { tenantId = '' } = useParams()
  const { t, i18n } = useTranslation('superadmin')
  const lang = i18n.language
  const errors = useSuperErrors()
  const [params, setParams] = useSearchParams()
  const tenants = useTenants({})
  const members = useMembers(tenantId)
  const action = useTenantAction()
  const [addRole, setAddRole] = useState<MemberRole | null>(null)

  const tab: Tab = (TABS as readonly string[]).includes(params.get('tab') ?? '') ? (params.get('tab') as Tab) : 'admins'
  const tenant = tenants.data?.find((row) => row.id === tenantId)

  if (tenants.isLoading) return <LoadingBlock label={t('common:states.loading')} />
  if (tenants.isError) return <ErrorState title={t('tenants.error')} onRetry={() => void tenants.refetch()} retryLabel={t('common:actions.retry')} />
  if (!tenant) return <SystemMessage code={404} />

  const name = pickText(tenant.name, lang)
  const run = async (kind: 'enable' | 'restore') => {
    try {
      await action.mutateAsync({ id: tenant.id, action: kind })
      toast.success(t(`toast.${kind}`, { name }))
    } catch (failure) {
      toast.error(errors.text(failure))
    }
  }

  const counts = {
    admins: members.data?.admins.length ?? tenant.counts.admins,
    operators: members.data?.operators.length ?? tenant.counts.operators,
    supervisors: members.data?.supervisors.length ?? tenant.counts.supervisors,
  }

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumbs={[{ label: t('tenants.title'), to: '/superadmin' }, { label: name }]}
        title={name}
        description={pickText(tenant.industry, lang)}
        meta={
          <span className="flex flex-wrap items-center gap-3 text-[13px] text-muted">
            <StateBadge state={tenant.state} />
            <code className="font-mono text-[12px]">{tenant.slug}</code>
            <span>{t('detail.created', { date: formatDate(tenant.createdAt, lang) })}</span>
          </span>
        }
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/superadmin">{t('detail.back')}</Link>
          </Button>
        }
      />

      {tenant.state === 'disabled' && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-ui border border-warning bg-warning-soft px-4 py-3 text-[14px] text-ink">
          <AlertTriangle size={18} strokeWidth={1.75} className="shrink-0 text-warning" aria-hidden />
          <p className="min-w-0 flex-1">{t('detail.disabledBanner', { date: tenant.disabledAt ? formatDate(tenant.disabledAt, lang) : '' })}</p>
          <Button size="sm" variant="secondary" leftIcon={<Power />} loading={action.isPending} onClick={() => void run('enable')}>
            {t('menu.enable')}
          </Button>
        </div>
      )}
      {tenant.state === 'deleted' && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-ui border border-danger bg-danger-soft px-4 py-3 text-[14px] text-ink">
          <AlertTriangle size={18} strokeWidth={1.75} className="shrink-0 text-danger" aria-hidden />
          <p className="min-w-0 flex-1">{t('detail.deletedBanner', { date: tenant.deletedAt ? formatDate(tenant.deletedAt, lang) : '' })}</p>
          <Button size="sm" variant="secondary" leftIcon={<ArchiveRestore />} loading={action.isPending} onClick={() => void run('restore')}>
            {t('menu.restore')}
          </Button>
        </div>
      )}

      <Tabs value={tab} onValueChange={(value) => setParams({ tab: value }, { replace: true })}>
        <div className="overflow-x-auto">
          <TabsList>
            <TabsTrigger value="admins" count={counts.admins}>{t('tabs.admins')}</TabsTrigger>
            <TabsTrigger value="operators" count={counts.operators}>{t('tabs.operators')}</TabsTrigger>
            <TabsTrigger value="supervisors" count={counts.supervisors}>{t('tabs.supervisors')}</TabsTrigger>
            <TabsTrigger value="features">{t('tabs.features')}</TabsTrigger>
            <TabsTrigger value="chats">{t('tabs.chats')}</TabsTrigger>
          </TabsList>
        </div>

        {(['admins', 'operators', 'supervisors'] as const).map((key) => (
          <TabsContent key={key} value={key} className="mt-4">
            {members.isLoading ? (
              <LoadingBlock label={t('common:states.loading')} />
            ) : members.isError ? (
              <ErrorState title={t('members.error')} onRetry={() => void members.refetch()} retryLabel={t('common:actions.retry')} />
            ) : (
              <MembersTab tenant={tenant} role={ROLE_OF[key]} members={members.data?.[key] ?? []} onAdd={() => setAddRole(ROLE_OF[key])} />
            )}
          </TabsContent>
        ))}
        <TabsContent value="features" className="mt-4">
          <FeaturesTab tenant={tenant} />
        </TabsContent>
        <TabsContent value="chats" className="mt-4">
          <StaffChatTab tenantId={tenant.id} />
        </TabsContent>
      </Tabs>

      <MemberFormDialog
        open={addRole !== null}
        onOpenChange={(open) => !open && setAddRole(null)}
        role={addRole ?? 'admin'}
        tenants={tenants.data ?? []}
        tenantId={tenant.id}
        lockTenant
      />
    </div>
  )
}
