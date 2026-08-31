import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, Copy, Mail, Minus, Phone, Plus, Trash2, User, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
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
import PageHeader from '@/components/admin/PageHeader';
import ActivityFeed from '@/components/admin/ActivityFeed';
import ProductPickerDialog from '@/components/admin/ProductPickerDialog';
import { adminOrdersApi, type Order, type OrderStatus } from '@/lib/orders-api';
import type { AdminProduct } from '@/lib/admin-api';
import { ApiError } from '@/lib/api';
import { formatMoneyGEL } from '@/lib/money';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';

const statusBadge: Record<OrderStatus, string> = {
  pending: 'bg-secondary text-foreground border-border',
  paid: 'bg-purpose-balance/15 text-purpose-balance border-purpose-balance/30',
  shipped: 'bg-purpose-luck/15 text-purpose-luck border-purpose-luck/30',
  delivered: 'bg-gold/15 text-foreground border-gold/30',
  cancelled: 'bg-destructive/15 text-destructive border-destructive/30',
};

// Linear pipeline shown on the stepper. Cancellation is a separate branch
// so it doesn't sit between "shipped" and "delivered" in the timeline.
const PIPELINE: OrderStatus[] = ['pending', 'paid', 'shipped', 'delivered'];

const AdminOrderDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { toast } = useToast();
  const statusLabel = (s: OrderStatus) =>
    t(`admin.orders.status${s.charAt(0).toUpperCase() + s.slice(1)}`, { defaultValue: s });

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const [adminNotes, setAdminNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  const [pendingStatus, setPendingStatus] = useState<OrderStatus | null>(null);
  const [addressCopied, setAddressCopied] = useState(false);
  const copyResetRef = useRef<number | null>(null);

  // Item editing — only meaningful while order.status === 'pending'
  const [itemPending, setItemPending] = useState<number | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<{ id: number; name: string } | null>(null);

  // Add-item dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addPending, setAddPending] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    adminOrdersApi
      .get(Number(id))
      .then((o) => {
        if (cancelled) return;
        setOrder(o);
        setAdminNotes(o.adminNotes ?? '');
      })
      .catch((err) => {
        toast({
          title: t('admin.orders.loadFailed', { defaultValue: 'Failed to load order' }),
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
  }, [id, toast, t]);

  useEffect(() => {
    return () => {
      if (copyResetRef.current) window.clearTimeout(copyResetRef.current);
    };
  }, []);

  const onChangeQty = async (itemId: number, nextQty: number) => {
    if (!order || itemPending !== null || nextQty < 1 || nextQty > 99) return;
    setItemPending(itemId);
    try {
      const updated = await adminOrdersApi.updateItem(order.id, itemId, { quantity: nextQty });
      setOrder(updated);
    } catch (err) {
      toast({
        title: t('admin.orders.itemUpdateFailed', { defaultValue: "Couldn't update item" }),
        description: err instanceof ApiError ? err.detail : undefined,
        variant: 'destructive',
      });
    } finally {
      setItemPending(null);
    }
  };

  const onRemoveItem = async (itemId: number) => {
    if (!order || itemPending !== null) return;
    setItemPending(itemId);
    try {
      const updated = await adminOrdersApi.removeItem(order.id, itemId);
      setOrder(updated);
      toast({ title: t('admin.orders.itemRemoved', { defaultValue: 'Item removed' }) });
      setConfirmRemove(null);
    } catch (err) {
      toast({
        title: t('admin.orders.itemRemoveFailed', { defaultValue: "Couldn't remove item" }),
        description: err instanceof ApiError ? err.detail : undefined,
        variant: 'destructive',
      });
    } finally {
      setItemPending(null);
    }
  };

  const onPickProduct = async (product: AdminProduct, size: string, quantity: number) => {
    if (!order || addPending) return;
    setAddPending(true);
    try {
      const updated = await adminOrdersApi.addItem(order.id, {
        productId: product.id,
        size,
        quantity,
      });
      setOrder(updated);
      toast({ title: t('admin.orders.itemAdded', { defaultValue: 'Item added' }) });
      setAddOpen(false);
    } catch (err) {
      toast({
        title: t('admin.orders.itemAddFailed', { defaultValue: "Couldn't add item" }),
        description: err instanceof ApiError ? err.detail : undefined,
        variant: 'destructive',
      });
      throw err;
    } finally {
      setAddPending(false);
    }
  };

  const applyStatus = async (next: OrderStatus) => {
    if (!order || updating || next === order.status) return;
    setUpdating(true);
    try {
      const updated = await adminOrdersApi.update(order.id, { status: next });
      setOrder(updated);
      toast({
        title: t('admin.orders.statusChanged', {
          status: statusLabel(updated.status),
          defaultValue: `Status changed to ${updated.status}`,
        }),
      });
    } catch (err) {
      toast({
        title: t('admin.orders.updateStatusFailed', { defaultValue: 'Failed to update status' }),
        description: err instanceof ApiError ? err.detail : undefined,
        variant: 'destructive',
      });
    } finally {
      setUpdating(false);
      setPendingStatus(null);
    }
  };

  const onSaveNotes = async () => {
    if (!order || savingNotes || adminNotes === (order.adminNotes ?? '')) return;
    setSavingNotes(true);
    try {
      const updated = await adminOrdersApi.update(order.id, { adminNotes });
      setOrder(updated);
      setAdminNotes(updated.adminNotes ?? '');
      toast({ title: t('admin.orders.notesSaved', { defaultValue: 'Notes saved' }) });
    } catch (err) {
      toast({
        title: t('admin.orders.notesSaveFailed', { defaultValue: 'Failed to save notes' }),
        description: err instanceof ApiError ? err.detail : undefined,
        variant: 'destructive',
      });
    } finally {
      setSavingNotes(false);
    }
  };

  const onCopyAddress = async () => {
    if (!order) return;
    const text = `${order.fullName}\n${order.address}\n${order.city}\n${order.phone}`;
    try {
      await navigator.clipboard.writeText(text);
      setAddressCopied(true);
      if (copyResetRef.current) window.clearTimeout(copyResetRef.current);
      copyResetRef.current = window.setTimeout(() => setAddressCopied(false), 1500);
    } catch {
      toast({
        title: t('admin.orders.copyFailed', { defaultValue: "Couldn't copy" }),
        variant: 'destructive',
      });
    }
  };

  const notesDirty = useMemo(
    () => !!order && adminNotes !== (order.adminNotes ?? ''),
    [order, adminNotes],
  );

  if (loading) {
    return (
      <div className="text-muted-foreground text-sm">
        {t('admin.common.loading', { defaultValue: 'Loading…' })}
      </div>
    );
  }
  if (!order) return null;

  const currentIndex = PIPELINE.indexOf(order.status);
  const isCancelled = order.status === 'cancelled';
  const isEditable = order.status === 'pending';
  const hasDiscount = Number(order.discountAmount) > 0;

  return (
    <div>
      <PageHeader
        title={t('admin.orders.orderNumber', { id: order.id, defaultValue: `Order #${order.id}` })}
        description={t('admin.orders.placedAt', {
          when: new Date(order.createdAt).toLocaleString(),
          defaultValue: `Placed ${new Date(order.createdAt).toLocaleString()}`,
        })}
        back={{
          to: '/admin/orders',
          label: t('admin.orders.backToOrders', { defaultValue: 'Back to orders' }),
        }}
        actions={
          <div className="flex flex-col items-end gap-1">
            <Badge variant="outline" className={cn('capitalize', statusBadge[order.status])}>
              {statusLabel(order.status)}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {t('admin.orders.updatedAt', {
                when: new Date(order.updatedAt).toLocaleString(),
                defaultValue: `Updated ${new Date(order.updatedAt).toLocaleString()}`,
              })}
            </span>
          </div>
        }
      />

      <Card className="p-6 mb-6">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h2 className="font-serif text-lg font-medium">
            {t('admin.orders.timeline', { defaultValue: 'Timeline' })}
          </h2>
          {!isCancelled && order.status !== 'delivered' && (
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive"
              disabled={updating}
              onClick={() => setPendingStatus('cancelled')}
            >
              <X size={16} />
              {t('admin.orders.cancelOrder', { defaultValue: 'Cancel order' })}
            </Button>
          )}
        </div>

        {isCancelled ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {t('admin.orders.cancelledNotice', {
              defaultValue:
                'This order was cancelled. Move it back to a previous status only if the cancellation was a mistake.',
            })}
            <div className="mt-3 flex flex-wrap gap-2">
              {PIPELINE.map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant="outline"
                  disabled={updating}
                  onClick={() => setPendingStatus(s)}
                >
                  {statusLabel(s)}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <ol className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {PIPELINE.map((s, idx) => {
              const isComplete = idx < currentIndex;
              const isCurrent = idx === currentIndex;
              const canAdvance = idx === currentIndex + 1;
              return (
                <li key={s}>
                  <button
                    type="button"
                    disabled={updating || (!canAdvance && !isComplete && !isCurrent)}
                    onClick={() => {
                      if (s === order.status) return;
                      setPendingStatus(s);
                    }}
                    className={cn(
                      'group relative w-full text-left rounded-md border p-3 transition-colors',
                      'disabled:cursor-not-allowed',
                      isCurrent && 'border-gold bg-gold/5 ring-1 ring-gold/40',
                      isComplete && 'border-purpose-balance/40 bg-purpose-balance/5',
                      !isCurrent && !isComplete && canAdvance && 'border-border hover:border-gold hover:bg-gold/5',
                      !isCurrent && !isComplete && !canAdvance && 'border-border opacity-60',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'flex h-6 w-6 items-center justify-center rounded-full border text-xs font-medium tabular-nums',
                          isComplete && 'border-purpose-balance bg-purpose-balance text-white',
                          isCurrent && 'border-gold bg-gold text-white',
                          !isCurrent && !isComplete && 'border-border text-muted-foreground',
                        )}
                      >
                        {isComplete ? <Check size={12} /> : idx + 1}
                      </span>
                      <span className="text-sm font-medium capitalize">{statusLabel(s)}</span>
                    </div>
                    {canAdvance && !updating && (
                      <span className="mt-1 block text-xs text-muted-foreground group-hover:text-gold">
                        {t('admin.orders.advanceTo', {
                          status: statusLabel(s),
                          defaultValue: `Mark as ${statusLabel(s)}`,
                        })}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-6 min-w-0">
          <Card className="p-6">
            <h2 className="font-serif text-lg font-medium mb-4">
              {t('admin.orders.itemsHeading', { defaultValue: 'Items' })}
            </h2>
            <div className="space-y-3">
              {order.items.map((item) => {
                const busy = itemPending === item.id;
                return (
                  <div key={item.id} className="flex gap-3 sm:gap-4 items-center">
                    <div className="h-14 w-14 rounded bg-muted overflow-hidden shrink-0">
                      {item.productImage && (
                        <img src={item.productImage} alt="" className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.productName}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.size && `Size ${item.size} · `}
                        {formatMoneyGEL(Number(item.unitPrice))}{' '}
                        {t('admin.orders.eachSuffix', { defaultValue: 'each' })}
                      </p>
                    </div>
                    {isEditable ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="h-7 w-7"
                          disabled={busy || item.quantity <= 1}
                          onClick={() => onChangeQty(item.id, item.quantity - 1)}
                          aria-label={t('admin.orders.decreaseQty', { defaultValue: 'Decrease quantity' })}
                        >
                          <Minus size={12} />
                        </Button>
                        <span className="w-8 text-center text-sm tabular-nums">{item.quantity}</span>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="h-7 w-7"
                          disabled={busy || item.quantity >= 99}
                          onClick={() => onChangeQty(item.id, item.quantity + 1)}
                          aria-label={t('admin.orders.increaseQty', { defaultValue: 'Increase quantity' })}
                        >
                          <Plus size={12} />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground shrink-0">
                        {t('admin.orders.qtyAbbr', { count: item.quantity, defaultValue: `Qty ${item.quantity}` })}
                      </span>
                    )}
                    <span className="font-medium tabular-nums shrink-0 w-20 text-right">
                      {formatMoneyGEL(Number(item.lineTotal))}
                    </span>
                    {isEditable && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                        disabled={busy || order.items.length <= 1}
                        onClick={() => setConfirmRemove({ id: item.id, name: item.productName })}
                        aria-label={t('admin.orders.removeItem', { defaultValue: 'Remove item' })}
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
            {isEditable && (
              <div className="mt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAddOpen(true)}
                >
                  <Plus size={14} />
                  {t('admin.orders.addItem', { defaultValue: 'Add item' })}
                </Button>
              </div>
            )}
            <Separator className="my-4" />
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t('admin.orders.subtotal', { defaultValue: 'Subtotal' })}
                </span>
                <span className="font-medium tabular-nums">
                  {formatMoneyGEL(Number(order.subtotal))}
                </span>
              </div>
              {hasDiscount && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t('admin.orders.discountLine', {
                      code: order.discountCode,
                      defaultValue: `Discount (${order.discountCode})`,
                    })}
                  </span>
                  <span className="font-medium tabular-nums text-purpose-balance">
                    −{formatMoneyGEL(Number(order.discountAmount))}
                  </span>
                </div>
              )}
            </div>
            <div className="flex justify-between items-center mt-3">
              <span className="font-medium">
                {t('admin.orders.totalLabel', { defaultValue: 'Total' })}
              </span>
              <span className="text-xl font-semibold tabular-nums">
                {formatMoneyGEL(Number(order.total))}
              </span>
            </div>
          </Card>

          {order.notes && (
            <Card className="p-6">
              <h2 className="font-serif text-lg font-medium mb-2">
                {t('admin.orders.customerNotes', { defaultValue: 'Customer notes' })}
              </h2>
              <p className="text-sm whitespace-pre-wrap">{order.notes}</p>
            </Card>
          )}

          <Card className="p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-serif text-lg font-medium">
                {t('admin.orders.adminNotes', { defaultValue: 'Internal notes' })}
              </h2>
              {notesDirty && (
                <span className="text-xs text-muted-foreground">
                  {t('admin.orders.unsaved', { defaultValue: 'Unsaved changes' })}
                </span>
              )}
            </div>
            <Textarea
              rows={4}
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder={t('admin.orders.adminNotesPlaceholder', {
                defaultValue: 'Visible to staff only — fulfillment notes, call logs, etc.',
              })}
            />
            <div className="mt-3 flex justify-end gap-2">
              {notesDirty && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setAdminNotes(order.adminNotes ?? '')}
                  disabled={savingNotes}
                >
                  {t('admin.common.cancel', { defaultValue: 'Cancel' })}
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                onClick={onSaveNotes}
                disabled={savingNotes || !notesDirty}
              >
                {savingNotes
                  ? t('admin.common.saving', { defaultValue: 'Saving…' })
                  : t('admin.orders.saveNotes', { defaultValue: 'Save notes' })}
              </Button>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-lg font-medium">
                {t('admin.orders.shipping', { defaultValue: 'Shipping' })}
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onCopyAddress}
                className="-mr-2"
              >
                {addressCopied ? <Check size={14} /> : <Copy size={14} />}
                {addressCopied
                  ? t('admin.orders.copied', { defaultValue: 'Copied' })
                  : t('admin.orders.copyAddress', { defaultValue: 'Copy' })}
              </Button>
            </div>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                  {t('admin.orders.recipient', { defaultValue: 'Recipient' })}
                </dt>
                <dd>{order.fullName}</dd>
                {order.customerOrderCount === 1 && (
                  <dd className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <User size={11} />
                    {t('admin.orders.firstOrder', { defaultValue: 'First-time customer' })}
                  </dd>
                )}
                {!!order.customerOrderCount && order.customerOrderCount > 1 && (
                  <dd className="mt-1">
                    <Link
                      to={`/admin/orders?userId=${order.userId}&customerEmail=${encodeURIComponent(order.email)}`}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-gold"
                    >
                      <User size={11} />
                      {t('admin.orders.viewAllOrders', {
                        count: order.customerOrderCount,
                        defaultValue: `View all ${order.customerOrderCount} orders`,
                      })}
                      <span aria-hidden>→</span>
                    </Link>
                  </dd>
                )}
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                  {t('admin.orders.email', { defaultValue: 'Email' })}
                </dt>
                <dd>
                  <a
                    href={`mailto:${order.email}`}
                    className="inline-flex items-center gap-1.5 text-foreground hover:text-gold break-all"
                  >
                    <Mail size={12} className="shrink-0" />
                    {order.email}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                  {t('admin.orders.phone', { defaultValue: 'Phone' })}
                </dt>
                <dd>
                  <a
                    href={`tel:${order.phone.replace(/\s+/g, '')}`}
                    className="inline-flex items-center gap-1.5 text-foreground hover:text-gold"
                  >
                    <Phone size={12} className="shrink-0" />
                    {order.phone}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                  {t('admin.orders.address', { defaultValue: 'Address' })}
                </dt>
                <dd>{order.address}</dd>
                <dd>{order.city}</dd>
              </div>
            </dl>
          </Card>

          <ActivityFeed targetType="order" targetId={order.id} reloadKey={order.updatedAt} />
        </div>
      </div>

      <AlertDialog open={!!pendingStatus} onOpenChange={(o) => !o && setPendingStatus(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingStatus === 'cancelled'
                ? t('admin.orders.confirmCancelTitle', { defaultValue: 'Cancel this order?' })
                : t('admin.orders.confirmStatusTitle', {
                    status: pendingStatus ? statusLabel(pendingStatus) : '',
                    defaultValue: `Mark as ${pendingStatus ? statusLabel(pendingStatus) : ''}?`,
                  })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingStatus === 'cancelled'
                ? t('admin.orders.confirmCancelDescription', {
                    defaultValue:
                      "The customer won't be charged or shipped to. You can revert this from the timeline if needed.",
                  })
                : t('admin.orders.confirmStatusDescription', {
                    defaultValue:
                      'The customer sees this status in their account. Make sure the work is actually done.',
                  })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updating}>
              {t('admin.common.cancel', { defaultValue: 'Cancel' })}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={updating}
              onClick={() => pendingStatus && applyStatus(pendingStatus)}
              className={cn(
                pendingStatus === 'cancelled' &&
                  'bg-destructive text-destructive-foreground hover:bg-destructive/90',
              )}
            >
              {updating
                ? t('admin.common.saving', { defaultValue: 'Saving…' })
                : t('admin.common.confirm', { defaultValue: 'Confirm' })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmRemove} onOpenChange={(o) => !o && setConfirmRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('admin.orders.removeItemTitle', {
                name: confirmRemove?.name ?? '',
                defaultValue: `Remove ${confirmRemove?.name ?? 'item'}?`,
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.orders.removeItemDescription', {
                defaultValue: 'Subtotal and total will be recomputed. The discount on this order is preserved.',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={itemPending !== null}>
              {t('admin.common.cancel', { defaultValue: 'Cancel' })}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={itemPending !== null}
              onClick={() => confirmRemove && onRemoveItem(confirmRemove.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {itemPending !== null
                ? t('admin.common.deleting', { defaultValue: 'Deleting…' })
                : t('admin.common.delete', { defaultValue: 'Delete' })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ProductPickerDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onPick={onPickProduct}
        submitting={addPending}
      />
    </div>
  );
};

export default AdminOrderDetailPage;
