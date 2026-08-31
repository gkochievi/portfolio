import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import PageHeader from '@/components/admin/PageHeader';
import FormActionsBar from '@/components/admin/FormActionsBar';
import ProductPickerDialog from '@/components/admin/ProductPickerDialog';
import { adminOrdersApi } from '@/lib/orders-api';
import { adminUsers, type AdminProduct, type AdminUser } from '@/lib/admin-api';
import { ApiError } from '@/lib/api';
import { formatMoneyGEL } from '@/lib/money';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';

const schema = z.object({
  fullName: z.string().min(1, 'Required').max(200),
  email: z.string().email(),
  phone: z.string().min(1, 'Required').max(50),
  city: z.string().min(1, 'Required').max(100),
  address: z.string().min(1, 'Required').max(255),
  notes: z.string(),
  discountCode: z.string(),
});
type Values = z.infer<typeof schema>;

interface DraftItem {
  productId: number;
  productName: string;
  productImage: string;
  size: string;
  quantity: number;
  unitPrice: string;
}

const OrderCreatePage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [items, setItems] = useState<DraftItem[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [emailQuery, setEmailQuery] = useState('');
  const [debouncedEmail, setDebouncedEmail] = useState('');
  const [suggestions, setSuggestions] = useState<AdminUser[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const closeSuggestionsTimerRef = useRef<number | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      city: '',
      address: '',
      notes: '',
      discountCode: '',
    },
  });

  useEffect(() => {
    const tid = setTimeout(() => setDebouncedEmail(emailQuery), 300);
    return () => clearTimeout(tid);
  }, [emailQuery]);

  useEffect(() => {
    const needle = debouncedEmail.trim();
    if (needle.length < 2) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    adminUsers
      .list({ q: needle, role: 'customer', pageSize: 8 })
      .then((res) => {
        if (!cancelled) setSuggestions(res.items);
      })
      .catch(() => {
        if (!cancelled) setSuggestions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedEmail]);

  useEffect(() => {
    return () => {
      if (closeSuggestionsTimerRef.current) {
        window.clearTimeout(closeSuggestionsTimerRef.current);
      }
    };
  }, []);

  const onPickCustomer = (user: AdminUser) => {
    form.setValue('email', user.email, { shouldValidate: true });
    const fullName = `${user.firstName} ${user.lastName}`.trim();
    if (fullName) form.setValue('fullName', fullName, { shouldValidate: true });
    setEmailQuery(user.email);
    setSuggestOpen(false);
  };

  const subtotalPreview = useMemo(
    () =>
      items.reduce(
        (sum, line) => sum + Number(line.unitPrice) * line.quantity,
        0,
      ),
    [items],
  );

  const onAddProduct = (product: AdminProduct, size: string, quantity: number) => {
    setItems((prev) => [
      ...prev,
      {
        productId: product.id,
        productName: product.name,
        productImage: product.image,
        size,
        quantity,
        unitPrice: String(product.price),
      },
    ]);
    setPickerOpen(false);
  };

  const onChangeQty = (index: number, nextQty: number) => {
    if (nextQty < 1 || nextQty > 99) return;
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, quantity: nextQty } : it)));
  };

  const onRemove = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (values: Values) => {
    if (items.length === 0) {
      toast({
        title: t('admin.orders.needAtLeastOneItem', { defaultValue: 'Add at least one item.' }),
        variant: 'destructive',
      });
      return;
    }
    setSubmitting(true);
    try {
      const order = await adminOrdersApi.create({
        items: items.map((it) => ({
          productId: it.productId,
          size: it.size,
          quantity: it.quantity,
        })),
        fullName: values.fullName,
        email: values.email,
        phone: values.phone,
        city: values.city,
        address: values.address,
        notes: values.notes,
        discountCode: values.discountCode.trim(),
      });
      toast({ title: t('admin.orders.orderCreated', { defaultValue: 'Order created' }) });
      navigate(`/admin/orders/${order.id}`, { replace: true });
    } catch (err) {
      toast({
        title: t('admin.orders.orderCreateFailed', { defaultValue: "Couldn't create order" }),
        description: err instanceof ApiError ? err.detail : undefined,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={t('admin.orders.newOrderTitle', { defaultValue: 'New order' })}
        description={t('admin.orders.newOrderDescription', {
          defaultValue:
            'Manually create an order — phone orders, in-person sales. The customer is matched by email; a stub account is created if none exists.',
        })}
        back={{
          to: '/admin/orders',
          label: t('admin.orders.backToOrders', { defaultValue: 'Back to orders' }),
        }}
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-3xl space-y-6">
          <Card className="p-6 space-y-4">
            <h2 className="font-serif text-lg font-medium">
              {t('admin.orders.customerSection', { defaultValue: 'Customer' })}
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('admin.orders.fullName', { defaultValue: 'Full name' })}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="relative">
                    <FormLabel>{t('admin.orders.email', { defaultValue: 'Email' })}</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="off"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          setEmailQuery(e.target.value);
                          setSuggestOpen(true);
                        }}
                        onFocus={() => setSuggestOpen(true)}
                        onBlur={() => {
                          // Delay so click on a suggestion lands before close
                          closeSuggestionsTimerRef.current = window.setTimeout(
                            () => setSuggestOpen(false),
                            120,
                          );
                        }}
                      />
                    </FormControl>
                    {suggestOpen && suggestions.length > 0 && (
                      <div className="absolute z-20 left-0 right-0 top-full mt-1 rounded-md border bg-popover shadow-md overflow-hidden">
                        <ul className="max-h-56 overflow-y-auto divide-y">
                          {suggestions.map((u) => (
                            <li key={u.id}>
                              <button
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  onPickCustomer(u);
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-muted/40"
                              >
                                <p className="text-sm font-medium truncate">{u.email}</p>
                                {(u.firstName || u.lastName) && (
                                  <p className="text-xs text-muted-foreground truncate">
                                    {`${u.firstName} ${u.lastName}`.trim()}
                                  </p>
                                )}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {t('admin.orders.customerHint', {
                        defaultValue: 'Type to search existing customers, or enter a new email.',
                      })}
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('admin.orders.phone', { defaultValue: 'Phone' })}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('admin.orders.cityLabel', { defaultValue: 'City' })}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.orders.address', { defaultValue: 'Address' })}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.orders.customerNotes', { defaultValue: 'Customer notes' })}</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Card>

          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-lg font-medium">
                {t('admin.orders.itemsHeading', { defaultValue: 'Items' })}
              </h2>
              <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
                <Plus size={14} />
                {t('admin.orders.addItem', { defaultValue: 'Add item' })}
              </Button>
            </div>
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('admin.orders.noItemsYet', {
                  defaultValue: 'No items yet. Click "Add item" to pick from the catalog.',
                })}
              </p>
            ) : (
              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div key={`${item.productId}-${idx}`} className="flex gap-3 items-center">
                    <div className="h-12 w-12 rounded bg-muted overflow-hidden shrink-0">
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
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        disabled={item.quantity <= 1}
                        onClick={() => onChangeQty(idx, item.quantity - 1)}
                      >
                        <Minus size={12} />
                      </Button>
                      <span className="w-8 text-center text-sm tabular-nums">{item.quantity}</span>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        disabled={item.quantity >= 99}
                        onClick={() => onChangeQty(idx, item.quantity + 1)}
                      >
                        <Plus size={12} />
                      </Button>
                    </div>
                    <span className="font-medium tabular-nums shrink-0 w-20 text-right">
                      {formatMoneyGEL(Number(item.unitPrice) * item.quantity)}
                    </span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => onRemove(idx)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
                <div className="pt-3 border-t flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t('admin.orders.subtotal', { defaultValue: 'Subtotal' })}
                  </span>
                  <span className="font-medium tabular-nums">
                    {formatMoneyGEL(subtotalPreview)}
                  </span>
                </div>
              </div>
            )}
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="font-serif text-lg font-medium">
              {t('admin.orders.discountSection', { defaultValue: 'Discount (optional)' })}
            </h2>
            <FormField
              control={form.control}
              name="discountCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.orders.discountCodeLabel', { defaultValue: 'Discount code' })}</FormLabel>
                  <FormControl>
                    <Input className="font-mono" placeholder="WELCOME10" {...field} />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    {t('admin.orders.discountHint', {
                      defaultValue:
                        'Validated and applied at submit. Leave blank for no discount.',
                    })}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Card>

          <FormActionsBar className={cn(submitting && 'opacity-90')}>
            <Button type="submit" disabled={submitting || items.length === 0}>
              {submitting
                ? t('admin.common.saving', { defaultValue: 'Saving…' })
                : t('admin.orders.createOrder', { defaultValue: 'Create order' })}
            </Button>
          </FormActionsBar>
        </form>
      </Form>

      <ProductPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onPick={onAddProduct}
      />
    </div>
  );
};

export default OrderCreatePage;
