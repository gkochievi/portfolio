import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Megaphone, Plus } from 'lucide-react';
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
import { formatMoney, formatTbilisiDate } from '@/lib/datetime';
import { pageCount, usePageState } from '@/lib/paginated';
import {
  useAdminCreatePromotion,
  useAdminDeletePromotion,
  useAdminPromotions,
  useAdminUpdatePromotion,
  type AdminPromotion,
} from '@/features/admin/promotions-hooks';

type DiscountKind = 'percent' | 'amount';

export function AdminPromotions() {
  const { t } = useTranslation('admin');
  const [page, setPage] = usePageState('promotions');
  const promos = useAdminPromotions(page);
  const [editing, setEditing] = useState<AdminPromotion | null>(null);
  const [creating, setCreating] = useState(false);
  const items: AdminPromotion[] = promos.data?.results ?? [];
  const pages = pageCount(promos.data?.count ?? 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={t('page.promotions')}
        title={t('page.promotions')}
        subtitle={t('promotions_page.subtitle')}
        actions={
          <Button onClick={() => setCreating(true)} variant="accent" className="rounded-pill">
            <Plus className="h-4 w-4" />
            {t('promotions_page.new')}
          </Button>
        }
      />

      {promos.isError ? (
        <SectionError error={promos.error} onRetry={() => promos.refetch()} />
      ) : promos.isLoading ? (
        <Card>
          <p role="status" aria-live="polite" className="text-ink-muted text-sm">
            {t('actions.loading')}
          </p>
        </Card>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="h-5 w-5" />}
          title={t('promotions_page.no_codes')}
        />
      ) : (
        <>
          <PromotionsTable items={items} onEdit={setEditing} />
          <Pager page={page} pageCount={pages} onPageChange={setPage} />
        </>
      )}

      <PromotionFormModal
        open={creating || editing !== null}
        initial={editing ?? undefined}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />
    </div>
  );
}

function PromotionsTable({
  items,
  onEdit,
}: {
  items: AdminPromotion[];
  onEdit: (p: AdminPromotion) => void;
}) {
  const { t, i18n } = useTranslation('admin');
  const del = useAdminDeletePromotion();
  const [deleting, setDeleting] = useState<AdminPromotion | null>(null);

  const onConfirmDelete = async () => {
    if (!deleting || del.isPending) return;
    try {
      await del.mutateAsync(deleting.id);
      setDeleting(null);
    } catch {
      /* surfaced via toast */
    }
  };

  return (
    <div className="overflow-x-auto border border-line rounded-2xl bg-surface">
      <table className="w-full text-sm">
        <thead className="border-b border-line bg-bg/50">
          <tr className="text-left text-ink-muted">
            <th scope="col" className="px-4 py-3 font-medium text-xs uppercase tracking-[0.1em]">
              {t('promotions_page.col_code')}
            </th>
            <th scope="col" className="px-4 py-3 font-medium text-xs uppercase tracking-[0.1em]">
              {t('promotions_page.col_discount')}
            </th>
            <th scope="col" className="px-4 py-3 font-medium text-xs uppercase tracking-[0.1em]">
              {t('promotions_page.col_window')}
            </th>
            <th scope="col" className="px-4 py-3 font-medium text-xs uppercase tracking-[0.1em]">
              {t('promotions_page.col_uses')}
            </th>
            <th scope="col" className="px-4 py-3 font-medium text-xs uppercase tracking-[0.1em]">
              {t('promotions_page.col_active')}
            </th>
            <th scope="col" className="px-4 py-3 w-32">
              <span className="sr-only">{t('actions.row_actions_label')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr
              key={p.id}
              className="border-b border-line last:border-b-0 hover:bg-bg/30 transition"
            >
              <td className="px-4 py-3 align-middle">
                <span className="font-mono text-ink font-medium tracking-wide">{p.code}</span>
                {p.description && (
                  <div className="text-xs text-ink-muted mt-0.5 truncate max-w-[280px]">
                    {p.description}
                  </div>
                )}
              </td>
              <td className="px-4 py-3 align-middle font-medium tabular-nums">
                {p.percent_off !== null
                  ? `${p.percent_off}%`
                  : formatMoney(p.amount_off ?? 0, i18n.language)}
              </td>
              <td className="px-4 py-3 align-middle text-ink-muted text-xs tabular-nums">
                {p.valid_from ? formatTbilisiDate(p.valid_from) : '—'}
                {' → '}
                {p.valid_until ? formatTbilisiDate(p.valid_until) : '—'}
              </td>
              <td className="px-4 py-3 align-middle tabular-nums">
                {p.uses_count}
                {p.max_uses !== null ? (
                  <span className="text-ink-muted">
                    {' / '}
                    {p.max_uses}
                  </span>
                ) : null}
              </td>
              <td className="px-4 py-3 align-middle">
                <Badge variant={p.is_active ? 'success' : 'danger'}>
                  {p.is_active ? t('promotions_page.yes') : t('promotions_page.no')}
                </Badge>
              </td>
              <td className="px-4 py-3 align-middle text-right">
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(p)}
                    className="rounded-pill"
                  >
                    {t('actions.edit')}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setDeleting(p)}
                    loading={del.isPending && del.variables === p.id}
                    className="rounded-pill"
                  >
                    {t('actions.delete')}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && !del.isPending && setDeleting(null)}
        title={t('promotions_page.delete_confirm', { code: deleting?.code ?? '' })}
        body={t('promotions_page.delete_body')}
        confirmLabel={t('actions.confirm_delete')}
        cancelLabel={t('actions.cancel')}
        destructive
        loading={del.isPending}
        onConfirm={onConfirmDelete}
      />
    </div>
  );
}

