/** All partners' API keys. Route: /admin/api-keys. Owner: licensing. */
import { Ban } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { Badge, Button, ConfirmDialog, DataTable, DateText, Mono, PageHeader, Switch, type Column } from '@/components/ui'
import { useStaffMe } from '@/lib/session'

import { useAllApiKeys, useRevokeKey, type ApiKeyRow } from '../api'
import { errorText } from '../lib/errors'

export default function ApiKeysPage() {
  const { t } = useTranslation('licensing')
  const me = useStaffMe()
  const isSuper = me?.role === 'superadmin'
  const [showRevoked, setShowRevoked] = useState(false)
  const keys = useAllApiKeys(showRevoked)
  const revoke = useRevokeKey()
  const [target, setTarget] = useState<ApiKeyRow | null>(null)

  async function onRevoke() {
    if (!target) return
    try {
      await revoke.mutateAsync(target.id)
      toast.success(t('apiKeys.revokedToast', { key: target.keyId, partner: target.partnerName }))
      setTarget(null)
    } catch (e) {
      toast.error(errorText(t, e))
      setTarget(null)
    }
  }

  const columns: Column<ApiKeyRow>[] = [
    {
      key: 'keyId',
      header: t('apiKeys.cols.keyId'),
      sortable: true,
      sortValue: (r) => r.keyId,
      cell: (r) => (
        <Mono>
          <span className={r.revokedAt ? 'line-through opacity-60' : undefined}>{r.keyId}</span>
        </Mono>
      ),
    },
    {
      key: 'partner',
      header: t('apiKeys.cols.partner'),
      sortable: true,
      sortValue: (r) => r.partnerName,
      cell: (r) => (
        <Link to={`/admin/partners/${r.partnerId}`} className="link">
          {r.partnerName}
        </Link>
      ),
    },
    { key: 'label', header: t('apiKeys.cols.label'), hideBelow: 'sm', cell: (r) => r.label || <span className="text-subtle">—</span> },
    {
      key: 'scopes',
      header: t('apiKeys.cols.scopes'),
      hideBelow: 'md',
      cell: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.scopes.map((s) => (
            <Badge key={s} tone="outline" dot={false}>
              <span className="font-mono text-[11px]">{s}</span>
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'lastUsedAt',
      header: t('apiKeys.cols.lastUsed'),
      sortable: true,
      sortValue: (r) => r.lastUsedAt ?? '',
      hideBelow: 'sm',
      cell: (r) => (r.lastUsedAt ? <DateText value={r.lastUsedAt} relative withTime /> : <span className="text-subtle">{t('apiKeys.never')}</span>),
    },
    {
      key: 'revokedAt',
      header: t('apiKeys.cols.revokedAt'),
      sortable: true,
      sortValue: (r) => r.revokedAt ?? '',
      cell: (r) => (r.revokedAt ? <span className="text-danger"><DateText value={r.revokedAt} withTime /></span> : <Badge tone="success">{t('apiKeys.active')}</Badge>),
    },
    ...(isSuper
      ? [
          {
            key: 'actions',
            header: <span className="sr-only">{t('apiKeys.cols.actions')}</span>,
            align: 'right' as const,
            width: '110px',
            cell: (r: ApiKeyRow) =>
              r.revokedAt ? null : (
                <Button size="xs" variant="destructive-ghost" icon={<Ban />} onClick={() => setTarget(r)}>
                  {t('apiKeys.revoke')}
                </Button>
              ),
          },
        ]
      : []),
  ]

  return (
    <>
      <PageHeader
        eyebrow={t('apiKeys.eyebrow')}
        title={t('apiKeys.title')}
        description={t('apiKeys.description')}
        actions={<Switch checked={showRevoked} onCheckedChange={setShowRevoked} label={t('apiKeys.showRevoked')} />}
      />
      <DataTable
        columns={columns}
        rows={keys.data}
        getRowId={(r) => r.id}
        error={keys.error ? errorText(t, keys.error) : undefined}
        onRetry={() => void keys.refetch()}
        rowNumbers
        pageSize={25}
        initialSort={{ key: 'partner', dir: 'asc' }}
        empty={{ title: t('apiKeys.empty'), description: showRevoked ? undefined : t('apiKeys.emptyHint') }}
      />
      <ConfirmDialog
        open={target !== null}
        onOpenChange={(o) => !o && setTarget(null)}
        title={t('apiKeys.revokeTitle')}
        description={target ? t('apiKeys.revokeDescription', { key: target.keyId, partner: target.partnerName }) : undefined}
        confirmLabel={t('apiKeys.revoke')}
        tone="danger"
        pending={revoke.isPending}
        onConfirm={() => void onRevoke()}
      />
    </>
  )
}
