import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, Pencil, Plus, Scissors, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Input } from '@/components/Input';
import { EmptyState } from '@/components/EmptyState';
import { Pager } from '@/components/Pager';
import { SectionError } from '@/components/SectionError';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/Dialog';
import { ConfirmDialog } from '@/features/admin/components/ConfirmDialog';
import { PhotoUploadDialog } from '@/features/admin/components/PhotoUploadDialog';
import { pageCount, usePageState } from '@/lib/paginated';
import { useAdminServicesPage } from '@/features/admin/hooks';
import {
  useAdminCreateService,
  useAdminCreateServiceCategory,
  useAdminDeleteService,
  useAdminDeleteServiceCategory,
  useAdminDeleteServiceImage,
  useAdminServiceCategories,
  useAdminUpdateService,
  useAdminUpdateServiceCategory,
  useAdminUploadServiceImage,
  type AdminService,
  type AdminServiceCategory,
} from '@/features/admin/crud-hooks';
import { pickLocalized } from '@/lib/localized';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/datetime';
import { SERVICE_ICONS } from '@/lib/serviceIcons';

export function AdminServices() {
  const { t, i18n } = useTranslation('admin');
  const cats = useAdminServiceCategories();
  const [page, setPage] = usePageState('services');
  const services = useAdminServicesPage(page);
  const serviceItems = useMemo(() => services.data?.results ?? [], [services.data]);
  const servicePages = pageCount(services.data?.count ?? 0);
  const [editing, setEditing] = useState<AdminService | null>(null);
  const [creating, setCreating] = useState(false);
  const [presetCategory, setPresetCategory] = useState<number | null>(null);

  const grouped = useMemo(() => {
    const byCat = new Map<number, AdminService[]>();
    for (const s of serviceItems) {
      const arr = byCat.get(s.category) ?? [];
      arr.push(s);
      byCat.set(s.category, arr);
    }
    return byCat;
  }, [serviceItems]);

  const onAddInCategory = (categoryId: number) => {
    setPresetCategory(categoryId);
    setCreating(true);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={t('page.services')}
        title={t('page.services')}
        subtitle={t('services.subtitle')}
        actions={
          <Button
            onClick={() => {
              setPresetCategory(null);
              setCreating(true);
            }}
            variant="accent"
            className="rounded-pill"
          >
            <Plus className="h-4 w-4" />
            {t('services.new_service')}
          </Button>
        }
      />

      {cats.isError ? (
        <SectionError error={cats.error} onRetry={() => cats.refetch()} />
      ) : (
        <CategoriesPanel categories={cats.data ?? []} loading={cats.isLoading} />
      )}

      {services.isError ? (
        <SectionError error={services.error} onRetry={() => services.refetch()} />
      ) : (
        <Card>
          <h2 className="font-display text-xl mb-4 tracking-tight">{t('page.services')}</h2>
          {services.isLoading ? (
            <p role="status" aria-live="polite" className="text-ink-muted text-sm">
              {t('actions.loading')}
            </p>
          ) : serviceItems.length === 0 ? (
            <EmptyState icon={<Scissors className="h-5 w-5" />} title={t('services.no_services')} />
          ) : (
            <div className="flex flex-col gap-6">
              {(cats.data ?? [])
                // On later pages only show categories with rows on this page —
                // an "empty" group would just mean its services sit elsewhere.
                .filter((cat) => servicePages <= 1 || grouped.has(cat.id))
                .map((cat) => {
                  const list = grouped.get(cat.id) ?? [];
                  return (
                    <ServiceCategoryGroup
                      key={cat.id}
                      category={cat}
                      services={list}
                      language={i18n.language}
                      onEdit={setEditing}
                      onAddInCategory={onAddInCategory}
                    />
                  );
                })}
            </div>
          )}
          <Pager page={page} pageCount={servicePages} onPageChange={setPage} className="mt-6" />
        </Card>
      )}

      <ServiceFormModal
        open={creating || editing !== null}
        categories={cats.data ?? []}
        initial={editing ?? undefined}
        presetCategory={presetCategory}
        onClose={() => {
          setCreating(false);
          setEditing(null);
          setPresetCategory(null);
        }}
      />
    </div>
  );
}

