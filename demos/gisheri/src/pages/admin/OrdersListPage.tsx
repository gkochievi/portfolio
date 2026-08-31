import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, User, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import PageHeader from '@/components/admin/PageHeader';
import DateRangeFilter from '@/components/admin/DateRangeFilter';
import { DataTable, type Column } from '@/components/admin/DataTable';
import {
  adminOrdersApi,
  type AdminOrderListItem,
  type OrderListResponse,
  type OrderStatus,
} from '@/lib/orders-api';
import { ApiError } from '@/lib/api';
import { formatMoneyGEL } from '@/lib/money';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { useDateRangeFilter } from '@/hooks/use-date-range-filter';

const ALL_STATUSES: OrderStatus[] = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];

const PAGE_SIZE = 25;

const statusBadge: Record<OrderStatus, string> = {
  pending: 'bg-secondary text-foreground border-border',
  paid: 'bg-purpose-balance/15 text-purpose-balance border-purpose-balance/30',
  shipped: 'bg-purpose-luck/15 text-purpose-luck border-purpose-luck/30',
  delivered: 'bg-gold/15 text-foreground border-gold/30',
  cancelled: 'bg-destructive/15 text-destructive border-destructive/30',
};

const OrdersListPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<OrderListResponse<AdminOrderListItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [status, setStatus] = useState<'' | OrderStatus>('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkPending, setBulkPending] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  const userIdParam = searchParams.get('userId');
  const customerEmailParam = searchParams.get('customerEmail') ?? '';
  const userIdFilter = useMemo(() => {
    const n = userIdParam ? Number(userIdParam) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [userIdParam]);

  const dateFilter = useDateRangeFilter();
  const { effectiveFrom, effectiveTo } = dateFilter;

  const clearCustomerFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('userId');
    next.delete('customerEmail');
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(id);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, status, userIdFilter, effectiveFrom, effectiveTo]);

  useEffect(() => {
    setSelectedIds([]);
  }, [debouncedQ, status, userIdFilter, effectiveFrom, effectiveTo, page]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminOrdersApi
      .list({
        q: debouncedQ,
        status,
        userId: userIdFilter ?? undefined,
        dateFrom: effectiveFrom || undefined,
        dateTo: effectiveTo || undefined,
        page,
        pageSize: PAGE_SIZE,
      })
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (cancelled) return;
        toast({
          title: t('admin.orders.loadFailed', { defaultValue: 'Failed to load orders' }),
          description: err instanceof ApiError ? err.detail : undefined,
          variant: 'destructive',
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQ, status, userIdFilter, effectiveFrom, effectiveTo, page, reloadTick, toast, t]);

  const applyBulkStatus = async (next: OrderStatus) => {
    if (selectedIds.length === 0 || bulkPending) return;
    setBulkPending(true);
    try {
      const res = await adminOrdersApi.bulkUpdateStatus(selectedIds, next);
      toast({
        title: t('admin.orders.bulkUpdated', {
          count: res.updated,
          defaultValue: `Updated ${res.updated} orders`,
        }),
      });
      setSelectedIds([]);
      setReloadTick((n) => n + 1);
    } catch (err) {
      toast({
        title: t('admin.orders.bulkFailed', { defaultValue: 'Failed to update orders' }),
        description: err instanceof ApiError ? err.detail : undefined,
        variant: 'destructive',
      });
    } finally {
      setBulkPending(false);
    }
  };

  const statusLabel = (s: OrderStatus) =>
    t(`admin.orders.status${s.charAt(0).toUpperCase() + s.slice(1)}`, { defaultValue: s });

  const columns: Column<AdminOrderListItem>[] = [
    {
      key: 'id',
      header: t('admin.orders.order', { defaultValue: 'Order' }),
      cell: (row) => <span className="font-medium">#{row.id}</span>,
    },
    {
      key: 'name',
      header: t('admin.orders.customer', { defaultValue: 'Customer' }),
      cell: (row) => (
        <div className="min-w-0">
          <p className="font-medium truncate">{row.fullName}</p>
          <p className="text-xs text-muted-foreground truncate">{row.email}</p>
        </div>
      ),
    },
    {
      key: 'items',
      header: t('admin.orders.items', { defaultValue: 'Items' }),
      cell: (row) => row.itemCount,
    },
    {
      key: 'total',
      header: t('admin.orders.totalCol', { defaultValue: 'Total' }),
      headerClassName: 'text-right',
      className: 'text-right tabular-nums',
      cell: (row) => formatMoneyGEL(Number(row.total)),
    },
    {
      key: 'status',
      header: t('admin.orders.status', { defaultValue: 'Status' }),
      cell: (row) => (
        <Badge variant="outline" className={cn('capitalize', statusBadge[row.status])}>
          {statusLabel(row.status)}
        </Badge>
      ),
    },
    {
      key: 'created',
      header: t('admin.orders.placed', { defaultValue: 'Placed' }),
      cell: (row) => new Date(row.createdAt).toLocaleDateString(),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('admin.orders.title', { defaultValue: 'Orders' })}
        description={t('admin.orders.count', { count: data?.total ?? 0, defaultValue: `${data?.total ?? 0} orders` })}
        actions={
          <Button onClick={() => navigate('/admin/orders/new')}>
            <Plus size={16} />
            {t('admin.orders.newOrder', { defaultValue: 'New order' })}
          </Button>
        }
      />

      {userIdFilter && (
        <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-gold/40 bg-gold/10 px-3 py-1.5 text-sm">
          <User size={14} className="text-gold" />
          <span>
            {t('admin.orders.filterByCustomer', {
              email: customerEmailParam || `user #${userIdFilter}`,
              defaultValue: `Showing orders from ${customerEmailParam || `user #${userIdFilter}`}`,
            })}
          </span>
          <button
            type="button"
            onClick={clearCustomerFilter}
            className="rounded p-0.5 text-muted-foreground hover:bg-background/60 hover:text-foreground"
            aria-label={t('admin.orders.clearCustomerFilter', { defaultValue: 'Clear customer filter' })}
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('admin.orders.searchPlaceholder', { defaultValue: 'Search by email…' })}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={status || 'all'} onValueChange={(v) => setStatus(v === 'all' ? '' : (v as OrderStatus))}>
          <SelectTrigger className="sm:w-44">
            <SelectValue placeholder={t('admin.orders.allStatuses', { defaultValue: 'All statuses' })} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('admin.orders.allStatuses', { defaultValue: 'All statuses' })}</SelectItem>
            <SelectItem value="pending">{t('admin.orders.statusPending', { defaultValue: 'Pending' })}</SelectItem>
            <SelectItem value="paid">{t('admin.orders.statusPaid', { defaultValue: 'Paid' })}</SelectItem>
            <SelectItem value="shipped">{t('admin.orders.statusShipped', { defaultValue: 'Shipped' })}</SelectItem>
            <SelectItem value="delivered">{t('admin.orders.statusDelivered', { defaultValue: 'Delivered' })}</SelectItem>
            <SelectItem value="cancelled">{t('admin.orders.statusCancelled', { defaultValue: 'Cancelled' })}</SelectItem>
          </SelectContent>
        </Select>
        <DateRangeFilter {...dateFilter} />
      </div>

      {selectedIds.length > 0 && (
        <div
          className={cn(
            'mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between',
            'rounded-md border border-gold/40 bg-gold/10 px-3 py-2',
          )}
        >
          <div className="flex items-center gap-2 text-sm">
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="rounded p-1 text-muted-foreground hover:bg-background/60 hover:text-foreground"
              aria-label={t('admin.common.clearSelection', { defaultValue: 'Clear selection' })}
            >
              <X size={14} />
            </button>
            <span className="font-medium">
              {t('admin.orders.selectedCount', {
                count: selectedIds.length,
                defaultValue: `${selectedIds.length} selected`,
              })}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {t('admin.orders.markAs', { defaultValue: 'Mark as' })}
            </span>
            {ALL_STATUSES.map((s) => (
              <Button
                key={s}
                size="sm"
                variant="outline"
                disabled={bulkPending}
                onClick={() => applyBulkStatus(s)}
              >
                {statusLabel(s)}
              </Button>
            ))}
          </div>
        </div>
      )}

      <DataTable<AdminOrderListItem, number>
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(r) => r.id}
        loading={loading}
        emptyMessage={t('admin.orders.emptyMessage', { defaultValue: 'No orders yet.' })}
        onRowClick={(row) => navigate(`/admin/orders/${row.id}`)}
        selection={{ selectedIds, onChange: setSelectedIds }}
        page={page}
        pageSize={PAGE_SIZE}
        total={data?.total ?? 0}
        onPageChange={setPage}
      />
    </div>
  );
};

export default OrdersListPage;
