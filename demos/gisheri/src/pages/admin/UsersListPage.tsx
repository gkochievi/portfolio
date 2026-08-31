import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
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
  adminUsers,
  type AdminUser,
  type AdminUserListResponse,
  type UserBulkAction,
} from '@/lib/admin-api';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { useDateRangeFilter } from '@/hooks/use-date-range-filter';
import type { Role } from '@/context/auth';

const PAGE_SIZE = 25;

const roleBadgeStyle: Record<Role, string> = {
  customer: 'bg-secondary text-foreground border-border',
  staff: 'bg-purpose-balance/15 text-purpose-balance border-purpose-balance/30',
  admin: 'bg-gold/15 text-foreground border-gold/30',
};

const UsersListPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [data, setData] = useState<AdminUserListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [role, setRole] = useState<'' | Role>('');
  const [active, setActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkPending, setBulkPending] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const dateFilter = useDateRangeFilter();
  const { effectiveFrom, effectiveTo } = dateFilter;

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(id);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, role, active, effectiveFrom, effectiveTo]);

  useEffect(() => {
    setSelectedIds([]);
  }, [debouncedQ, role, active, effectiveFrom, effectiveTo, page]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const isActive = active === 'all' ? undefined : active === 'active';
    adminUsers
      .list({
        q: debouncedQ,
        role,
        isActive,
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
          title: t('admin.users.loadFailed', { defaultValue: 'Failed to load users' }),
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
  }, [debouncedQ, role, active, effectiveFrom, effectiveTo, page, reloadTick, toast, t]);

  const runBulk = async (action: UserBulkAction) => {
    if (selectedIds.length === 0 || bulkPending) return;
    setBulkPending(true);
    try {
      const res = await adminUsers.bulk(selectedIds, action);
      toast({
        title:
          action === 'activate'
            ? t('admin.users.bulkActivated', {
                count: res.affected,
                defaultValue: `Activated ${res.affected} users`,
              })
            : t('admin.users.bulkDeactivated', {
                count: res.affected,
                defaultValue: `Deactivated ${res.affected} users`,
              }),
        description: res.skippedSelf
          ? t('admin.users.bulkSkippedSelf', {
              defaultValue: 'Your own account was skipped — change it from your profile.',
            })
          : undefined,
      });
      setSelectedIds([]);
      setReloadTick((n) => n + 1);
    } catch (err) {
      toast({
        title: t('admin.users.bulkFailed', { defaultValue: 'Bulk action failed' }),
        description: err instanceof ApiError ? err.detail : undefined,
        variant: 'destructive',
      });
    } finally {
      setBulkPending(false);
    }
  };

  const roleLabel = (r: Role) => t(`admin.users.role${r.charAt(0).toUpperCase() + r.slice(1)}`, { defaultValue: r });

  const columns: Column<AdminUser>[] = [
    {
      key: 'email',
      header: t('admin.users.email', { defaultValue: 'Email' }),
      cell: (row) => <span className="font-medium">{row.email}</span>,
    },
    {
      key: 'name',
      header: t('admin.users.name', { defaultValue: 'Name' }),
      cell: (row) => `${row.firstName} ${row.lastName}`.trim() || '—',
    },
    {
      key: 'role',
      header: t('admin.users.role', { defaultValue: 'Role' }),
      cell: (row) => (
        <Badge variant="outline" className={`${roleBadgeStyle[row.role]}`}>
          {roleLabel(row.role)}
        </Badge>
      ),
    },
    {
      key: 'active',
      header: t('admin.users.statusCol', { defaultValue: 'Status' }),
      cell: (row) =>
        row.isActive ? (
          <span className="text-xs text-foreground">{t('admin.users.active', { defaultValue: 'Active' })}</span>
        ) : (
          <span className="text-xs text-muted-foreground">{t('admin.users.inactive', { defaultValue: 'Inactive' })}</span>
        ),
    },
    {
      key: 'joined',
      header: t('admin.users.joined', { defaultValue: 'Joined' }),
      cell: (row) => new Date(row.dateJoined).toLocaleDateString(),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('admin.users.title', { defaultValue: 'Users' })}
        description={t('admin.users.count', { count: data?.total ?? 0, defaultValue: `${data?.total ?? 0} users` })}
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('admin.users.searchPlaceholder', { defaultValue: 'Search email or name…' })}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={role || 'all'} onValueChange={(v) => setRole(v === 'all' ? '' : (v as Role))}>
          <SelectTrigger className="sm:w-44">
            <SelectValue placeholder={t('admin.users.allRoles', { defaultValue: 'All roles' })} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('admin.users.allRoles', { defaultValue: 'All roles' })}</SelectItem>
            <SelectItem value="customer">{t('admin.users.roleCustomer', { defaultValue: 'Customer' })}</SelectItem>
            <SelectItem value="staff">{t('admin.users.roleStaff', { defaultValue: 'Staff' })}</SelectItem>
            <SelectItem value="admin">{t('admin.users.roleAdmin', { defaultValue: 'Admin' })}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={active} onValueChange={(v) => setActive(v as typeof active)}>
          <SelectTrigger className="sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('admin.users.allStatuses', { defaultValue: 'All statuses' })}</SelectItem>
            <SelectItem value="active">{t('admin.users.active', { defaultValue: 'Active' })}</SelectItem>
            <SelectItem value="inactive">{t('admin.users.inactive', { defaultValue: 'Inactive' })}</SelectItem>
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
              {t('admin.users.selectedCount', {
                count: selectedIds.length,
                defaultValue: `${selectedIds.length} selected`,
              })}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" disabled={bulkPending} onClick={() => runBulk('activate')}>
              {t('admin.users.bulkActivate', { defaultValue: 'Activate' })}
            </Button>
            <Button size="sm" variant="outline" disabled={bulkPending} onClick={() => runBulk('deactivate')}>
              {t('admin.users.bulkDeactivate', { defaultValue: 'Deactivate' })}
            </Button>
          </div>
        </div>
      )}

      <DataTable<AdminUser, number>
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(r) => r.id}
        loading={loading}
        emptyMessage={t('admin.users.emptyMessage', { defaultValue: 'No users match these filters.' })}
        onRowClick={(row) => navigate(`/admin/users/${row.id}`)}
        selection={{ selectedIds, onChange: setSelectedIds }}
        page={page}
        pageSize={PAGE_SIZE}
        total={data?.total ?? 0}
        onPageChange={setPage}
      />
    </div>
  );
};

export default UsersListPage;
