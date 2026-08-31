import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Seo from '@/components/Seo';
import { ordersApi, type Order, type OrderStatus } from '@/lib/orders-api';
import { ApiError } from '@/lib/api';
import { formatMoneyGEL } from '@/lib/money';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

const statusBadge: Record<OrderStatus, string> = {
  pending: 'bg-secondary text-foreground border-border',
  paid: 'bg-purpose-balance/15 text-purpose-balance border-purpose-balance/30',
  shipped: 'bg-purpose-luck/15 text-purpose-luck border-purpose-luck/30',
  delivered: 'bg-gold/15 text-foreground border-gold/30',
  cancelled: 'bg-destructive/15 text-destructive border-destructive/30',
};

const OrderDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    ordersApi
      .getMine(Number(id))
      .then((o) => {
        if (!cancelled) setOrder(o);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.detail : 'Could not load order');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Seo
        title={order ? `Order #${order.id} | Gisheri` : 'Order | Gisheri'}
        robots="noindex,nofollow"
      />
      <Header />
      <main className="flex-1 pt-20 pb-12 px-4">
        <div className="container-main max-w-3xl py-12">
          {loading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : error || !order ? (
            <Card className="p-8 text-center">
              <h1 className="font-serif text-xl mb-2">Order not found</h1>
              <p className="text-muted-foreground text-sm mb-6">{error}</p>
              <Link to="/account">
                <Button>Go to my account</Button>
              </Link>
            </Card>
          ) : (
            <>
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gold/15 mb-3">
                  <Check size={20} className="text-gold" />
                </div>
                <h1 className="heading-hero">
                  {t('orderPage.thanks', { defaultValue: 'Thank you!' })}
                </h1>
                <p className="text-muted-foreground mt-2">
                  {t('orderPage.confirmation', {
                    id: order.id,
                    defaultValue: `Order #${order.id} placed. We'll be in touch shortly.`,
                  })}
                </p>
              </div>

              <Card className="p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Order</p>
                    <p className="font-serif text-lg font-medium">#{order.id}</p>
                  </div>
                  <Badge variant="outline" className={cn('capitalize', statusBadge[order.status])}>
                    {order.status}
                  </Badge>
                </div>
                <Separator className="my-4" />
                <div className="space-y-3">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex gap-4 items-center">
                      <div className="h-14 w-14 rounded bg-muted overflow-hidden shrink-0">
                        {item.productImage && (
                          <img src={item.productImage} alt="" className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.productName}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.size && `Size ${item.size} · `}Qty {item.quantity} · {formatMoneyGEL(Number(item.unitPrice))}
                        </p>
                      </div>
                      <span className="font-medium tabular-nums shrink-0">
                        {formatMoneyGEL(Number(item.lineTotal))}
                      </span>
                    </div>
                  ))}
                </div>
                <Separator className="my-4" />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatMoneyGEL(Number(order.subtotal))}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground mt-1">
                  <span>Shipping</span>
                  <span>Calculated separately</span>
                </div>
                <Separator className="my-3" />
                <div className="flex justify-between items-center">
                  <span className="font-medium">Total</span>
                  <span className="text-xl font-semibold">{formatMoneyGEL(Number(order.total))}</span>
                </div>
              </Card>

              <Card className="p-6 mb-6">
                <h2 className="font-serif text-lg font-medium mb-4">Shipping</h2>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Recipient</dt>
                  <dd>{order.fullName}</dd>
                  <dt className="text-muted-foreground">Email</dt>
                  <dd className="break-all">{order.email}</dd>
                  <dt className="text-muted-foreground">Phone</dt>
                  <dd>{order.phone}</dd>
                  <dt className="text-muted-foreground">City</dt>
                  <dd>{order.city}</dd>
                  <dt className="text-muted-foreground">Address</dt>
                  <dd>{order.address}</dd>
                  {order.notes && (
                    <>
                      <dt className="text-muted-foreground">Notes</dt>
                      <dd className="whitespace-pre-wrap">{order.notes}</dd>
                    </>
                  )}
                </dl>
              </Card>

              <div className="flex justify-center gap-3">
                <Link to="/shop">
                  <Button variant="outline">Continue shopping</Button>
                </Link>
                <Link to="/account">
                  <Button>My account</Button>
                </Link>
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default OrderDetailPage;
