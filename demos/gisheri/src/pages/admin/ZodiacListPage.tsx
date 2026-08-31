import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/admin/PageHeader';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { adminZodiac, type AdminZodiac } from '@/lib/admin-api';
import { ApiError } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';

const PAGE_SIZE = 100;

const ZodiacListPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [items, setItems] = useState<AdminZodiac[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminZodiac
      .list()
      .then((res) => {
        if (!cancelled) setItems(res);
      })
      .catch((err) => {
        if (cancelled) return;
        toast({
          title: t('admin.zodiac.loadFailed', { defaultValue: 'Failed to load zodiac signs' }),
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

  const columns: Column<AdminZodiac>[] = [
    {
      key: 'symbol',
      header: '',
      headerClassName: 'w-10',
      cell: (row) => <span className="text-2xl">{row.symbol}</span>,
    },
    {
      key: 'sign',
      header: t('admin.zodiac.tableSign', { defaultValue: 'Sign' }),
      cell: (row) => <span className="font-mono text-xs capitalize">{row.sign}</span>,
    },
    {
      key: 'name',
      header: t('admin.zodiac.tableName', { defaultValue: 'Name' }),
      cell: (row) => (
        <div className="min-w-0">
          <p className="font-medium">{row.name}</p>
          {row.nameKa && <p className="text-xs text-muted-foreground">{row.nameKa}</p>}
        </div>
      ),
    },
    {
      key: 'dates',
      header: t('admin.zodiac.tableDates', { defaultValue: 'Dates' }),
      cell: (row) => <span className="text-xs">{row.dates}</span>,
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('admin.zodiac.title', { defaultValue: 'Zodiac signs' })}
        description={t('admin.zodiac.subtitle', {
          defaultValue: 'Edit-only — the 12 signs are fixed. Bilingual fields control what shoppers see on /zodiac/:sign.',
        })}
      />

      <DataTable
        columns={columns}
        rows={items}
        rowKey={(r) => r.sign}
        loading={loading}
        onRowClick={(row) => navigate(`/admin/zodiac/${row.sign}`)}
        page={1}
        pageSize={PAGE_SIZE}
        total={items.length}
        onPageChange={() => undefined}
      />
    </div>
  );
};

export default ZodiacListPage;
