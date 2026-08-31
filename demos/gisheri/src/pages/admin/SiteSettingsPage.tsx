import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
import { adminSiteSettings, type SiteSettings } from '@/lib/site-settings-api';
import { useCollections } from '@/hooks/use-catalog';
import { ApiError } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';

const schema = z.object({
  heroTitleEn: z.string().max(200),
  heroTitleKa: z.string().max(200),
  heroSubtitleEn: z.string(),
  heroSubtitleKa: z.string(),
  heroImage: z.string(),
  heroCtaLabelEn: z.string().max(100),
  heroCtaLabelKa: z.string().max(100),
  heroCtaLink: z.string().max(255),
  bannerTextEn: z.string().max(255),
  bannerTextKa: z.string().max(255),
  bannerLink: z.string().max(255),
  bannerActive: z.boolean(),
  featuredCollectionSlugs: z.array(z.string()),
  siteName: z.string().max(100),
  defaultOgImage: z.string().max(255),
  twitterHandle: z.string().max(64),
  defaultRobots: z.string().max(64),
});
type Values = z.infer<typeof schema>;

const SiteSettingsPage = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: collections = [] } = useCollections();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      heroTitleEn: '', heroTitleKa: '',
      heroSubtitleEn: '', heroSubtitleKa: '',
      heroImage: '',
      heroCtaLabelEn: '', heroCtaLabelKa: '', heroCtaLink: '/shop',
      bannerTextEn: '', bannerTextKa: '', bannerLink: '', bannerActive: false,
      featuredCollectionSlugs: [],
      siteName: '', defaultOgImage: '', twitterHandle: '', defaultRobots: 'index,follow',
    },
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminSiteSettings
      .get()
      .then((s) => {
        if (cancelled) return;
        const v: Values = {
          heroTitleEn: s.heroTitleEn,
          heroTitleKa: s.heroTitleKa,
          heroSubtitleEn: s.heroSubtitleEn,
          heroSubtitleKa: s.heroSubtitleKa,
          heroImage: s.heroImage,
          heroCtaLabelEn: s.heroCtaLabelEn,
          heroCtaLabelKa: s.heroCtaLabelKa,
          heroCtaLink: s.heroCtaLink,
          bannerTextEn: s.bannerTextEn,
          bannerTextKa: s.bannerTextKa,
          bannerLink: s.bannerLink,
          bannerActive: s.bannerActive,
          featuredCollectionSlugs: s.featuredCollectionSlugs,
          siteName: s.siteName,
          defaultOgImage: s.defaultOgImage,
          twitterHandle: s.twitterHandle,
          defaultRobots: s.defaultRobots,
        };
        form.reset(v);
      })
      .catch((err) => {
        toast({
          title: 'Failed to load settings',
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
  }, [form, toast]);

  const onSubmit = async (values: Values) => {
    setSubmitting(true);
    try {
      await adminSiteSettings.update(values as Partial<SiteSettings>);
      // Make the public storefront pick up the change immediately
      queryClient.invalidateQueries({ queryKey: ['site-settings'] });
      queryClient.invalidateQueries({ queryKey: ['page-seo'] });
      toast({ title: t('admin.settings.settingsSaved', { defaultValue: 'Settings saved' }) });
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

  if (loading) return <div className="text-muted-foreground text-sm">{t('admin.common.loading', { defaultValue: 'Loading…' })}</div>;

  return (
    <div>
      <PageHeader
        title={t('admin.settings.title', { defaultValue: 'Site settings' })}
        description={t('admin.settings.description', { defaultValue: 'Hero, banner, and homepage layout. Empty fields fall back to default copy.' })}
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid lg:grid-cols-[1fr_320px] gap-6">
          <div className="space-y-6 min-w-0">
            <Card className="p-6 space-y-4">
              <h2 className="font-serif text-lg font-medium">{t('admin.settings.hero', { defaultValue: 'Hero' })}</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="heroTitleEn"
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
                  name="heroTitleKa"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title (Georgian)</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="heroSubtitleEn"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subtitle (English)</FormLabel>
                      <FormControl><Textarea rows={3} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="heroSubtitleKa"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subtitle (Georgian)</FormLabel>
                      <FormControl><Textarea rows={3} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid sm:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="heroCtaLabelEn"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CTA label (EN)</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="heroCtaLabelKa"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CTA label (KA)</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="heroCtaLink"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CTA link</FormLabel>
                      <FormControl><Input placeholder="/shop" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </Card>

            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-lg font-medium">{t('admin.settings.topBanner', { defaultValue: 'Top banner' })}</h2>
                <FormField
                  control={form.control}
                  name="bannerActive"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <Label className="text-sm">Active</Label>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="bannerTextEn"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Text (English)</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="bannerTextKa"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Text (Georgian)</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="bannerLink"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Link (optional)</FormLabel>
                    <FormControl><Input placeholder="/shop" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </Card>

            <Card className="p-6 space-y-4">
              <h2 className="font-serif text-lg font-medium">{t('admin.settings.featuredCollections', { defaultValue: 'Featured collections' })}</h2>
              <p className="text-sm text-muted-foreground">
                Pick the collections to highlight on the homepage. Order matters.
              </p>
              <FormField
                control={form.control}
                name="featuredCollectionSlugs"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <MultiSelectChips
                        options={collections.map((c) => ({ value: c.slug, label: c.name }))}
                        values={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </Card>

            <Card className="p-6 space-y-4">
              <h2 className="font-serif text-lg font-medium">{t('admin.settings.seoDefaults', { defaultValue: 'SEO defaults' })}</h2>
              <p className="text-sm text-muted-foreground">
                Used as fallbacks when a page or override doesn't specify its own value.
                Per-page overrides live at <code className="text-xs bg-muted px-1 py-0.5 rounded">/admin/page-seo</code>.
              </p>
              <FormField
                control={form.control}
                name="siteName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Site name</FormLabel>
                    <FormControl>
                      <Input placeholder="Gisheri" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="defaultOgImage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default OG image (URL)</FormLabel>
                    <FormControl>
                      <Input placeholder="https://… or /media/…" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="twitterHandle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Twitter handle (no @)</FormLabel>
                      <FormControl>
                        <Input placeholder="gisheri" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="defaultRobots"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default robots</FormLabel>
                      <FormControl>
                        <Input placeholder="index,follow" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="p-6 space-y-4">
              <h2 className="font-serif text-lg font-medium">{t('admin.settings.heroImage', { defaultValue: 'Hero image' })}</h2>
              <FormField
                control={form.control}
                name="heroImage"
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
              {submitting ? t('admin.common.saving', { defaultValue: 'Saving…' }) : t('admin.settings.saveSettings', { defaultValue: 'Save settings' })}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default SiteSettingsPage;
