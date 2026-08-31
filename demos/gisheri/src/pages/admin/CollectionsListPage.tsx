import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/admin/PageHeader';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { adminCollections, type AdminCollection } from '@/lib/admin-api';
import { ApiError } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';

const PAGE_SIZE = 100;

const CollectionsListPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [items, setItems] = useState<AdminCollection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminCollections
      .list()
      .then((res) => {
        if (!cancelled) setItems(res.items);
      })
      .catch((err) => {
        if (cancelled) return;
        toast({
          title: t('admin.collections.loadFailed', { defaultValue: 'Failed to load collections' }),
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
  }, [toast, t]);

  const columns: Column<AdminCollection>[] = [
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
      key: 'slug',
      header: t('admin.collections.slug', { defaultValue: 'Slug' }),
      cell: (row) => <span className="font-mono text-xs">{row.slug}</span>,
    },
    {
      key: 'name',
      header: t('admin.products.name', { defaultValue: 'Name' }),
      cell: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
      key: 'description',
      header: 'Description',
      cell: (row) => (
        <span className="text-muted-foreground text-xs line-clamp-1">{row.description}</span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('admin.collections.title', { defaultValue: 'Collections' })}
        description={t('admin.collections.count', { count: items.length, defaultValue: `${items.length} collections` })}
        actions={
          <Button onClick={() => navigate('/admin/collections/new')}>
            <Plus size={16} />
            {t('admin.collections.newCollection', { defaultValue: 'New collection' })}
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={items}
        rowKey={(r) => r.id}
        loading={loading}
        emptyMessage={t('admin.collections.emptyMessage', { defaultValue: 'No collections yet.' })}
        onRowClick={(row) => navigate(`/admin/collections/${row.id}`)}
        page={1}
        pageSize={PAGE_SIZE}
        total={items.length}
        onPageChange={() => undefined}
      />
    </div>
  );
};

export default CollectionsListPage;
