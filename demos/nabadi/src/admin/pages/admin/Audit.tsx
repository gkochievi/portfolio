import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardList } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { Badge } from '@/components/Badge';
import { EmptyState } from '@/components/EmptyState';
import { Pager } from '@/components/Pager';
import { SectionError } from '@/components/SectionError';
import { formatTbilisiDateTime } from '@/lib/datetime';
import { pageCount, usePageState } from '@/lib/paginated';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { useAdminAudit, type AuditEntry, type AuditFilters } from '@/features/admin/audit-hooks';

export function AdminAudit() {
  const { t } = useTranslation('admin');
  const [filters, setFilters] = useState<AuditFilters>({});

  // Text filters hit the server — debounce so typing fires one request.
  const debouncedAction = useDebouncedValue(filters.action);
  const debouncedEntity = useDebouncedValue(filters.entity);
  const queryFilters: AuditFilters = {
    ...filters,
    action: debouncedAction,
    entity: debouncedEntity,
  };

  const [page, setPage] = usePageState(JSON.stringify(queryFilters));
  const audit = useAdminAudit(queryFilters, page);
  const items: AuditEntry[] = audit.data?.results ?? [];
  const pages = pageCount(audit.data?.count ?? 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={t('page.audit')}
        title={t('page.audit')}
        subtitle={t('audit_page.subtitle')}
      />

      <Card>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
          <Input
            label={t('audit_page.f_action')}
            value={filters.action ?? ''}
            onChange={(e) => setFilters({ ...filters, action: e.target.value || undefined })}
            placeholder={t('audit_page.f_action_ph')}
          />
          <Input
            label={t('audit_page.f_entity')}
            value={filters.entity ?? ''}
            onChange={(e) => setFilters({ ...filters, entity: e.target.value || undefined })}
            placeholder={t('audit_page.f_entity_ph')}
          />
          <Input
            label={t('audit_page.f_from')}
            type="date"
            value={filters.date_from ?? ''}
            onChange={(e) => setFilters({ ...filters, date_from: e.target.value || undefined })}
          />
          <Input
            label={t('audit_page.f_to')}
            type="date"
            value={filters.date_to ?? ''}
            onChange={(e) => setFilters({ ...filters, date_to: e.target.value || undefined })}
          />
        </div>
      </Card>

      {audit.isError ? (
        <SectionError error={audit.error} onRetry={() => audit.refetch()} />
      ) : audit.isLoading ? (
        <Card>
          <p role="status" aria-live="polite" className="text-ink-muted text-sm">
            {t('actions.loading')}
          </p>
        </Card>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-5 w-5" />}
          title={t('audit_page.no_entries')}
        />
      ) : (
        <Card>
          <div className="flex flex-col divide-y divide-line">
            {items.map((e) => (
              <details key={e.id} className="py-3 first:pt-0 last:pb-0 group">
                <summary className="cursor-pointer list-none flex items-center gap-3 flex-wrap">
                  <span className="text-xs text-ink-muted font-mono tabular-nums">
                    {formatTbilisiDateTime(e.created_at)}
                  </span>
                  <Badge variant="ink">{e.action}</Badge>
                  <span className="text-xs text-ink-muted">
                    {e.entity}#{e.entity_id || '—'}
                  </span>
                  <span className="text-xs text-ink-muted ml-auto">
                    {e.actor_first_name} {e.actor_last_name} <span className="text-line">·</span>{' '}
                    <span className="capitalize">{e.actor_role || t('audit_page.deleted')}</span>{' '}
                    <span className="text-line">·</span> {e.ip ?? '—'}
                  </span>
                </summary>
                {Object.keys(e.payload).length > 0 && (
                  <pre className="mt-2 text-xs bg-bg border border-line rounded-md p-3 overflow-x-auto">
                    {JSON.stringify(e.payload, null, 2)}
                  </pre>
                )}
              </details>
            ))}
          </div>
          <Pager page={page} pageCount={pages} onPageChange={setPage} className="mt-4" />
        </Card>
      )}
    </div>
  );
}
