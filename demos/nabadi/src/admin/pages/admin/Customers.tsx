import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Users } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { SearchInput } from '@/components/SearchInput';
import { EmptyState } from '@/components/EmptyState';
import { Pager } from '@/components/Pager';
import { SectionError } from '@/components/SectionError';
import { Stat } from '@/components/Stat';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { CustomersTable } from '@/features/admin/components/CustomersTable';
import {
  downloadCustomersXlsx,
  useAdminCustomersPage,
  type CustomersFilters,
} from '@/features/admin/hooks';
import { useMutationFeedback } from '@/features/admin/mutation-feedback';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/datetime';
import { pageCount, usePageState } from '@/lib/paginated';

type QuickKey = 'all' | 'active' | 'inactive' | 'has_bookings';

export function AdminCustomers() {
  const { t, i18n } = useTranslation('admin');
  const [search, setSearch] = useState('');
  const [quick, setQuick] = useState<QuickKey>('all');
  const [exporting, setExporting] = useState(false);
  const feedback = useMutationFeedback();

  // Search hits the server — debounce so typing fires one request, not one
  // per keystroke.
  const debouncedSearch = useDebouncedValue(search);

  const filters: CustomersFilters = useMemo(() => {
    const f: CustomersFilters = {};
    if (debouncedSearch) f.search = debouncedSearch;
    if (quick === 'active') f.active = 'true';
    else if (quick === 'inactive') f.active = 'false';
    else if (quick === 'has_bookings') f.has_bookings = 'true';
    return f;
  }, [debouncedSearch, quick]);

  // Server-paged (DRF envelope): search/active/has_bookings are all viewset
  // params, so filtering stays correct across pages.
  const [page, setPage] = usePageState(JSON.stringify(filters));
  const customersQuery = useAdminCustomersPage(filters, page);
  const { isLoading } = customersQuery;
  const customers = useMemo(() => customersQuery.data?.results ?? [], [customersQuery.data]);
  const totalCount = customersQuery.data?.count ?? 0;
  const pages = pageCount(totalCount);

  // Total = envelope count (server truth). The remaining three are derived
  // from the CURRENT page only — the note under the grid flags the scope.
  const stats = useMemo(() => {
    const active = customers.filter((c) => c.is_active).length;
    const withBookings = customers.filter((c) => c.booking_count > 0).length;
    const totalSpent = customers.reduce((s, c) => s + Number(c.total_spent ?? 0), 0);
    return {
      total: totalCount,
      active,
      with_bookings: withBookings,
      revenue: totalSpent,
    };
  }, [customers, totalCount]);

  const onExport = async () => {
    setExporting(true);
    try {
      await downloadCustomersXlsx(filters);
    } catch (err) {
      feedback.error(err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={t('page.customers')}
        title={t('page.customers')}
        subtitle={t('customers.subtitle')}
        actions={
          <Button
            variant="secondary"
            onClick={onExport}
            loading={exporting}
            className="rounded-pill"
          >
            <Download className="h-4 w-4" />
            {t('customers.export_xlsx')}
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Chip active={quick === 'all'} onClick={() => setQuick('all')}>
          {t('customers.filter_all')}
        </Chip>
        <Chip active={quick === 'active'} onClick={() => setQuick('active')}>
          {t('customers.filter_active')}
        </Chip>
        <Chip active={quick === 'inactive'} onClick={() => setQuick('inactive')}>
          {t('customers.filter_inactive')}
        </Chip>
        <Chip active={quick === 'has_bookings'} onClick={() => setQuick('has_bookings')}>
          {t('customers.filter_has_bookings')}
        </Chip>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label={t('customers.stats_total')} value={stats.total} variant="ink" />
          <Stat label={t('customers.stats_active')} value={stats.active} variant="success" />
          <Stat label={t('customers.stats_with_bookings')} value={stats.with_bookings} />
          <Stat
            label={t('customers.stats_revenue')}
            value={formatMoney(stats.revenue, i18n.language)}
            variant="accent"
          />
        </div>
        {pages > 1 && <p className="text-xs text-ink-muted">{t('customers.stats_page_note')}</p>}
      </div>

      <Card>
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('customers.search_placeholder')}
        />
      </Card>

      {customersQuery.isError ? (
        <SectionError error={customersQuery.error} onRetry={() => customersQuery.refetch()} />
      ) : isLoading ? (
        <Card>
          <p role="status" aria-live="polite" className="text-ink-muted text-sm">
            {t('actions.loading')}
          </p>
        </Card>
      ) : customers.length === 0 ? (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title={t('customers.empty_title')}
          hint={t('customers.empty_hint')}
        />
      ) : (
        <>
          <CustomersTable customers={customers} />
          <Pager page={page} pageCount={pages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}

function Chip({
  children,
  active,
  onClick,
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 text-sm font-medium px-4 py-1.5 rounded-pill border transition',
        active
          ? 'bg-ink text-bg border-ink'
          : 'bg-surface text-ink-muted border-line hover:border-line-strong hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}
