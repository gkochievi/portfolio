import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
import { adminZodiac, type AdminZodiac } from '@/lib/admin-api';
import { ApiError } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';

const schema = z.object({
  name: z.string().min(1, 'Required').max(64),
  nameKa: z.string().max(64),
  dates: z.string().min(1, 'Required').max(64),
  datesKa: z.string().max(64),
  element: z.string().min(1, 'Required').max(32),
  elementKa: z.string().max(32),
  description: z.string(),
  descriptionKa: z.string(),
});
type Values = z.infer<typeof schema>;

const ZodiacEditPage = () => {
  const { sign } = useParams<{ sign: string }>();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [data, setData] = useState<AdminZodiac | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '', nameKa: '', dates: '', datesKa: '',
      element: '', elementKa: '', description: '', descriptionKa: '',
    },
  });

  useEffect(() => {
    if (!sign) return;
    let cancelled = false;
    setLoading(true);
    adminZodiac
      .get(sign)
      .then((z) => {
        if (cancelled) return;
        setData(z);
        form.reset({
          name: z.name, nameKa: z.nameKa,
          dates: z.dates, datesKa: z.datesKa,
          element: z.element, elementKa: z.elementKa,
          description: z.description, descriptionKa: z.descriptionKa,
        });
      })
      .catch((err) => {
        toast({
          title: t('admin.zodiac.loadFailed', { defaultValue: 'Failed to load' }),
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
  }, [sign, form, toast, t]);

  const onSubmit = async (values: Values) => {
    if (!sign) return;
    setSubmitting(true);
    try {
      const updated = await adminZodiac.update(sign, values);
      setData(updated);
      queryClient.invalidateQueries({ queryKey: ['zodiac'] });
      toast({ title: t('admin.common.saveChanges', { defaultValue: 'Saved' }) });
    } catch (err) {
      toast({
        title: t('admin.users.saveFailed', { defaultValue: 'Failed to save' }),
        description: err instanceof ApiError ? err.detail : undefined,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="text-muted-foreground text-sm">{t('admin.common.loading', { defaultValue: 'Loading…' })}</div>;
  if (!data) return null;

  return (
    <div>
      <PageHeader
        title={`${data.symbol} ${data.name}`}
        description={t('admin.zodiac.editTitle', { defaultValue: 'Edit zodiac' })}
        back={{ to: '/admin/zodiac', label: t('admin.zodiac.backTo', { defaultValue: 'Back to zodiac' }) }}
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-3xl space-y-6">
          <Card className="p-6 space-y-4">
            <h2 className="font-serif text-lg font-medium">{t('admin.products.basics', { defaultValue: 'Basics' })}</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('admin.products.nameEn', { defaultValue: 'Name (English)' })}</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nameKa"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('admin.products.nameKa', { defaultValue: 'Name (Georgian)' })}</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="dates"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dates (EN)</FormLabel>
                    <FormControl><Input placeholder="Mar 21 - Apr 19" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="datesKa"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dates (KA)</FormLabel>
                    <FormControl><Input placeholder="21 მარ - 19 აპრ" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="element"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Element (EN)</FormLabel>
                    <FormControl><Input placeholder="Fire" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="elementKa"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Element (KA)</FormLabel>
                    <FormControl><Input placeholder="ცეცხლის" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('admin.products.descriptionEn', { defaultValue: 'Description (English)' })}</FormLabel>
                    <FormControl><Textarea rows={4} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="descriptionKa"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('admin.products.descriptionKa', { defaultValue: 'Description (Georgian)' })}</FormLabel>
                    <FormControl><Textarea rows={4} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </Card>

          <Card className="p-6 space-y-3">
            <h2 className="font-serif text-lg font-medium">{t('admin.products.stones', { defaultValue: 'Stones' })}</h2>
            <p className="text-xs text-muted-foreground">
              {t('admin.zodiac.stonesHint', {
                defaultValue: "Stones are not editable here — they're a global enum used by quiz/recommendation logic.",
              })}
            </p>
            <div className="flex flex-wrap gap-2">
              {data.stones.map((s) => (
                <Badge key={s} variant="outline">{s}</Badge>
              ))}
            </div>
          </Card>

          <FormActionsBar>
            <Button type="submit" disabled={submitting}>
              {submitting ? t('admin.common.saving', { defaultValue: 'Saving…' }) : t('admin.common.saveChanges', { defaultValue: 'Save changes' })}
            </Button>
          </FormActionsBar>
        </form>
      </Form>
    </div>
  );
};

export default ZodiacEditPage;
