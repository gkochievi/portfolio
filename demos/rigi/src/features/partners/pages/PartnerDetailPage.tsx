import { MoreHorizontal, Pencil, Power, PowerOff, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { fieldErrorsOf } from '@/api/client'
import { PartnerTemplatesPanel } from '@/features/admin-catalog/components/PartnerTemplatesPanel'
import { LicenseMapperPanel } from '@/features/licensing/components/LicenseMapperPanel'
import { PartnerLicensesTab } from '@/features/licensing/components/PartnerLicensesTab'
import { SyncedUsersPanel } from '@/features/licensing/components/SyncedUsersPanel'
import { ActiveChip } from '@/components/status'
import {
  Badge,
  Banner,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  IconButton,
  Mono,
  PageHeader,
  PageSkeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui'
import { formatDate } from '@/lib/format'
import { isApiError } from '@/lib/api'

import { useDeletePartner, usePartner, useSetPartnerActive } from '../api'
import { AdminsTab } from '../components/AdminsTab'
import { KeysTab } from '../components/KeysTab'
import { OverviewTab } from '../components/OverviewTab'
import { PartnerDocumentsPanel } from '../components/PartnerDocumentsPanel'
import { PasswordConfirmDialog } from '../components/PasswordConfirmDialog'
import { RatesTab } from '../components/RatesTab'

const TABS = ['overview', 'documents', 'rates', 'templates', 'licenses', 'mapper', 'keys', 'users', 'admins'] as const
type TabId = (typeof TABS)[number]
type Dialogs = 'toggle' | 'delete' | null

export default function PartnerDetailPage() {
  const { t } = useTranslation('partners')
  const navigate = useNavigate()
  const { partnerId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const query = usePartner(partnerId)
  const setActive = useSetPartnerActive(partnerId)
  const del = useDeletePartner(partnerId)
  const [dialog, setDialog] = useState<Dialogs>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const raw = params.get('tab')
  const tab: TabId = TABS.includes(raw as TabId) ? (raw as TabId) : 'overview'
  const selectTab = (next: string) =>
    setParams(
      (prev) => {
        const out = new URLSearchParams(prev)
        if (next === 'overview') out.delete('tab')
        else out.set('tab', next)
        return out
      },
      { replace: true },
    )

  const partner = query.data
  if (query.isLoading) return <PageSkeleton />
  if (!partner) {
    const missing = isApiError(query.error, 404)
    return (
      <EmptyState
        title={missing || !query.isError ? t('detail.notFoundTitle') : t('errors.load')}
        description={missing || !query.isError ? t('detail.notFoundDescription') : undefined}
        action={
          <span className="flex gap-2">
            {query.isError && !missing ? <Button variant="secondary" onClick={() => query.refetch()}>{t('common:actions.retry')}</Button> : null}
            <Button asChild variant="secondary">
              <Link to="/admin/partners">{t('detail.backToList')}</Link>
            </Button>
          </span>
        }
      />
    )
  }

  const closeDialog = () => {
    setDialog(null)
    setPasswordError(null)
  }
  const onPasswordError = (error: unknown) => {
    const fields = fieldErrorsOf(error)
    if (fields.password) setPasswordError(fields.password)
    else toast.error(error instanceof Error ? error.message : t('errors.generic'))
  }

  const toggle = (password: string) =>
    setActive.mutate(
      { active: !partner.isActive, password },
      {
        onSuccess: () => {
          toast.success(t(partner.isActive ? 'dialogs.disabled' : 'dialogs.enabled', { name: partner.name }))
          closeDialog()
        },
        onError: onPasswordError,
      },
    )
  const remove = (password: string) =>
    del.mutate(password, {
      onSuccess: () => {
        toast.success(t('dialogs.deletedToast', { name: partner.name }))
        closeDialog()
        navigate('/admin/partners')
      },
      onError: onPasswordError,
    })

  const expiry = partner.contractExpiry
  const endDate = partner.contractEndOn ? formatDate(partner.contractEndOn) : ''

  return (
    <div>
      <PageHeader
        eyebrow={t('eyebrow')}
        title={partner.name}
        back={{ to: '/admin/partners', label: t('detail.backToList') }}
        meta={
          <span className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
            <ActiveChip active={partner.isActive} />
            {partner.deletedAt ? <Badge tone="danger">{t('detail.deleted', { date: formatDate(partner.deletedAt) })}</Badge> : null}
            {partner.legalName ? <span>{partner.legalName}</span> : null}
            <Mono>{partner.id}</Mono>
          </span>
        }
        actions={
          <>
            <Button asChild variant="secondary" icon={<Pencil />}>
              <Link to={`/admin/partners/${partner.id}/edit`}>{t('common:actions.edit')}</Link>
            </Button>
            <Button
              variant={partner.isActive ? 'outline' : 'primary'}
              icon={partner.isActive ? <PowerOff /> : <Power />}
              onClick={() => setDialog('toggle')}
            >
              {partner.isActive ? t('detail.disable') : t('detail.enable')}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconButton label={t('detail.moreActions')} icon={<MoreHorizontal />} variant="outline" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem tone="danger" icon={<Trash2 />} onSelect={() => setDialog('delete')}>
                  {t('common:actions.delete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      {expiry.state === 'expired' && expiry.daysLeft !== null ? (
        <Banner tone="danger" title={t('detail.expiry.expiredTitle')}>
          {t('detail.expiry.expired', { date: endDate, count: Math.abs(expiry.daysLeft) })}
        </Banner>
      ) : null}
      {expiry.state === 'expiring' && expiry.daysLeft !== null ? (
        <Banner tone="warning" title={t('detail.expiry.expiringTitle')}>
          {expiry.daysLeft === 0 ? t('detail.expiry.expiringToday') : t('detail.expiry.expiring', { date: endDate, count: expiry.daysLeft })}
        </Banner>
      ) : null}
      {expiry.state === 'expired' || expiry.state === 'expiring' ? <div className="h-4" /> : null}

      <Tabs value={tab} onValueChange={selectTab}>
        <TabsList>
          {TABS.map((id) => (
            <TabsTrigger key={id} value={id}>
              {t(`detail.tabs.${id}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="overview"><OverviewTab partner={partner} /></TabsContent>
        <TabsContent value="documents"><PartnerDocumentsPanel partnerId={partner.id} canUpload canDelete /></TabsContent>
        <TabsContent value="rates"><RatesTab partnerId={partner.id} currency={partner.currency} /></TabsContent>
        <TabsContent value="templates"><PartnerTemplatesPanel partnerId={partner.id} /></TabsContent>
        <TabsContent value="licenses"><PartnerLicensesTab partnerId={partner.id} canEdit /></TabsContent>
        <TabsContent value="mapper"><LicenseMapperPanel partnerId={partner.id} canEdit /></TabsContent>
        <TabsContent value="keys"><KeysTab partnerId={partner.id} /></TabsContent>
        <TabsContent value="users"><SyncedUsersPanel partnerId={partner.id} canEdit /></TabsContent>
        <TabsContent value="admins"><AdminsTab partnerId={partner.id} /></TabsContent>
      </Tabs>

      <PasswordConfirmDialog
        open={dialog === 'toggle'}
        onOpenChange={(o) => !o && closeDialog()}
        title={t(partner.isActive ? 'dialogs.disableTitle' : 'dialogs.enableTitle', { name: partner.name })}
        description={t(partner.isActive ? 'dialogs.disableDescription' : 'dialogs.enableDescription')}
        confirmLabel={partner.isActive ? t('detail.disable') : t('detail.enable')}
        tone={partner.isActive ? 'danger' : 'primary'}
        pending={setActive.isPending}
        error={passwordError}
        onConfirm={toggle}
      />
      <PasswordConfirmDialog
        open={dialog === 'delete'}
        onOpenChange={(o) => !o && closeDialog()}
        title={t('dialogs.deleteTitle', { name: partner.name })}
        description={t('dialogs.deleteDescription')}
        confirmLabel={t('dialogs.deleteConfirm')}
        tone="danger"
        pending={del.isPending}
        error={passwordError}
        onConfirm={remove}
      />
    </div>
  )
}