function CategoriesPanel({
  categories,
  loading,
}: {
  categories: AdminServiceCategory[];
  loading: boolean;
}) {
  const { t } = useTranslation('admin');
  const create = useAdminCreateServiceCategory();
  const del = useAdminDeleteServiceCategory();
  const [name, setName] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [editing, setEditing] = useState<AdminServiceCategory | null>(null);
  const [deleting, setDeleting] = useState<AdminServiceCategory | null>(null);

  const onConfirmDelete = async () => {
    if (!deleting || del.isPending) return;
    try {
      await del.mutateAsync(deleting.id);
      setDeleting(null);
    } catch {
      /* surfaced via toast + inline error */
    }
  };

  const onAdd = async () => {
    if (!name) return;
    try {
      await create.mutateAsync({ name, name_en: nameEn || undefined });
      setName('');
      setNameEn('');
    } catch {
      /* surfaced */
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl tracking-tight">{t('services.categories')}</h2>
        <span className="text-xs text-ink-muted tabular-nums">
          {t('services.categories_count', { count: categories.length })}
        </span>
      </div>

      {loading && (
        <p role="status" aria-live="polite" className="text-ink-muted text-sm">
          {t('actions.loading')}
        </p>
      )}

      {/* Vertical list of categories — proper rows, not pills */}
      <div className="flex flex-col divide-y divide-line border border-line rounded-md overflow-hidden">
        {categories.map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-3 px-4 py-3 bg-surface hover:bg-bg/40 transition"
          >
            <div className="flex-1 min-w-0">
              <div className="text-ink font-medium">{c.name}</div>
              {c.name_en && <div className="text-xs text-ink-muted truncate">{c.name_en}</div>}
            </div>
            <Badge variant="default" className="tabular-nums">
              {c.service_count} {t('services.services_count_short')}
            </Badge>
            <button
              type="button"
              onClick={() => setEditing(c)}
              className="inline-flex items-center justify-center w-8 h-8 rounded-pill text-ink-muted hover:bg-line/60 hover:text-ink transition"
              aria-label={t('actions.edit')}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setDeleting(c)}
              className="inline-flex items-center justify-center w-8 h-8 rounded-pill text-ink-muted hover:bg-danger/10 hover:text-danger transition"
              aria-label={t('actions.delete')}
              disabled={del.isPending}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {categories.length === 0 && !loading && (
          <div className="px-4 py-6 text-center text-sm text-ink-muted bg-surface">
            {t('services.no_categories')}
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-2 items-end mt-4">
        <Input
          label={t('services.new_category_ka')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('services.category_placeholder_ka')}
        />
        <Input
          label={t('services.new_category_en')}
          value={nameEn}
          onChange={(e) => setNameEn(e.target.value)}
          placeholder={t('services.category_placeholder_en')}
        />
        <Button onClick={onAdd} loading={create.isPending} className="rounded-pill h-11">
          <Plus className="h-4 w-4" />
          {t('actions.add')}
        </Button>
      </div>
      <ErrorMessage error={create.error ?? del.error} />

      <CategoryEditModal
        category={editing}
        open={editing !== null}
        onClose={() => setEditing(null)}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && !del.isPending && setDeleting(null)}
        title={t('services.delete_category_confirm', { name: deleting?.name ?? '' })}
        body={
          deleting && deleting.service_count > 0
            ? t('services.delete_category_with_services_warn', { name: deleting.name })
            : t('services.delete_category_body')
        }
        confirmLabel={t('actions.confirm_delete')}
        cancelLabel={t('actions.cancel')}
        destructive
        loading={del.isPending}
        onConfirm={onConfirmDelete}
      />
    </Card>
  );
}

function CategoryEditModal({
  category,
  open,
  onClose,
}: {
  category: AdminServiceCategory | null;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation('admin');
  const update = useAdminUpdateServiceCategory();
  const [name, setName] = useState(category?.name ?? '');
  const [nameEn, setNameEn] = useState(category?.name_en ?? '');
  const [trackedId, setTrackedId] = useState<number | null>(null);
  if (open && category && category.id !== trackedId) {
    setTrackedId(category.id);
    setName(category.name);
    setNameEn(category.name_en);
  }
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !name) return;
    try {
      await update.mutateAsync({ id: category.id, name, name_en: nameEn });
      onClose();
    } catch {
      /* surfaced */
    }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>{t('services.modal_edit_category_title')}</DialogTitle>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <Input
            label={t('services.new_category_ka')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            label={t('services.new_category_en')}
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
          />
          <ErrorMessage error={update.error} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} className="rounded-pill">
              {t('actions.cancel')}
            </Button>
            <Button
              type="submit"
              variant="accent"
              loading={update.isPending}
              className="rounded-pill"
            >
              {t('actions.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ServiceCategoryGroup({
  category,
  services,
  language,
  onEdit,
  onAddInCategory,
}: {
  category: AdminServiceCategory;
  services: AdminService[];
  language: string;
  onEdit: (s: AdminService) => void;
  onAddInCategory: (categoryId: number) => void;
}) {
  const { t } = useTranslation('admin');
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-line">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-lg text-ink tracking-tight">
            {pickLocalized(category.name, category.name_en, language)}
          </h3>
          <span className="text-xs text-ink-muted tabular-nums">({services.length})</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onAddInCategory(category.id)}
          className="rounded-pill"
        >
          <Plus className="h-3.5 w-3.5" />
          {t('services.add_in_category')}
        </Button>
      </div>
      {services.length === 0 ? (
        <p className="text-sm text-ink-muted py-2">{t('services.empty_category')}</p>
      ) : (
        <div className="border border-line rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-bg/50">
              <tr className="text-left text-ink-muted">
                <th
                  scope="col"
                  className="px-4 py-2.5 font-medium text-xs uppercase tracking-[0.1em]"
                >
                  {t('services.col_name')}
                </th>
                <th
                  scope="col"
                  className="px-4 py-2.5 font-medium text-xs uppercase tracking-[0.1em] w-24"
                >
                  {t('services.col_duration')}
                </th>
                <th
                  scope="col"
                  className="px-4 py-2.5 font-medium text-xs uppercase tracking-[0.1em] text-right w-24"
                >
                  {t('services.col_price')}
                </th>
                <th
                  scope="col"
                  className="px-4 py-2.5 font-medium text-xs uppercase tracking-[0.1em] w-28"
                >
                  {t('services.col_active')}
                </th>
                <th scope="col" className="px-4 py-2.5 w-32">
                  <span className="sr-only">{t('actions.row_actions_label')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <ServiceRow key={s.id} service={s} language={language} onEdit={onEdit} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ServiceRow({
  service,
  language,
  onEdit,
}: {
  service: AdminService;
  language: string;
  onEdit: (s: AdminService) => void;
}) {
  const { t } = useTranslation('admin');
  const update = useAdminUpdateService();
  const del = useAdminDeleteService();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const toggleActive = () => {
    update.mutate({ id: service.id, is_active: !service.is_active });
  };

  const onConfirmDelete = async () => {
    if (del.isPending) return;
    try {
      await del.mutateAsync(service.id);
      setConfirmDelete(false);
    } catch {
      /* surfaced via toast */
    }
  };

  return (
    <tr
      className={cn(
        'border-b border-line last:border-b-0 transition',
        service.is_active ? 'bg-surface hover:bg-bg/40' : 'bg-surface opacity-70',
      )}
    >
      <td className="px-4 py-3 align-middle">
        <div className="flex items-center gap-3">
          <ServiceVisual service={service} className="w-10 h-10 shrink-0" />
          <div className="min-w-0">
            <div className="font-medium text-ink truncate">
              {pickLocalized(service.name, service.name_en, language)}
            </div>
            {pickLocalized(service.description, service.description_en, language) && (
              <div className="text-xs text-ink-muted truncate max-w-md mt-0.5">
                {pickLocalized(service.description, service.description_en, language)}
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 align-middle text-ink-muted text-sm tabular-nums w-24 whitespace-nowrap">
        {service.duration_minutes} {t('services.minutes_short')}
      </td>
      <td className="px-4 py-3 align-middle text-right font-medium tabular-nums w-24 whitespace-nowrap">
        {formatMoney(service.price, language)}
      </td>
      <td className="px-4 py-3 align-middle w-28">
        <button
          type="button"
          onClick={toggleActive}
          disabled={update.isPending}
          className={cn(
            'relative inline-flex h-5 w-9 items-center rounded-full border transition',
            service.is_active ? 'bg-success border-success' : 'bg-line border-line-strong',
          )}
          aria-label={service.is_active ? t('services.deactivate') : t('services.activate')}
        >
          <span
            className={cn(
              'inline-block h-3.5 w-3.5 rounded-full bg-bg transition-transform',
              service.is_active ? 'translate-x-[19px]' : 'translate-x-[3px]',
            )}
          />
        </button>
      </td>
      <td className="px-4 py-3 align-middle text-right w-32">
        <div className="flex gap-1 justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(service)}
            className="rounded-pill"
            aria-label={t('actions.edit')}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmDelete(true)}
            loading={del.isPending && del.variables === service.id}
            className="rounded-pill text-ink-muted hover:text-danger"
            aria-label={t('actions.delete')}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={(o) => !o && !del.isPending && setConfirmDelete(false)}
          title={t('services.delete_service_confirm', { name: service.name })}
          body={t('services.delete_service_body')}
          confirmLabel={t('actions.confirm_delete')}
          cancelLabel={t('actions.cancel')}
          destructive
          loading={del.isPending}
          onConfirm={onConfirmDelete}
        />
      </td>
    </tr>
  );
}

function ServiceFormModal({
  open,
  categories,
  initial,
  presetCategory,
  onClose,
}: {
  open: boolean;
  categories: AdminServiceCategory[];
  initial?: AdminService;
  presetCategory: number | null;
  onClose: () => void;
}) {
  const { t } = useTranslation('admin');
  const [category, setCategory] = useState<number | ''>(initial?.category ?? presetCategory ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [nameEn, setNameEn] = useState(initial?.name_en ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [descriptionEn, setDescriptionEn] = useState(initial?.description_en ?? '');
  const [duration, setDuration] = useState<number | ''>(initial?.duration_minutes ?? '');
  const [price, setPrice] = useState(initial?.price ?? '');
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [iconKey, setIconKey] = useState(initial?.icon_key ?? '');
  const [trackedId, setTrackedId] = useState<number | null>(null);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [confirmImageRemove, setConfirmImageRemove] = useState(false);
  const create = useAdminCreateService();
  const update = useAdminUpdateService();
  const uploadImage = useAdminUploadServiceImage();
  const deleteImage = useAdminDeleteServiceImage();
  const error = create.error ?? update.error ?? uploadImage.error ?? deleteImage.error;

  // Sync form when opening/changing target.
  const targetId = initial?.id ?? null;
  if (open && targetId !== trackedId) {
    setTrackedId(targetId);
    setCategory(initial?.category ?? presetCategory ?? '');
    setName(initial?.name ?? '');
    setNameEn(initial?.name_en ?? '');
    setDescription(initial?.description ?? '');
    setDescriptionEn(initial?.description_en ?? '');
    setDuration(initial?.duration_minutes ?? '');
    setPrice(initial?.price ?? '');
    setIsActive(initial?.is_active ?? true);
    setIconKey(initial?.icon_key ?? '');
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !name || !duration || !price) return;
    const body = {
      category: Number(category),
      name,
      name_en: nameEn,
      description,
      description_en: descriptionEn,
      duration_minutes: Number(duration),
      price,
      icon_key: iconKey,
      is_active: isActive,
    };
    try {
      if (initial) {
        await update.mutateAsync({ id: initial.id, ...body });
      } else {
        await create.mutateAsync(body);
      }
      onClose();
    } catch {
      /* surfaced */
    }
  };

  const onUploadImage = async (blob: Blob) => {
    if (!initial) return;
    await uploadImage.mutateAsync({
      id: initial.id,
      blob,
      filename: `service-${initial.id}.jpg`,
    });
    setPhotoOpen(false);
  };

  const onConfirmRemoveImage = async () => {
    if (!initial?.image || deleteImage.isPending) return;
    try {
      await deleteImage.mutateAsync(initial.id);
      setConfirmImageRemove(false);
    } catch {
      /* surfaced via toast + inline error */
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>
          {initial ? t('services.modal_edit_title') : t('services.modal_new_title')}
        </DialogTitle>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">{t('services.field_category')}</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value ? Number(e.target.value) : '')}
              required
              className="h-11 px-3.5 bg-surface-2 border border-line rounded-md text-[15px] text-ink focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
            >
              <option value="">{t('services.field_select_category')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.name_en && ` · ${c.name_en}`}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t('services.field_name_ka')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Input
              label={t('services.field_name_en')}
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink">
                {t('services.field_description_ka')}
              </span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="px-3.5 py-2.5 bg-surface-2 border border-line rounded-md text-[15px] text-ink focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink">
                {t('services.field_description_en')}
              </span>
              <textarea
                value={descriptionEn}
                onChange={(e) => setDescriptionEn(e.target.value)}
                rows={2}
                className="px-3.5 py-2.5 bg-surface-2 border border-line rounded-md text-[15px] text-ink focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t('services.field_duration')}
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value ? Number(e.target.value) : '')}
              required
            />
            <Input
              label={t('services.field_price')}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
          </div>

          {/* Image + icon fallback */}
          <div className="flex flex-col gap-2 pt-2 border-t border-line">
            <span className="text-sm font-medium text-ink">{t('services.field_image')}</span>
            <div className="flex items-center gap-3">
              <div className="w-24 aspect-[4/3] bg-bg border border-line rounded-md overflow-hidden flex items-center justify-center text-ink-muted/40">
                {initial?.image ? (
                  <img src={initial.image} alt="" className="w-full h-full object-cover" />
                ) : iconKey ? (
                  (() => {
                    const def = SERVICE_ICONS.find((i) => i.key === iconKey);
                    if (!def) return null;
                    const I = def.Icon;
                    return <I className="h-9 w-9 text-ink" />;
                  })()
                ) : (
                  <Scissors className="h-7 w-7" />
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {initial ? (
                  <>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => setPhotoOpen(true)}
                      className="rounded-pill"
                    >
                      <Camera className="h-3.5 w-3.5" />
                      {initial.image ? t('services.image_change') : t('services.image_upload')}
                    </Button>
                    {initial.image && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmImageRemove(true)}
                        loading={deleteImage.isPending}
                        className="rounded-pill text-ink-muted hover:text-danger"
                        aria-label={t('actions.remove')}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-ink-muted">
                    {t('services.image_after_save_hint')}
                  </p>
                )}
              </div>
            </div>
            <p className="text-xs text-ink-muted mt-1">
              {t(initial?.image ? 'services.icon_hidden_when_image' : 'services.icon_hint')}
            </p>
            <div className="grid grid-cols-6 gap-2 mt-1">
              <button
                type="button"
                onClick={() => setIconKey('')}
                className={cn(
                  'aspect-square rounded-md border flex items-center justify-center transition',
                  iconKey === ''
                    ? 'bg-ink text-bg border-ink'
                    : 'bg-surface text-ink-muted border-line hover:border-line-strong hover:text-ink',
                )}
                aria-label={t('services.icon_none')}
              >
                <span className="text-[10px] uppercase tracking-[0.1em]">
                  {t('services.icon_none')}
                </span>
              </button>
              {SERVICE_ICONS.map((def) => {
                const I = def.Icon;
                const active = iconKey === def.key;
                return (
                  <button
                    key={def.key}
                    type="button"
                    onClick={() => setIconKey(def.key)}
                    title={t(`services.${def.labelKey}`, { defaultValue: def.fallbackLabel })}
                    className={cn(
                      'aspect-square rounded-md border flex items-center justify-center transition',
                      active
                        ? 'bg-ink text-bg border-ink'
                        : 'bg-surface text-ink-muted border-line hover:border-line-strong hover:text-ink',
                    )}
                  >
                    <I className="h-5 w-5" />
                  </button>
                );
              })}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm mt-1">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            {t('services.field_active')}
          </label>
          <ErrorMessage error={error} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} className="rounded-pill">
              {t('actions.cancel')}
            </Button>
            <Button
              type="submit"
              variant="accent"
              loading={create.isPending || update.isPending}
              className="rounded-pill"
            >
              {initial ? t('actions.save') : t('actions.create')}
            </Button>
          </DialogFooter>
        </form>

        <PhotoUploadDialog
          open={photoOpen}
          onClose={() => setPhotoOpen(false)}
          aspect={4 / 3}
          onConfirm={onUploadImage}
          uploading={uploadImage.isPending}
          error={uploadImage.error}
        />

        <ConfirmDialog
          open={confirmImageRemove}
          onOpenChange={(o) => !o && !deleteImage.isPending && setConfirmImageRemove(false)}
          title={t('services.image_remove_confirm')}
          body={t('services.image_remove_body')}
          confirmLabel={t('actions.confirm_remove')}
          cancelLabel={t('actions.cancel')}
          destructive
          loading={deleteImage.isPending}
          onConfirm={onConfirmRemoveImage}
        />
      </DialogContent>
    </Dialog>
  );
}

function ServiceVisual({ service, className }: { service: AdminService; className?: string }) {
  if (service.image) {
    return (
      <div
        className={cn('rounded-md overflow-hidden bg-bg border border-line shrink-0', className)}
      >
        <img src={service.image} alt="" className="w-full h-full object-cover" />
      </div>
    );
  }
  if (service.icon_key) {
    const def = SERVICE_ICONS.find((i) => i.key === service.icon_key);
    if (def) {
      const Icon = def.Icon;
      return (
        <div
          className={cn(
            'rounded-md bg-accent-soft text-ink flex items-center justify-center shrink-0',
            className,
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      );
    }
  }
  return (
    <div
      className={cn(
        'rounded-md bg-line/40 text-ink-muted flex items-center justify-center shrink-0',
        className,
      )}
    >
      <Scissors className="h-4 w-4" />
    </div>
  );
}
