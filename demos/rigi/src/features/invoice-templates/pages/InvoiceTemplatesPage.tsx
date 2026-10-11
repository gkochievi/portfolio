import { Pencil, Plus } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Badge, Button, DataTable, DateText, EmptyState, PageHeader, type Column } from '@/components/ui'

import { useTemplates, type TemplateRow } from '../api'

/** /accountant/templates */
export default function InvoiceTemplatesPage() {
  const { t } = useTranslation(['invoice-templates', 'common'])
  const { data, error, refetch } = useTemplates()

  const columns = useMemo<Column<TemplateRow>[]>(
    () => [
      {
        key: 'name',
        header: t('table.name'),
        sortable: true,
        sortValue: (r) => r.name.toLowerCase(),
        cell: (r) => (
          <Link to={`/accountant/templates/${r.id}`} className="link font-medium">
            {r.name}
          </Link>
        ),
      },
      {
        key: 'scope',
        header: t('table.scope'),
        sortable: true,
        sortValue: (r) => r.partnerName ?? '',
        cell: (r) => (r.partnerId ? <Badge tone="accent">{r.partnerName ?? t('scope.partner')}</Badge> : <Badge tone="neutral">{t('scope.global')}</Badge>),
      },
      {
        key: 'layout',
        header: t('table.layout'),
        hideBelow: 'md',
        sortable: true,
        sortValue: (r) => r.mode,
        cell: (r) => (
          <span className="inline-flex items-center gap-1.5">
            <Badge tone="outline" dot={false}>
              {t(`mode.${r.mode}`)}
            </Badge>
            {r.hasSignature ? <Badge tone="info" dot={false}>{t('badge.signed')}</Badge> : null}
          </span>
        ),
      },
      {
        key: 'default',
        header: t('table.default'),
        sortable: true,
        sortValue: (r) => (r.isDefault ? 0 : 1),
        cell: (r) => (r.isDefault ? <Badge tone="primary">{t('badge.default')}</Badge> : <span className="text-subtle">—</span>),
      },
      { key: 'created', header: t('table.created'), hideBelow: 'sm', sortable: true, sortValue: (r) => r.createdAt, cell: (r) => <DateText value={r.createdAt} /> },
      {
        key: 'actions',
        header: <span className="sr-only">{t('common:fields.actions')}</span>,
        align: 'right',
        cell: (r) => (
          <Button size="xs" variant="ghost" icon={<Pencil />} asChild>
            <Link to={`/accountant/templates/${r.id}`} aria-label={`${t('actions.edit')}: ${r.name}`}>
              {t('actions.edit')}
            </Link>
          </Button>
        ),
      },
    ],
    [t],
  )

  return (
    <div>
      <PageHeader
        eyebrow={t('list.eyebrow')}
        title={t('list.title')}
        description={t('list.description')}
        actions={
          <Button icon={<Plus />} asChild>
            <Link to="/accountant/templates/new">{t('actions.new')}</Link>
          </Button>
        }
      />
      <DataTable
        columns={columns}
        rows={data}
        getRowId={(r) => r.id}
        error={error}
        onRetry={() => void refetch()}
        rowHref={(r) => `/accountant/templates/${r.id}`}
        initialSort={{ key: 'default', dir: 'asc' }}
        pageSize={0}
        caption={t('list.title')}
        empty={
          <EmptyState
            title={t('list.empty')}
            description={t('list.emptyHint')}
            action={
              <Button icon={<Plus />} asChild>
                <Link to="/accountant/templates/new">{t('actions.new')}</Link>
              </Button>
            }
          />
        }
      />
    </div>
  )
}
