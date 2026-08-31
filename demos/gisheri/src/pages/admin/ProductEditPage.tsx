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
import { Textarea } from '@/components/ui/textarea';
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
import ImageUpload from '@/components/admin/ImageUpload';
import MultiSelectChips from '@/components/admin/MultiSelectChips';
import { adminProducts, type Gender, type Purpose, type ZodiacSign } from '@/lib/admin-api';
import { ApiError } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';

const PURPOSES: Purpose[] = ['luck', 'protection', 'love', 'safety', 'energy', 'balance'];
const ZODIACS: ZodiacSign[] = [
  'aries', 'taurus', 'gemini', 'cancer',
  'leo', 'virgo', 'libra', 'scorpio',
  'sagittarius', 'capricorn', 'aquarius', 'pisces',
];

const schema = z.object({
  name: z.string().min(1, 'Required'),
  nameKa: z.string(),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Use a number with up to 2 decimals'),
  originalPrice: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Use a number with up to 2 decimals').optional().or(z.literal('')),
  image: z.string().default(''),
  purposes: z.array(z.enum(['luck', 'protection', 'love', 'safety', 'energy', 'balance'])),
  zodiacSigns: z.array(z.enum([
    'aries', 'taurus', 'gemini', 'cancer',
    'leo', 'virgo', 'libra', 'scorpio',
    'sagittarius', 'capricorn', 'aquarius', 'pisces',
  ])),
  stones: z.string(), // comma-separated, parsed before submit
  stonesMeaning: z.string(),
  stonesMeaningKa: z.string(),
  description: z.string(),
  descriptionKa: z.string(),
  gender: z.enum(['men', 'women', 'unisex']),
  isBestseller: z.boolean(),
  isNew: z.boolean(),
});
type Values = z.infer<typeof schema>;