function PromotionFormModal({
  open,
  initial,
  onClose,
}: {
  open: boolean;
  initial?: AdminPromotion;
  onClose: () => void;
}) {
  const { t } = useTranslation('admin');
  const create = useAdminCreatePromotion();
  const update = useAdminUpdatePromotion();
  const error = create.error ?? update.error;

  const [code, setCode] = useState(initial?.code ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [kind, setKind] = useState<DiscountKind>(
    initial?.percent_off !== null && initial?.percent_off !== undefined ? 'percent' : 'amount',
  );
  const [percent, setPercent] = useState<string>(initial?.percent_off?.toString() ?? '');
  const [amount, setAmount] = useState<string>(initial?.amount_off ?? '');
  const [validFrom, setValidFrom] = useState(
    initial?.valid_from ? initial.valid_from.slice(0, 16) : '',
  );
  const [validUntil, setValidUntil] = useState(
    initial?.valid_until ? initial.valid_until.slice(0, 16) : '',
  );
  const [maxUses, setMaxUses] = useState<string>(initial?.max_uses?.toString() ?? '');
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [trackedId, setTrackedId] = useState<number | null>(null);

  // Re-sync when target changes.
  const targetId = initial?.id ?? null;
  if (open && targetId !== trackedId) {
    setTrackedId(targetId);
    setCode(initial?.code ?? '');
    setDescription(initial?.description ?? '');
    setKind(
      initial?.percent_off !== null && initial?.percent_off !== undefined ? 'percent' : 'amount',
    );
    setPercent(initial?.percent_off?.toString() ?? '');
    setAmount(initial?.amount_off ?? '');
    setValidFrom(initial?.valid_from ? initial.valid_from.slice(0, 16) : '');
    setValidUntil(initial?.valid_until ? initial.valid_until.slice(0, 16) : '');
    setMaxUses(initial?.max_uses?.toString() ?? '');
    setIsActive(initial?.is_active ?? true);
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) return;
    if (kind === 'percent' && !percent) return;
    if (kind === 'amount' && !amount) return;

    const body = {
      code: code.trim(),
      description: description.trim(),
      percent_off: kind === 'percent' ? Number(percent) : null,
      amount_off: kind === 'amount' ? amount : null,
      valid_from: validFrom ? new Date(validFrom).toISOString() : null,
      valid_until: validUntil ? new Date(validUntil).toISOString() : null,
      max_uses: maxUses ? Number(maxUses) : null,
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

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>
          {initial ? t('promotions_page.modal_edit_title') : t('promotions_page.modal_new_title')}
        </DialogTitle>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <Input
            label={t('promotions_page.f_code')}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="SUMMER25"
            required
          />
          <Input
            label={t('promotions_page.f_description')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">
              {t('promotions_page.f_discount_type')}
            </span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as DiscountKind)}
              className="h-11 px-3.5 bg-surface-2 border border-line rounded-md text-[15px] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
            >
              <option value="percent">{t('promotions_page.type_percent')}</option>
              <option value="amount">{t('promotions_page.type_amount')}</option>
            </select>
          </label>
          {kind === 'percent' ? (
            <Input
              label={t('promotions_page.f_percent')}
              type="number"
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              required
            />
          ) : (
            <Input
              label={t('promotions_page.f_amount')}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t('promotions_page.f_valid_from')}
              type="datetime-local"
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
            />
            <Input
              label={t('promotions_page.f_valid_until')}
              type="datetime-local"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </div>
          <Input
            label={t('promotions_page.f_max_uses')}
            type="number"
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm mt-1">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            {t('promotions_page.f_active')}
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
      </DialogContent>
    </Dialog>
  );
}
