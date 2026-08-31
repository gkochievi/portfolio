import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Package, ShoppingBag, Users, Tag, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  adminDashboard,
  type DashboardStats,
  type OrderStatusKey,
} from '@/lib/admin-api';
import { ApiError } from '@/lib/api';
import { formatMoneyGEL } from '@/lib/money';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';

const statusBadge: Record<OrderStatusKey, string> = {
  pending: 'bg-secondary text-foreground border-border',
  paid: 'bg-purpose-balance/15 text-purpose-balance border-purpose-balance/30',
  shipped: 'bg-purpose-luck/15 text-purpose-luck border-purpose-luck/30',
  delivered: 'bg-gold/15 text-foreground border-gold/30',
  cancelled: 'bg-destructive/15 text-destructive border-destructive/30',
};

const AdminDashboardPage = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [data, setData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminDashboard
      .stats()
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (cancelled) return;
        toast({
          title: t('admin.dashboard.title', { defaultValue: 'Dashboard' }),
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

  const statusLabel = (s: OrderStatusKey) =>
    t(`admin.orders.status${s.charAt(0).toUpperCase() + s.slice(1)}`, { defaultValue: s });

  const stats = [
    {
      key: 'revenue',
      label: t('admin.dashboard.revenue', { defaultValue: 'Revenue' }),
      hint: t('admin.dashboard.revenueHint', { defaultValue: 'Sum of paid + shipped + delivered orders.' }),
      value: data ? formatMoneyGEL(Number(data.totalRevenue)) : '—',
      icon: ArrowRight,
      iconClass: 'text-gold bg-gold/10',
    },
    {
      key: 'orders',
      label: t('admin.dashboard.orders', { defaultValue: 'Orders' }),
      value: data?.orderCount ?? '—',
      icon: ShoppingBag,
      iconClass: 'text-purpose-balance bg-purpose-balance/10',
    },
    {
      key: 'products',
      label: t('admin.dashboard.products', { defaultValue: 'Products' }),
      value: data?.productCount ?? '—',
      icon: Package,
      iconClass: 'text-purpose-luck bg-purpose-luck/10',
    },
    {
      key: 'users',
      label: t('admin.dashboard.users', { defaultValue: 'Customers' }),
      value: data?.userCount ?? '—',
      icon: Users,
      iconClass: 'text-purpose-protection bg-purpose-protection/10',
    },
  ];

  return (
    <div>
      <h1 className="font-serif text-2xl md:text-3xl font-medium mb-1">
        {t('admin.dashboard.title', { defaultValue: 'Dashboard' })}
      </h1>
      <p className="text-muted-foreground mb-8">
        {t('admin.dashboard.subtitle', { defaultValue: 'Snapshot of products, orders, customers, and revenue.' })}
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.key} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</p>
                <span className={cn('h-8 w-8 rounded-full flex items-center justify-center', s.iconClass)}>
                  <Icon size={14} />
                </span>
              </div>
              <p className="font-serif text-2xl font-medium tabular-nums">
                {loading ? '—' : s.value}
              </p>
              {s.hint && <p className="text-[10px] text-muted-foreground mt-1.5">{s.hint}</p>}
            </Card>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        {/* Recent orders */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-lg font-medium">
              {t('admin.dashboard.recentOrders', { defaultValue: 'Recent orders' })}
            </h2>
            <Link
              to="/admin/orders"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              {t('admin.dashboard.viewAllOrders', { defaultValue: 'View all orders' })}
              <ArrowRight size={12} />
            </Link>
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">
              {t('admin.common.loading', { defaultValue: 'Loading…' })}
            </p>
          ) : !data || data.recentOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('admin.dashboard.noRecentOrders', {
                defaultValue: "No orders yet — when customers place orders they'll show here.",
              })}
            </p>
          ) : (
            <div className="space-y-2">
              {data.recentOrders.map((order) => (
                <Link
                  key={order.id}
                  to={`/admin/orders/${order.id}`}
                  className="flex items-center gap-3 px-3 py-2 -mx-3 rounded-md hover:bg-muted/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm">
                      #{order.id} · <span className="text-muted-foreground">{order.fullName}</span>
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {order.email} · {new Date(order.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge variant="outline" className={cn('capitalize', statusBadge[order.status])}>
                      {statusLabel(order.status)}
                    </Badge>
                    <span className="text-sm font-medium tabular-nums">
                      {formatMoneyGEL(Number(order.total))}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Status breakdown */}
        <Card className="p-6">
          <h2 className="font-serif text-lg font-medium mb-4">
            {t('admin.dashboard.ordersByStatus', { defaultValue: 'Orders by status' })}
          </h2>
          <div className="space-y-2 text-sm">
            {data?.ordersByStatus.map((row) => (
              <div key={row.status} className="flex items-center justify-between">
                <Badge variant="outline" className={cn('capitalize', statusBadge[row.status])}>
                  {statusLabel(row.status)}
                </Badge>
                <span className="tabular-nums font-medium">{row.count}</span>
              </div>
            )) ?? (
              <p className="text-muted-foreground text-xs">{t('admin.common.loading', { defaultValue: 'Loading…' })}</p>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-border">
            <div className="flex items-center justify-between text-sm mb-2">
              <Tag size={14} className="text-muted-foreground" />
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                {t('admin.dashboard.activeDiscounts', { defaultValue: 'Active discounts' })}
              </span>
              <span className="tabular-nums font-medium ml-auto">
                {data?.activeDiscountCount ?? '—'}
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboardPage;