const ProductEditPage = () => {
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'new' || !id;
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(!isNew);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      nameKa: '',
      price: '',
      originalPrice: '',
      image: '',
      purposes: [],
      zodiacSigns: [],
      stones: '',
      stonesMeaning: '',
      stonesMeaningKa: '',
      description: '',
      descriptionKa: '',
      gender: 'unisex',
      isBestseller: false,
      isNew: false,
    },
  });

  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    setLoading(true);
    adminProducts
      .get(Number(id))
      .then((p) => {
        if (cancelled) return;
        form.reset({
          name: p.name,
          nameKa: p.nameKa ?? '',
          price: p.price,
          originalPrice: p.originalPrice ?? '',
          image: p.image,
          purposes: p.purposes,
          zodiacSigns: p.zodiacSigns,
          stones: p.stones.join(', '),
          stonesMeaning: p.stonesMeaning,
          stonesMeaningKa: p.stonesMeaningKa ?? '',
          description: p.description,
          descriptionKa: p.descriptionKa ?? '',
          gender: p.gender,
          isBestseller: p.isBestseller,
          isNew: p.isNew,
        });
      })
      .catch((err) => {
        toast({
          title: 'Failed to load product',
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
        name: values.name,
        nameKa: values.nameKa,
        price: values.price,
        originalPrice: values.originalPrice ? values.originalPrice : null,
        image: values.image,
        purposes: values.purposes,
        zodiacSigns: values.zodiacSigns,
        stones: values.stones.split(',').map((s) => s.trim()).filter(Boolean),
        stonesMeaning: values.stonesMeaning,
        stonesMeaningKa: values.stonesMeaningKa,
        description: values.description,
        descriptionKa: values.descriptionKa,
        gender: values.gender as Gender,
        isBestseller: values.isBestseller,
        isNew: values.isNew,
      };
      if (isNew) {
        const created = await adminProducts.create(payload);
        toast({ title: 'Product created' });
        navigate(`/admin/products/${created.id}`, { replace: true });
      } else {
        await adminProducts.update(Number(id), payload);
        toast({ title: 'Product saved' });
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
      await adminProducts.remove(Number(id));
      toast({ title: 'Product deleted' });
      navigate('/admin/products');
    } catch (err) {
      toast({
        title: 'Failed to delete',
        description: err instanceof ApiError ? err.detail : undefined,
        variant: 'destructive',
      });
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="text-muted-foreground text-sm">{t('admin.common.loading', { defaultValue: 'Loading…' })}</div>
    );
  }

  return (
    <div>
      <PageHeader
        title={isNew ? t('admin.products.newTitle', { defaultValue: 'New product' }) : form.watch('name') || t('admin.products.editTitle', { defaultValue: 'Edit product' })}
        back={{ to: '/admin/products', label: t('admin.products.backToProducts', { defaultValue: 'Back to products' }) }}
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
                  <AlertDialogTitle>{t('admin.products.deleteTitle', { defaultValue: 'Delete this product?' })}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('admin.products.deleteDescription', {
                      defaultValue: 'This permanently removes the product and its admin record. The image file remains on disk.',
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
          {/* Main column */}
          <div className="space-y-6 min-w-0">
            <Card className="p-6 space-y-4">
              <h2 className="font-serif text-lg font-medium">{t('admin.products.basics', { defaultValue: 'Basics' })}</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name (English)</FormLabel>
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
                      <FormLabel>Name (Georgian)</FormLabel>
                      <FormControl><Input placeholder="—" {...field} /></FormControl>
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
                      <FormLabel>Description (English)</FormLabel>
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
                      <FormLabel>Description (Georgian)</FormLabel>
                      <FormControl><Textarea rows={4} placeholder="—" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price (₾)</FormLabel>
                      <FormControl><Input inputMode="decimal" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="originalPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Original price (₾, optional)</FormLabel>
                      <FormControl><Input inputMode="decimal" placeholder="—" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </Card>

            <Card className="p-6 space-y-4">
              <h2 className="font-serif text-lg font-medium">{t('admin.products.stones', { defaultValue: 'Stones' })}</h2>
              <FormField
                control={form.control}
                name="stones"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stones (comma-separated)</FormLabel>
                    <FormControl><Input placeholder="Amethyst, Rose Quartz" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="stonesMeaning"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stones meaning (English)</FormLabel>
                      <FormControl><Textarea rows={3} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="stonesMeaningKa"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stones meaning (Georgian)</FormLabel>
                      <FormControl><Textarea rows={3} placeholder="—" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </Card>

            <Card className="p-6 space-y-4">
              <h2 className="font-serif text-lg font-medium">{t('admin.products.tags', { defaultValue: 'Tags' })}</h2>
              <FormField
                control={form.control}
                name="purposes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purposes</FormLabel>
                    <FormControl>
                      <MultiSelectChips
                        options={PURPOSES.map((p) => ({ value: p, label: p }))}
                        values={field.value}
                        onChange={(v) => field.onChange(v as Purpose[])}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="zodiacSigns"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Zodiac signs</FormLabel>
                    <FormControl>
                      <MultiSelectChips
                        options={ZODIACS.map((z) => ({ value: z, label: z }))}
                        values={field.value}
                        onChange={(v) => field.onChange(v as ZodiacSign[])}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </Card>
          </div>

          {/* Sidebar */}
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

            <Card className="p-6 space-y-4">
              <h2 className="font-serif text-lg font-medium">{t('admin.products.visibility', { defaultValue: 'Visibility' })}</h2>
              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('admin.products.gender', { defaultValue: 'Gender' })}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="men">{t('admin.products.menGender', { defaultValue: 'Men' })}</SelectItem>
                        <SelectItem value="women">{t('admin.products.womenGender', { defaultValue: 'Women' })}</SelectItem>
                        <SelectItem value="unisex">{t('admin.products.unisexGender', { defaultValue: 'Unisex' })}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="isBestseller"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <Label>{t('admin.products.bestseller', { defaultValue: 'Bestseller' })}</Label>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="isNew"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <Label>{t('admin.products.newArrival', { defaultValue: 'New arrival' })}</Label>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </Card>

            <Button type="submit" disabled={submitting} className="w-full" size="lg">
              {submitting
                ? t('admin.common.saving', { defaultValue: 'Saving…' })
                : isNew
                  ? t('admin.products.createProduct', { defaultValue: 'Create product' })
                  : t('admin.common.saveChanges', { defaultValue: 'Save changes' })}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default ProductEditPage;
