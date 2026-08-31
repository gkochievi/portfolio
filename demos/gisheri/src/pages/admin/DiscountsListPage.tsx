import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  adminDiscounts,
  type Discount,
  type DiscountBulkAction,
  type DiscountKind,
  type DiscountListResponse,
} from '@/lib/discounts-api';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { useDateRangeFilter } from '@/hooks/use-date-range-filter';

const PAGE_SIZE = 25;

const DiscountsListPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [data, setData] = useState<DiscountListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [active, setActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [kind, setKind] = useState<'' | DiscountKind>('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkPending, setBulkPending] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dateFilter = useDateRangeFilter();
  const { effectiveFrom, effectiveTo } = dateFilter;

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(id);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, active, kind, effectiveFrom, effectiveTo]);

  useEffect(() => {
    setSelectedIds([]);
  }, [debouncedQ, active, kind, effectiveFrom, effectiveTo, page]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const isActive = active === 'all' ? undefined : active === 'active';
    adminDiscounts
      .list({
        q: debouncedQ,
        isActive,
        kind,
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
          title: t('admin.discounts.loadFailed', { defaultValue: 'Failed to load discounts' }),
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
  }, [debouncedQ, active, kind, effectiveFrom, effectiveTo, page, reloadTick, toast, t]);

  const runBulk = async (action: DiscountBulkAction) => {
    if (selectedIds.length === 0 || bulkPending) return;
    setBulkPending(true);
    try {
      const res = await adminDiscounts.bulk(selectedIds, action);
      toast({
        title:
          action === 'delete'
            ? t('admin.discounts.bulkDeleted', {
                count: res.affected,
                defaultValue: `Deleted ${res.affected} codes`,
              })
            : action === 'activate'
              ? t('admin.discounts.bulkActivated', {
                  count: res.affected,
                  defaultValue: `Activated ${res.affected} codes`,
                })
              : t('admin.discounts.bulkDeactivated', {
                  count: res.affected,
                  defaultValue: `Deactivated ${res.affected} codes`,
                }),
      });
      setSelectedIds([]);
      setConfirmDelete(false);
      setReloadTick((n) => n + 1);
    } catch (err) {
      toast({
        title: t('admin.discounts.bulkFailed', { defaultValue: 'Bulk action failed' }),
        description: err instanceof ApiError ? err.detail : undefined,
        variant: 'destructive',
      });
    } finally {
      setBulkPending(false);
    }
  };

  const columns: Column<Discount>[] = [
    {
      key: 'code',
      header: t('admin.discounts.code', { defaultValue: 'Code' }),
      cell: (row) => <span className="font-mono font-medium">{row.code}</span>,
    },
    {
      key: 'kind',
      header: t('admin.discounts.kind', { defaultValue: 'Kind' }),
      cell: (row) =>
        row.kind === 'percent'
          ? t('admin.discounts.percentOff', { value: row.value, defaultValue: `${row.value}% off` })
          : t('admin.discounts.fixedOff', { value: row.value, defaultValue: `−₾${row.value}` }),
    },
    {
      key: 'usage',
      header: t('admin.discounts.usage', { defaultValue: 'Usage' }),
      cell: (row) => (row.maxUses === null ? `${row.usesCount}` : `${row.usesCount} / ${row.maxUses}`),
    },
    {
      key: 'expires',
      header: t('admin.discounts.expires', { defaultValue: 'Expires' }),
      cell: (row) => (row.expiresAt ? new Date(row.expiresAt).toLocaleDateString() : '—'),
    },
    {
      key: 'status',
      header: t('admin.discounts.status', { defaultValue: 'Status' }),
      cell: (row) =>
        row.isActive ? (
          <Badge variant="outline" className="bg-purpose-balance/15 border-purpose-balance/30 text-purpose-balance">
            {t('admin.discounts.active', { defaultValue: 'Active' })}
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-secondary text-muted-foreground">
            {t('admin.discounts.inactive', { defaultValue: 'Inactive' })}
          </Badge>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('admin.discounts.title', { defaultValue: 'Discounts' })}
        description={t('admin.discounts.count', { count: data?.total ?? 0, defaultValue: `${data?.total ?? 0} discount codes` })}
        actions={
          <Button onClick={() => navigate('/admin/discounts/new')}>
            <Plus size={16} />
            {t('admin.discounts.newCode', { defaultValue: 'New code' })}
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('admin.discounts.searchPlaceholder', { defaultValue: 'Search by code…' })}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={kind || 'all'} onValueChange={(v) => setKind(v === 'all' ? '' : (v as DiscountKind))}>
          <SelectTrigger className="sm:w-44">
            <SelectValue placeholder={t('admin.discounts.allKinds', { defaultValue: 'All kinds' })} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('admin.discounts.allKinds', { defaultValue: 'All kinds' })}</SelectItem>
            <SelectItem value="percent">{t('admin.discounts.kindPercent', { defaultValue: 'Percent off' })}</SelectItem>
            <SelectItem value="fixed">{t('admin.discounts.kindFixed', { defaultValue: 'Fixed off' })}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={active} onValueChange={(v) => setActive(v as typeof active)}>
          <SelectTrigger className="sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('admin.discounts.allStatuses', { defaultValue: 'All statuses' })}</SelectItem>
            <SelectItem value="active">{t('admin.discounts.active', { defaultValue: 'Active' })}</SelectItem>
            <SelectItem value="inactive">{t('admin.discounts.inactive', { defaultValue: 'Inactive' })}</SelectItem>
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
              {t('admin.discounts.selectedCount', {
                count: selectedIds.length,
                defaultValue: `${selectedIds.length} selected`,
              })}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" disabled={bulkPending} onClick={() => runBulk('activate')}>
              {t('admin.discounts.bulkActivate', { defaultValue: 'Activate' })}
            </Button>
            <Button size="sm" variant="outline" disabled={bulkPending} onClick={() => runBulk('deactivate')}>
              {t('admin.discounts.bulkDeactivate', { defaultValue: 'Deactivate' })}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive"
              disabled={bulkPending}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={14} />
              {t('admin.common.delete', { defaultValue: 'Delete' })}
            </Button>
          </div>
        </div>
      )}

      <DataTable<Discount, number>
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(r) => r.id}
        loading={loading}
        emptyMessage={t('admin.discounts.emptyMessage', { defaultValue: 'No discounts yet.' })}
        onRowClick={(row) => navigate(`/admin/discounts/${row.id}`)}
        selection={{ selectedIds, onChange: setSelectedIds }}
        page={page}
        pageSize={PAGE_SIZE}
        total={data?.total ?? 0}
        onPageChange={setPage}
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('admin.discounts.bulkDeleteTitle', {
                count: selectedIds.length,
                defaultValue: `Delete ${selectedIds.length} codes?`,
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.discounts.bulkDeleteDescription', {
                defaultValue:
                  'This permanently removes the selected codes. Past orders that used them keep their snapshots.',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkPending}>
              {t('admin.common.cancel', { defaultValue: 'Cancel' })}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={bulkPending}
              onClick={() => runBulk('delete')}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkPending
                ? t('admin.common.deleting', { defaultValue: 'Deleting…' })
                : t('admin.common.delete', { defaultValue: 'Delete' })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DiscountsListPage;
