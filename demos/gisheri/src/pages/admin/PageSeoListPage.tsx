import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PageHeader from '@/components/admin/PageHeader';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { adminPageSeo, type PageSeo } from '@/lib/site-settings-api';
import { ApiError } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';

const PAGE_SIZE = 100;

const PageSeoListPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [items, setItems] = useState<PageSeo[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(
      (i) =>
        i.path.toLowerCase().includes(needle) ||
        i.titleEn.toLowerCase().includes(needle) ||
        i.titleKa.toLowerCase().includes(needle),
    );
  }, [items, q]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminPageSeo
      .list()
      .then((res) => {
        if (!cancelled) setItems(res);
      })
      .catch((err) => {
        if (cancelled) return;
        toast({
          title: t('admin.pageSeo.loadFailed', { defaultValue: 'Failed to load page SEO' }),
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

  const columns: Column<PageSeo>[] = [
    {
      key: 'path',
      header: t('admin.pageSeo.path', { defaultValue: 'Path' }),
      cell: (row) => <span className="font-mono">{row.path}</span>,
    },
    {
      key: 'title',
      header: `${t('admin.pageSeo.titleSection', { defaultValue: 'Title' })} (EN)`,
      cell: (row) => row.titleEn || <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'robots',
      header: t('admin.pageSeo.robots', { defaultValue: 'Robots' }),
      cell: (row) => row.robots || <span className="text-muted-foreground">{t('admin.pageSeo.default', { defaultValue: 'default' })}</span>,
    },
    {
      key: 'updated',
      header: 'Updated',
      cell: (row) => new Date(row.updatedAt).toLocaleDateString(),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('admin.pageSeo.title', { defaultValue: 'Page SEO overrides' })}
        description={t('admin.pageSeo.description', {
          count: items.length,
          defaultValue: `${items.length} routes overridden. Path is exact-match (e.g. /shop, /zodiac/aries).`,
        })}
        actions={
          <Button onClick={() => navigate('/admin/page-seo/new')}>
            <Plus size={16} />
            {t('admin.pageSeo.newOverride', { defaultValue: 'New override' })}
          </Button>
        }
      />

      <div className="mb-4 max-w-md">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('admin.pageSeo.searchPlaceholder', { defaultValue: 'Search path or title…' })}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(r) => r.id}
        loading={loading}
        emptyMessage={
          q
            ? t('admin.common.noResults', { defaultValue: 'No results.' })
            : t('admin.pageSeo.emptyMessage', {
                defaultValue: "No overrides yet. Create one to customize a page's title / description / OG image.",
              })
        }
        onRowClick={(row) => navigate(`/admin/page-seo/${row.id}`)}
        page={1}
        pageSize={PAGE_SIZE}
        total={filtered.length}
        onPageChange={() => undefined}
      />
    </div>
  );
};

export default PageSeoListPage;
