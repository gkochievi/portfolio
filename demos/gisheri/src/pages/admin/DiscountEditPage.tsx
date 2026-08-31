import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
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
import { adminDiscounts, type DiscountKind } from '@/lib/discounts-api';
import { ApiError } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';

const decimalRe = /^\d+(\.\d{1,2})?$/;

const schema = z.object({
  code: z.string().min(1, 'Required').max(64),
  kind: z.enum(['percent', 'fixed']),
  value: z.string().regex(decimalRe, 'Use a number with up to 2 decimals'),
  minOrderTotal: z.string().regex(decimalRe, 'Use a number with up to 2 decimals'),
  maxUses: z.string().refine((v) => v === '' || /^\d+$/.test(v), 'Whole number'),
  expiresAt: z.string(),
  isActive: z.boolean(),
});
type Values = z.infer<typeof schema>;

const DiscountEditPage = () => {
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'new' || !id;
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(!isNew);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: '',
      kind: 'percent',
      value: '10',
      minOrderTotal: '0',
      maxUses: '',
      expiresAt: '',
      isActive: true,
    },
  });

  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    setLoading(true);
    adminDiscounts
      .get(Number(id))
      .then((d) => {
        if (cancelled) return;
        form.reset({
          code: d.code,
          kind: d.kind,
          value: d.value,
          minOrderTotal: d.minOrderTotal,
          maxUses: d.maxUses === null ? '' : String(d.maxUses),
          expiresAt: d.expiresAt ? d.expiresAt.slice(0, 16) : '',
          isActive: d.isActive,
        });
      })
      .catch((err) => {
        toast({
          title: 'Failed to load discount',
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
  }, [id, isNew, form, toast]);

  const onSubmit = async (values: Values) => {
    setSubmitting(true);
    try {
      const payload = {
        code: values.code.trim(),
        kind: values.kind as DiscountKind,
        value: values.value,
        minOrderTotal: values.minOrderTotal,
        maxUses: values.maxUses === '' ? null : Number(values.maxUses),
        expiresAt: values.expiresAt ? new Date(values.expiresAt).toISOString() : null,
        isActive: values.isActive,
      };
      if (isNew) {
        const created = await adminDiscounts.create(payload);
        toast({ title: 'Discount created' });
        navigate(`/admin/discounts/${created.id}`, { replace: true });
      } else {
        await adminDiscounts.update(Number(id), payload);
        toast({ title: 'Discount saved' });
      }
    } catch (err) {
      toast({
        title: 'Failed to save',
        description: err instanceof ApiError ? err.detail : undefined,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async () => {
    if (isNew) return;
    setDeleting(true);
    try {
      await adminDiscounts.remove(Number(id));
      toast({ title: 'Discount deleted' });
      navigate('/admin/discounts');
    } catch (err) {
      toast({
        title: 'Failed to delete',
        description: err instanceof ApiError ? err.detail : undefined,
        variant: 'destructive',
      });
      setDeleting(false);
    }
  };

  if (loading) return <div className="text-muted-foreground text-sm">{t('admin.common.loading', { defaultValue: 'Loading…' })}</div>;

  return (
    <div>
      <PageHeader
        title={isNew ? t('admin.discounts.newTitle', { defaultValue: 'New discount code' }) : form.watch('code') || t('admin.discounts.editTitle', { defaultValue: 'Edit discount' })}
        back={{ to: '/admin/discounts', label: t('admin.discounts.backToDiscounts', { defaultValue: 'Back to discounts' }) }}
        actions={
          !isNew && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-destructive hover:text-destructive">
                  <Trash2 size={16} />
                  {t('admin.common.delete', { defaultValue: 'Delete' })}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('admin.discounts.deleteTitle', { defaultValue: 'Delete this discount?' })}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('admin.discounts.deleteDescription', {
                      defaultValue: 'Existing orders that already used this code keep their snapshot — only the code itself is removed.',
                    })}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('admin.common.cancel', { defaultValue: 'Cancel' })}</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete} disabled={deleting}>
                    {deleting ? t('admin.common.deleting', { defaultValue: 'Deleting…' }) : t('admin.common.delete', { defaultValue: 'Delete' })}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )
        }
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
          <Card className="p-6 space-y-4">
            <h2 className="font-serif text-lg font-medium">{t('admin.discounts.codeSection', { defaultValue: 'Code' })}</h2>
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Code (case-insensitive)</FormLabel>
                  <FormControl>
                    <Input className="font-mono uppercase" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="font-serif text-lg font-medium">{t('admin.discounts.discountSection', { defaultValue: 'Discount' })}</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="kind"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kind</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percent">Percent off (%)</SelectItem>
                        <SelectItem value="fixed">Fixed amount off (₾)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{form.watch('kind') === 'percent' ? 'Percent' : 'Amount (₾)'}</FormLabel>
                    <FormControl>
                      <Input inputMode="decimal" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="minOrderTotal"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Minimum order total (₾)</FormLabel>
                  <FormControl>
                    <Input inputMode="decimal" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="font-serif text-lg font-medium">{t('admin.discounts.limitsSection', { defaultValue: 'Limits' })}</h2>
            <FormField
              control={form.control}
              name="maxUses"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Max uses (blank = unlimited)</FormLabel>
                  <FormControl>
                    <Input inputMode="numeric" placeholder="—" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="expiresAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expires (blank = never)</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between">
                  <Label>Active</Label>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          </Card>

          <FormActionsBar>
            <Button type="submit" disabled={submitting}>
              {submitting
                ? t('admin.common.saving', { defaultValue: 'Saving…' })
                : isNew
                  ? t('admin.discounts.createDiscount', { defaultValue: 'Create discount' })
                  : t('admin.common.saveChanges', { defaultValue: 'Save changes' })}
            </Button>
          </FormActionsBar>
        </form>
      </Form>
    </div>
  );
};

export default DiscountEditPage;
