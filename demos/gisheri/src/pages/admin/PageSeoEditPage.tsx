import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { adminPageSeo } from '@/lib/site-settings-api';
import { ApiError } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';

const schema = z.object({
  path: z
    .string()
    .min(1, 'Required')
    .max(255)
    .regex(/^\//, 'Path must start with /'),
  titleEn: z.string().max(200),
  titleKa: z.string().max(200),
  descriptionEn: z.string(),
  descriptionKa: z.string(),
  ogImage: z.string().max(255),
  robots: z.string().max(64),
});
type Values = z.infer<typeof schema>;

const PageSeoEditPage = () => {
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'new' || !id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(!isNew);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      path: '',
      titleEn: '', titleKa: '',
      descriptionEn: '', descriptionKa: '',
      ogImage: '', robots: '',
    },
  });

  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    setLoading(true);
    adminPageSeo
      .get(Number(id))
      .then((p) => {
        if (cancelled) return;
        form.reset({
          path: p.path,
          titleEn: p.titleEn,
          titleKa: p.titleKa,
          descriptionEn: p.descriptionEn,
          descriptionKa: p.descriptionKa,
          ogImage: p.ogImage,
          robots: p.robots,
        });
      })
      .catch((err) => {
        toast({
          title: 'Failed to load',
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
      if (isNew) {
        const created = await adminPageSeo.create(values);
        queryClient.invalidateQueries({ queryKey: ['page-seo'] });
        toast({ title: 'Override created' });
        navigate(`/admin/page-seo/${created.id}`, { replace: true });
      } else {
        await adminPageSeo.update(Number(id), values);
        queryClient.invalidateQueries({ queryKey: ['page-seo'] });
        toast({ title: 'Override saved' });
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
      await adminPageSeo.remove(Number(id));
      queryClient.invalidateQueries({ queryKey: ['page-seo'] });
      toast({ title: 'Override deleted' });
      navigate('/admin/page-seo');
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
        title={isNew ? t('admin.pageSeo.newTitle', { defaultValue: 'New SEO override' }) : form.watch('path') || t('admin.pageSeo.editTitle', { defaultValue: 'Edit SEO override' })}
        back={{ to: '/admin/page-seo', label: t('admin.pageSeo.backToOverrides', { defaultValue: 'Back to overrides' }) }}
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
                  <AlertDialogTitle>{t('admin.pageSeo.deleteTitle', { defaultValue: 'Remove this override?' })}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('admin.pageSeo.deleteDescription', {
                      defaultValue: 'The page will fall back to its in-code title/description and the global SEO defaults.',
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
        <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-3xl space-y-6">
          <Card className="p-6 space-y-4">
            <h2 className="font-serif text-lg font-medium">{t('admin.pageSeo.route', { defaultValue: 'Route' })}</h2>
            <FormField
              control={form.control}
              name="path"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Path (exact match)</FormLabel>
                  <FormControl>
                    <Input className="font-mono" placeholder="/shop" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="font-serif text-lg font-medium">{t('admin.pageSeo.titleSection', { defaultValue: 'Title' })}</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="titleEn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title (English)</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="titleKa"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title (Georgian)</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="font-serif text-lg font-medium">{t('admin.pageSeo.descriptionSection', { defaultValue: 'Description' })}</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="descriptionEn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (English)</FormLabel>
                    <FormControl><Textarea rows={3} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="descriptionKa"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Georgian)</FormLabel>
                    <FormControl><Textarea rows={3} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="font-serif text-lg font-medium">{t('admin.pageSeo.otherSection', { defaultValue: 'Other' })}</h2>
            <FormField
              control={form.control}
              name="ogImage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>OG image (URL)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://… or /media/…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="robots"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Robots (blank = use site default)</FormLabel>
                  <FormControl>
                    <Input placeholder="index,follow" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Card>

          <FormActionsBar>
            <Button type="submit" disabled={submitting}>
              {submitting
                ? t('admin.common.saving', { defaultValue: 'Saving…' })
                : isNew
                  ? t('admin.pageSeo.createOverride', { defaultValue: 'Create override' })
                  : t('admin.common.saveChanges', { defaultValue: 'Save changes' })}
            </Button>
          </FormActionsBar>
        </form>
      </Form>
    </div>
  );
};

export default PageSeoEditPage;
