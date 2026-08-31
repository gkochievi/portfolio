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
import { DataTable, type Column } from '@/components/admin/DataTable';
import {
  adminProducts,
  type AdminProduct,
  type Gender,
  type ProductBulkAction,
  type ProductListResponse,
} from '@/lib/admin-api';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';

const PAGE_SIZE = 25;

const ProductsListPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [data, setData] = useState<ProductListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [gender, setGender] = useState<'' | Gender>('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkPending, setBulkPending] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(id);
  }, [q]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [debouncedQ, gender]);

  useEffect(() => {
    setSelectedIds([]);
  }, [debouncedQ, gender, page]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminProducts
      .list({ q: debouncedQ, gender, page, pageSize: PAGE_SIZE })
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (cancelled) return;
        toast({
          title: t('admin.products.loadFailed', { defaultValue: 'Failed to load products' }),
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
  }, [debouncedQ, gender, page, reloadTick, toast, t]);

  const runBulk = async (action: ProductBulkAction) => {
    if (selectedIds.length === 0 || bulkPending) return;
    setBulkPending(true);
    try {
      const res = await adminProducts.bulk(selectedIds, action);
      toast({
        title:
          action === 'delete'
            ? t('admin.products.bulkDeleted', {
                count: res.affected,
                defaultValue: `Deleted ${res.affected} products`,
              })
            : t('admin.products.bulkUpdated', {
                count: res.affected,
                defaultValue: `Updated ${res.affected} products`,
              }),
      });
      setSelectedIds([]);
      setConfirmDelete(false);
      setReloadTick((n) => n + 1);
    } catch (err) {
      toast({
        title: t('admin.products.bulkFailed', { defaultValue: 'Bulk action failed' }),
        description: err instanceof ApiError ? err.detail : undefined,
        variant: 'destructive',
      });
    } finally {
      setBulkPending(false);
    }
  };

  const columns: Column<AdminProduct>[] = [
    {
      key: 'image',
      header: '',
      headerClassName: 'w-16',
      cell: (row) => (
        <div className="h-10 w-10 rounded bg-muted overflow-hidden">
          {row.image && <img src={row.image} alt="" className="h-full w-full object-cover" />}
        </div>
      ),
    },
    {
      key: 'name',
      header: t('admin.products.name', { defaultValue: 'Name' }),
      cell: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
      key: 'price',
      header: t('admin.products.price', { defaultValue: 'Price' }),
      headerClassName: 'text-right',
      className: 'text-right tabular-nums',
      cell: (row) => `₾${row.price}`,
    },
    {
      key: 'gender',
      header: t('admin.products.gender', { defaultValue: 'Gender' }),
      cell: (row) => <span className="capitalize">{row.gender}</span>,
    },
    {
      key: 'flags',
      header: t('admin.products.flags', { defaultValue: 'Flags' }),
      cell: (row) => (
        <div className="flex gap-1">
          {row.isBestseller && (
            <Badge variant="outline" className="bg-gold/10 border-gold/30 text-[10px]">
              {t('admin.products.bestsellerFlag', { defaultValue: 'Best' })}
            </Badge>
          )}
          {row.isNew && (
            <Badge variant="outline" className="bg-purpose-luck/10 border-purpose-luck/30 text-[10px]">
              {t('admin.products.newFlag', { defaultValue: 'New' })}
            </Badge>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('admin.products.title', { defaultValue: 'Products' })}
        description={t('admin.products.count', { count: data?.total ?? 0, defaultValue: `${data?.total ?? 0} products in catalog` })}
        actions={
          <Button onClick={() => navigate('/admin/products/new')}>
            <Plus size={16} />
            {t('admin.products.newProduct', { defaultValue: 'New product' })}
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('admin.products.searchPlaceholder', { defaultValue: 'Search by name…' })}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={gender || 'all'} onValueChange={(v) => setGender(v === 'all' ? '' : (v as Gender))}>
          <SelectTrigger className="sm:w-44">
            <SelectValue placeholder={t('admin.products.allGenders', { defaultValue: 'All genders' })} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('admin.products.allGenders', { defaultValue: 'All genders' })}</SelectItem>
            <SelectItem value="men">{t('admin.products.menGender', { defaultValue: 'Men' })}</SelectItem>
            <SelectItem value="women">{t('admin.products.womenGender', { defaultValue: 'Women' })}</SelectItem>
            <SelectItem value="unisex">{t('admin.products.unisexGender', { defaultValue: 'Unisex' })}</SelectItem>
          </SelectContent>
        </Select>
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
              {t('admin.products.selectedCount', {
                count: selectedIds.length,
                defaultValue: `${selectedIds.length} selected`,
              })}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" disabled={bulkPending} onClick={() => runBulk('set_bestseller')}>
              {t('admin.products.bulkMarkBestseller', { defaultValue: 'Mark bestseller' })}
            </Button>
            <Button size="sm" variant="outline" disabled={bulkPending} onClick={() => runBulk('unset_bestseller')}>
              {t('admin.products.bulkUnmarkBestseller', { defaultValue: 'Unmark bestseller' })}
            </Button>
            <Button size="sm" variant="outline" disabled={bulkPending} onClick={() => runBulk('set_new')}>
              {t('admin.products.bulkMarkNew', { defaultValue: 'Mark new' })}
            </Button>
            <Button size="sm" variant="outline" disabled={bulkPending} onClick={() => runBulk('unset_new')}>
              {t('admin.products.bulkUnmarkNew', { defaultValue: 'Unmark new' })}
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

      <DataTable<AdminProduct, number>
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(r) => r.id}
        loading={loading}
        emptyMessage={t('admin.products.emptyMessage', { defaultValue: "No products yet. Click 'New product' to add one." })}
        onRowClick={(row) => navigate(`/admin/products/${row.id}`)}
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
              {t('admin.products.bulkDeleteTitle', {
                count: selectedIds.length,
                defaultValue: `Delete ${selectedIds.length} products?`,
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.products.bulkDeleteDescription', {
                defaultValue:
                  'This permanently removes the selected products from the catalog. Image files remain on disk.',
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

export default ProductsListPage;
