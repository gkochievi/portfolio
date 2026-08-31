import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { adminProducts, type AdminProduct } from '@/lib/admin-api';
import { formatMoneyGEL } from '@/lib/money';

/**
 * Reusable product picker. Two-step UX inside one dialog:
 *   1. Search a product by name → list of catalog rows.
 *   2. Click a row → preview + size + quantity → confirm.
 *
 * `onPick` is awaited; errors are the caller's responsibility (the dialog
 * stays open while pending so the caller can surface a toast and let the
 * user retry without losing the picked product).
 */
const ProductPickerDialog = ({
  open,
  onOpenChange,
  onPick,
  submitting = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (product: AdminProduct, size: string, quantity: number) => Promise<void> | void;
  submitting?: boolean;
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [options, setOptions] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<AdminProduct | null>(null);
  const [size, setSize] = useState('');
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!open) return;
    const tid = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(tid);
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    adminProducts
      .list({ q: debouncedQuery, pageSize: 20 })
      .then((res) => {
        if (!cancelled) setOptions(res.items);
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, debouncedQuery]);

  const reset = () => {
    setPicked(null);
    setSize('');
    setQuantity(1);
    setQuery('');
    setDebouncedQuery('');
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    if (!picked || submitting) return;
    await onPick(picked, size.trim(), quantity);
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {t('admin.orders.addItemTitle', { defaultValue: 'Add an item' })}
          </DialogTitle>
          <DialogDescription>
            {t('admin.orders.addItemDescription', {
              defaultValue:
                'Pick a product, set size and quantity. The line is priced from the current catalog.',
            })}
          </DialogDescription>
        </DialogHeader>

        {picked ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-md border p-3">
              <div className="h-12 w-12 rounded bg-muted overflow-hidden shrink-0">
                {picked.image && (
                  <img src={picked.image} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{picked.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatMoneyGEL(Number(picked.price))}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setPicked(null)}
                disabled={submitting}
              >
                {t('admin.orders.changeProduct', { defaultValue: 'Change' })}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">
                  {t('admin.orders.sizeLabel', { defaultValue: 'Size (optional)' })}
                </label>
                <Input
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  placeholder="M"
                  disabled={submitting}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">
                  {t('admin.orders.quantityLabel', { defaultValue: 'Quantity' })}
                </label>
                <Input
                  type="number"
                  min={1}
                  max={99}
                  value={quantity}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isFinite(n)) setQuantity(Math.max(1, Math.min(99, Math.trunc(n))));
                  }}
                  disabled={submitting}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('admin.orders.productSearchPlaceholder', { defaultValue: 'Search products by name…' })}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>
            <div className="max-h-72 overflow-y-auto rounded-md border divide-y">
              {loading && options.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground text-center">
                  {t('admin.common.loading', { defaultValue: 'Loading…' })}
                </p>
              ) : options.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground text-center">
                  {t('admin.orders.noProductsFound', { defaultValue: 'No products match.' })}
                </p>
              ) : (
                options.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPicked(p)}
                    className="w-full flex items-center gap-3 p-2.5 text-left hover:bg-muted/40"
                  >
                    <div className="h-10 w-10 rounded bg-muted overflow-hidden shrink-0">
                      {p.image && <img src={p.image} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{p.gender}</p>
                    </div>
                    <span className="text-sm tabular-nums shrink-0">
                      {formatMoneyGEL(Number(p.price))}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} disabled={submitting}>
            {t('admin.common.cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!picked || submitting}>
            {submitting
              ? t('admin.common.saving', { defaultValue: 'Saving…' })
              : t('admin.orders.addToOrder', { defaultValue: 'Add to order' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProductPickerDialog;
