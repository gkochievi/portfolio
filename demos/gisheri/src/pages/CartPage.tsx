import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShoppingCart, Trash2, ArrowLeft, Minus, Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ordersApi } from '@/lib/orders-api';
import { discountsApi, type DiscountValidateResult } from '@/lib/discounts-api';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/context/auth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Seo from '@/components/Seo';
import { useTranslation } from 'react-i18next';
import { formatMoneyGEL } from '@/lib/money';
import { useCart } from '@/context/cart';
import { tProductName } from '@/lib/catalog-i18n';
import { useToast } from '@/components/ui/use-toast';

const SIZES = ['S', 'M', 'L', 'XL'] as const;

const CartPage = () => {
  const { t } = useTranslation();
  const { items, subtotal, totalItems, updateQuantity, removeItem, updateSize, clearCart } = useCart();
  const { toast } = useToast();
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  // Discount state
  const [discountInput, setDiscountInput] = useState('');
  const [discount, setDiscount] = useState<DiscountValidateResult | null>(null);
  const [discountChecking, setDiscountChecking] = useState(false);
  const [discountError, setDiscountError] = useState<string | null>(null);

  const discountAmount = discount ? Number(discount.discountAmount) : 0;
  const total = Math.max(0, subtotal - discountAmount);

  const applyDiscount = async () => {
    const code = discountInput.trim();
    if (!code) return;
    setDiscountChecking(true);
    setDiscountError(null);
    try {
      const result = await discountsApi.validate(code, subtotal.toFixed(2));
      setDiscount(result);
    } catch (err) {
      setDiscount(null);
      setDiscountError(
        err instanceof ApiError ? err.detail : 'Could not validate discount.',
      );
    } finally {
      setDiscountChecking(false);
    }
  };

  const removeDiscount = () => {
    setDiscount(null);
    setDiscountInput('');
    setDiscountError(null);
  };
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const url = typeof window !== 'undefined' ? window.location.href : '';

  const checkoutSchema = z.object({
    fullName: z.string().min(1, t('cartPage.required', { defaultValue: 'Required' })),
    email: z
      .string()
      .min(1, t('cartPage.required', { defaultValue: 'Required' }))
      .email(t('cartPage.invalidEmail', { defaultValue: 'Invalid email' })),
    phone: z.string().min(1, t('cartPage.required', { defaultValue: 'Required' })),
    city: z.string().min(1, t('cartPage.required', { defaultValue: 'Required' })),
    address: z.string().min(1, t('cartPage.required', { defaultValue: 'Required' })),
    notes: z.string().optional(),
  });

  type CheckoutFormValues = z.infer<typeof checkoutSchema>;

  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      fullName: user ? `${user.firstName} ${user.lastName}`.trim() : '',
      email: user?.email ?? '',
      phone: '',
      city: '',
      address: '',
      notes: '',
    },
  });

  const onSubmit = async (values: CheckoutFormValues) => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: '/cart' } });
      return;
    }
    setSubmitting(true);
    try {
      const order = await ordersApi.create({
        items: items.map((item) => ({
          productId: Number(item.product.id),
          size: item.size,
          quantity: item.quantity,
        })),
        fullName: values.fullName,
        email: values.email,
        phone: values.phone,
        city: values.city,
        address: values.address,
        notes: values.notes ?? '',
        discountCode: discount?.code ?? '',
      });
      clearCart();
      toast({
        title: t('cartPage.checkoutSubmitted', { defaultValue: 'Order placed' }),
        description: t('cartPage.orderNumber', { id: order.id, defaultValue: `Order #${order.id}` }),
      });
      navigate(`/orders/${order.id}`, { replace: true });
    } catch (err) {
      toast({
        title: t('cartPage.checkoutFailed', { defaultValue: 'Could not place order' }),
        description: err instanceof ApiError ? err.detail : undefined,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title={t('seo.pages.cart.title')}
        description={t('seo.pages.cart.description')}
        robots="noindex,nofollow"
        type="WebPage"
        jsonLd={url ? {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: t('seo.pages.cart.title'),
          description: t('seo.pages.cart.description'),
          url,
          isPartOf: origin ? { '@type': 'WebSite', name: t('seo.siteName', { defaultValue: 'Gisheri' }), url: origin } : undefined,
        } : undefined}
      />
      <Header />
      <main className="pt-20">
        <section className="container-main section-padding">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
              <h1 className="heading-hero">{t('cartPage.title')}</h1>
              <Link to="/shop">
                <Button variant="ghost">
                  <ArrowLeft size={16} />
                  {t('cartPage.continueShopping')}
                </Button>
              </Link>
            </div>

            {items.length === 0 ? (
              <Card className="text-center p-12">
                <ShoppingCart size={64} className="mx-auto text-muted-foreground mb-4" />
                <h2 className="text-xl font-serif font-medium mb-2">{t('cartPage.emptyTitle')}</h2>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  {t('cartPage.emptyDescription')}
                </p>
                <Link to="/shop">
                  <Button size="lg">{t('cartPage.continueShopping')}</Button>
                </Link>
              </Card>
            ) : (
              <div className="grid lg:grid-cols-3 gap-8">
                {/* Cart Items */}
                <div className="lg:col-span-2 space-y-4">
                  {items.map((item) => {
                    const productName = tProductName(t, item.product);
                    const itemId = `${item.product.id}:${item.size}`;
                    const hasDiscount = !!item.product.originalPrice;
                    const dec = () => updateQuantity(itemId, Math.max(1, item.quantity - 1));
                    const inc = () => updateQuantity(itemId, Math.min(99, item.quantity + 1));

                    return (
                      <motion.div
                        key={itemId}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                      >
                        <Card className="p-4 hover:border-border/80 transition-colors">
                          <div className="flex flex-col sm:flex-row gap-4">
                            <Link to={`/product/${item.product.id}`} className="shrink-0">
                              <img
                                src={item.product.image}
                                alt={productName}
                                className="w-full sm:w-24 h-32 sm:h-24 object-cover rounded-xl hover:opacity-90 transition-opacity"
                              />
                            </Link>

                            <div className="flex-1 min-w-0">
                              <Link to={`/product/${item.product.id}`}>
                                <h3 className="font-serif text-lg font-medium mb-1 hover:text-primary transition-colors line-clamp-2">
                                  {productName}
                                </h3>
                              </Link>

                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-sm font-medium">{formatMoneyGEL(item.product.price)}</span>
                                {hasDiscount && (
                                  <span className="text-xs text-muted-foreground line-through">
                                    {formatMoneyGEL(item.product.originalPrice!)}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                                <span>{t('productPage.sizeLabel', { defaultValue: 'Size' })}:</span>
                                <Select value={item.size} onValueChange={(value) => updateSize(itemId, value)}>
                                  <SelectTrigger className="w-20 h-8 text-sm">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {SIZES.map((size) => (
                                      <SelectItem key={size} value={size}>{size}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="flex items-center justify-between">
                                <div className="inline-flex items-center rounded-md border border-border">
                                  <button
                                    type="button"
                                    onClick={dec}
                                    disabled={item.quantity <= 1}
                                    className="px-2 py-1.5 text-muted-foreground hover:text-foreground disabled:opacity-40"
                                    aria-label="Decrease quantity"
                                  >
                                    <Minus size={14} />
                                  </button>
                                  <span className="px-3 min-w-8 text-center text-sm font-medium">{item.quantity}</span>
                                  <button
                                    type="button"
                                    onClick={inc}
                                    disabled={item.quantity >= 99}
                                    className="px-2 py-1.5 text-muted-foreground hover:text-foreground disabled:opacity-40"
                                    aria-label="Increase quantity"
                                  >
                                    <Plus size={14} />
                                  </button>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeItem(itemId)}
                                  aria-label={t('cartPage.remove', { defaultValue: 'Remove' })}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 size={16} />
                                </Button>
                              </div>
                            </div>

                            <div className="sm:text-right sm:pl-4 sm:border-l sm:border-border sm:ml-auto flex items-center sm:items-start">
                              <span className="text-xs text-muted-foreground block mb-1 sm:hidden mr-2">
                                {t('cartPage.total')}:
                              </span>
                              <span className="text-lg font-semibold">
                                {formatMoneyGEL(item.product.price * item.quantity)}
                              </span>
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Sidebar */}
                <div className="lg:sticky lg:top-24 space-y-6 h-fit">
                  <Card className="bg-secondary/30 p-6">
                    <h3 className="font-serif text-lg font-medium mb-4">{t('cartPage.orderSummary')}</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          {t('cartPage.subtotal')} ({totalItems} {t('shopPage.products', { defaultValue: 'items' })})
                        </span>
                        <span>{formatMoneyGEL(subtotal)}</span>
                      </div>
                      {discount && (
                        <div className="flex justify-between text-purpose-luck">
                          <span className="inline-flex items-center gap-2">
                            {t('cartPage.discount', { defaultValue: 'Discount' })}
                            <span className="font-mono text-xs px-1.5 py-0.5 bg-purpose-luck/10 rounded">
                              {discount.code}
                            </span>
                            <button
                              type="button"
                              onClick={removeDiscount}
                              className="text-muted-foreground hover:text-destructive text-xs"
                              aria-label="Remove discount"
                            >
                              ×
                            </button>
                          </span>
                          <span>−{formatMoneyGEL(discountAmount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('cartPage.shipping')}</span>
                        <span className="text-muted-foreground">{t('cartPage.calculatedAtCheckout')}</span>
                      </div>
                    </div>

                    <Separator className="my-4" />

                    {/* Discount input */}
                    {!discount && (
                      <div className="mb-4">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder={t('cartPage.discountCode', { defaultValue: 'Discount code' })}
                            value={discountInput}
                            onChange={(e) => setDiscountInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                applyDiscount();
                              }
                            }}
                            className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm uppercase"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={discountChecking || !discountInput.trim()}
                            onClick={applyDiscount}
                          >
                            {discountChecking
                              ? t('cartPage.applying', { defaultValue: 'Checking…' })
                              : t('cartPage.apply', { defaultValue: 'Apply' })}
                          </Button>
                        </div>
                        {discountError && (
                          <p className="text-xs text-destructive mt-1.5">{discountError}</p>
                        )}
                      </div>
                    )}

                    <div className="flex justify-between items-center">
                      <span className="font-medium">{t('cartPage.total')}</span>
                      <span className="text-xl font-semibold">{formatMoneyGEL(total)}</span>
                    </div>
                  </Card>

                  <Card className="p-6">
                    <h3 className="font-serif text-lg font-medium mb-4">
                      {t('cartPage.checkoutTitle', { defaultValue: 'Checkout Details' })}
                    </h3>

                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                          control={form.control}
                          name="fullName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('cartPage.fullName', { defaultValue: 'Full name' })}</FormLabel>
                              <FormControl>
                                <Input placeholder={t('cartPage.fullNamePlaceholder', { defaultValue: 'John Doe' })} {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="grid sm:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('cartPage.email', { defaultValue: 'Email' })}</FormLabel>
                                <FormControl>
                                  <Input type="email" placeholder="email@example.com" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="phone"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('cartPage.phone', { defaultValue: 'Phone' })}</FormLabel>
                                <FormControl>
                                  <Input placeholder="+995 XXX XXX XXX" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="grid sm:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="city"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('cartPage.city', { defaultValue: 'City' })}</FormLabel>
                                <FormControl>
                                  <Input placeholder={t('cartPage.cityPlaceholder', { defaultValue: 'Tbilisi' })} {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="address"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('cartPage.address', { defaultValue: 'Address' })}</FormLabel>
                                <FormControl>
                                  <Input placeholder={t('cartPage.addressPlaceholder', { defaultValue: 'Street, Building, Apt' })} {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={form.control}
                          name="notes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('cartPage.notes', { defaultValue: 'Order notes' })}</FormLabel>
                              <FormControl>
                                <Textarea
                                  rows={3}
                                  placeholder={t('cartPage.notesPlaceholder', { defaultValue: 'Any special requests or delivery instructions...' })}
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        {!authLoading && !isAuthenticated && (
                          <p className="text-xs text-muted-foreground -mb-1">
                            {t('cartPage.signInRequired', {
                              defaultValue: "You'll be asked to sign in to place this order.",
                            })}
                          </p>
                        )}
                        <Button type="submit" size="lg" className="w-full" disabled={submitting || authLoading}>
                          {submitting
                            ? t('cartPage.placing', { defaultValue: 'Placing order…' })
                            : t('cartPage.proceed')}
                        </Button>
                      </form>
                    </Form>
                  </Card>
                </div>
              </div>
            )}
          </motion.div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default CartPage;
