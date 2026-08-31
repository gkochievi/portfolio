import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
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
import ImageUpload from '@/components/admin/ImageUpload';
import { adminCollections } from '@/lib/admin-api';
import { ApiError } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';

const schema = z.object({
  slug: z.string().min(1, 'Required').max(64).regex(/^[a-z0-9-]+$/, 'Lowercase letters, digits, hyphens only'),
  name: z.string().min(1, 'Required').max(128),
  nameKa: z.string().max(128),
  description: z.string(),
  descriptionKa: z.string(),
  image: z.string(),
});
type Values = z.infer<typeof schema>;

const CollectionEditPage = () => {
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'new' || !id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(!isNew);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { slug: '', name: '', nameKa: '', description: '', descriptionKa: '', image: '' },
  });

  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    setLoading(true);
    adminCollections
      .get(Number(id))
      .then((c) => {
        if (cancelled) return;
        form.reset({
          slug: c.slug,
          name: c.name,
          nameKa: c.nameKa,
          description: c.description,
          descriptionKa: c.descriptionKa,
          image: c.image,
        });
      })
      .catch((err) => {
        toast({
          title: t('admin.collections.loadFailed', { defaultValue: 'Failed to load' }),
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
  }, [id, isNew, form, toast, t]);

  const onSubmit = async (values: Values) => {
    setSubmitting(true);
    try {
      if (isNew) {
        const created = await adminCollections.create(values);
        queryClient.invalidateQueries({ queryKey: ['collections'] });
        navigate(`/admin/collections/${created.id}`, { replace: true });
      } else {
        await adminCollections.update(Number(id), values);
        queryClient.invalidateQueries({ queryKey: ['collections'] });
      }
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

  const onDelete = async () => {
    if (isNew) return;
    setDeleting(true);
    try {
      await adminCollections.remove(Number(id));
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      toast({ title: t('admin.common.delete', { defaultValue: 'Deleted' }) });
      navigate('/admin/collections');
    } catch (err) {
      toast({
        title: t('admin.users.saveFailed', { defaultValue: 'Failed' }),
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
        title={isNew ? t('admin.collections.newTitle', { defaultValue: 'New collection' }) : form.watch('name') || t('admin.collections.editTitle', { defaultValue: 'Edit collection' })}
        back={{ to: '/admin/collections', label: t('admin.collections.backTo', { defaultValue: 'Back to collections' }) }}
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
                  <AlertDialogTitle>{t('admin.collections.deleteTitle', { defaultValue: 'Delete this collection?' })}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('admin.collections.deleteDescription', {
                      defaultValue: 'Removes the collection. Products are not deleted.',
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
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid lg:grid-cols-[1fr_320px] gap-6">
          <div className="space-y-6 min-w-0">
            <Card className="p-6 space-y-4">
              <h2 className="font-serif text-lg font-medium">{t('admin.products.basics', { defaultValue: 'Basics' })}</h2>
              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('admin.collections.slug', { defaultValue: 'Slug' })}</FormLabel>
                    <FormControl><Input className="font-mono" placeholder="love" {...field} /></FormControl>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('admin.collections.slugHint', { defaultValue: 'URL fragment, e.g. love → /collections/love' })}
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('admin.products.descriptionEn', { defaultValue: 'Description (English)' })}</FormLabel>
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
                      <FormLabel>{t('admin.products.descriptionKa', { defaultValue: 'Description (Georgian)' })}</FormLabel>
                      <FormControl><Textarea rows={3} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="p-6 space-y-4">
              <h2 className="font-serif text-lg font-medium">{t('admin.products.image', { defaultValue: 'Image' })}</h2>
              <FormField
                control={form.control}
                name="image"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <ImageUpload value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </Card>
            <Button type="submit" disabled={submitting} className="w-full" size="lg">
              {submitting
                ? t('admin.common.saving', { defaultValue: 'Saving…' })
                : isNew
                  ? t('admin.collections.createCollection', { defaultValue: 'Create collection' })
                  : t('admin.common.saveChanges', { defaultValue: 'Save changes' })}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default CollectionEditPage;
