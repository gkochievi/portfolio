import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Scissors } from 'lucide-react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/Dialog';
import { EmptyState } from '@/components/EmptyState';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Input } from '@/components/Input';
import { SectionError } from '@/components/SectionError';
import { ConfirmDialog } from './ConfirmDialog';
import { useAdminServices } from '../hooks';
import {
  useAdminAssignBarberService,
  useAdminBarberServices,
  useAdminUnassignBarberService,
  useAdminUpdateBarberService,
  type AdminBarberService,
} from '../barber-services-hooks';
import { formatMoney } from '@/lib/datetime';
import { pickLocalized } from '@/lib/localized';

/**
 * "Services & pricing" tab (spec §9.4): which catalog services this barber
 * offers, with optional per-barber price/duration overrides. The effective
 * values shown are exactly what the booking pipeline charges/blocks.
 */

interface OverrideErrors {
  service?: string;
  price?: string;
  duration?: string;
}

function validateOverrides(
  price: string,
  duration: string,
): Pick<OverrideErrors, 'price' | 'duration'> {
  const errors: Pick<OverrideErrors, 'price' | 'duration'> = {};
  if (price.trim() !== '') {
    const n = Number(price);
    if (!Number.isFinite(n) || n < 0) errors.price = 'err_price_invalid';
  }
  if (duration.trim() !== '') {
    const n = Number(duration);
    if (!Number.isInteger(n) || n < 1) errors.duration = 'err_duration_invalid';
  }
  return errors;
}

export function BarberServicesTab({ barberId }: { barberId: number }) {
  const { t, i18n } = useTranslation('admin');
  const servicesQuery = useAdminBarberServices(barberId);
  const rows = servicesQuery.data ?? [];
  const [assignOpen, setAssignOpen] = useState(false);
  const [editing, setEditing] = useState<AdminBarberService | null>(null);
  const [removing, setRemoving] = useState<AdminBarberService | null>(null);
  const unassign = useAdminUnassignBarberService();

  const onConfirmRemove = async () => {
    if (!removing || unassign.isPending) return;
    try {
      await unassign.mutateAsync({ barberId, barberServiceId: removing.id });
      setRemoving(null);
    } catch {
      /* surfaced via toast + inline error */
    }
  };

  if (servicesQuery.isError) {
    return <SectionError error={servicesQuery.error} onRetry={() => servicesQuery.refetch()} />;
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="font-display text-xl tracking-tight">{t('barber_services.title')}</h2>
        <Button
          type="button"
          variant="accent"
          size="sm"
          onClick={() => setAssignOpen(true)}
          className="rounded-pill"
        >
          <Plus className="h-3.5 w-3.5" />
          {t('barber_services.assign')}
        </Button>
      </div>
      <p className="text-xs text-ink-muted mb-4">{t('barber_services.hint')}</p>

      {servicesQuery.isLoading ? (
        <p role="status" aria-live="polite" className="text-ink-muted text-sm">
          {t('actions.loading')}
        </p>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Scissors className="h-5 w-5" />}
          title={t('barber_services.empty_title')}
          hint={t('barber_services.empty_hint')}
        />
      ) : (
        <div className="overflow-x-auto border border-line rounded-md">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-bg/50">
              <tr className="text-left text-ink-muted">
                <th
                  scope="col"
                  className="px-3 py-2.5 font-medium text-xs uppercase tracking-[0.1em]"
                >
                  {t('barber_services.col_service')}
                </th>
                <th
                  scope="col"
                  className="px-3 py-2.5 font-medium text-xs uppercase tracking-[0.1em] text-right"
                >
                  {t('barber_services.col_base')}
                </th>
                <th
                  scope="col"
                  className="px-3 py-2.5 font-medium text-xs uppercase tracking-[0.1em] text-right"
                >
                  {t('barber_services.col_override')}
                </th>
                <th
                  scope="col"
                  className="px-3 py-2.5 font-medium text-xs uppercase tracking-[0.1em] text-right"
                >
                  {t('barber_services.col_effective')}
                </th>
                <th scope="col" className="px-3 py-2.5 w-32">
                  <span className="sr-only">{t('actions.row_actions_label')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-line last:border-b-0 hover:bg-bg/40 transition"
                >
                  <td className="px-3 py-2.5 align-middle">
                    <div className="text-ink font-medium">
                      {pickLocalized(row.service_name, row.service_name_en, i18n.language)}
                    </div>
                    {!row.service_is_active && (
                      <div className="text-xs text-danger mt-0.5">
                        {t('barber_services.service_inactive')}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-middle text-right text-ink-muted tabular-nums whitespace-nowrap">
                    {formatMoney(row.base_price, i18n.language)} · {row.base_duration_minutes}{' '}
                    {t('services.minutes_short')}
                  </td>
                  <td className="px-3 py-2.5 align-middle text-right tabular-nums whitespace-nowrap">
                    {row.price_override === null && row.duration_override === null ? (
                      <span className="text-ink-muted">—</span>
                    ) : (
                      <span className="text-ink">
                        {row.price_override !== null
                          ? formatMoney(row.price_override, i18n.language)
                          : '—'}
                        {' · '}
                        {row.duration_override !== null
                          ? `${row.duration_override} ${t('services.minutes_short')}`
                          : '—'}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-middle text-right font-medium tabular-nums whitespace-nowrap">
                    {formatMoney(row.effective_price, i18n.language)} ·{' '}
                    {row.effective_duration_minutes} {t('services.minutes_short')}
                  </td>
                  <td className="px-3 py-2.5 align-middle text-right whitespace-nowrap">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditing(row)}
                      className="rounded-pill"
                    >
                      {t('actions.edit')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRemoving(row)}
                      className="rounded-pill text-ink-muted hover:text-danger"
                    >
                      {t('barber_services.unassign')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ErrorMessage error={unassign.error} />

      <AssignServiceDialog
        barberId={barberId}
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        assigned={rows}
      />
      {editing && (
        <EditOverridesDialog barberId={barberId} row={editing} onClose={() => setEditing(null)} />
      )}

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && !unassign.isPending && setRemoving(null)}
        title={t('barber_services.unassign_confirm', {
          name: removing
            ? pickLocalized(removing.service_name, removing.service_name_en, i18n.language)
            : '',
        })}
        body={t('barber_services.unassign_body')}
        confirmLabel={t('actions.confirm_remove')}
        cancelLabel={t('actions.cancel')}
        destructive
        loading={unassign.isPending}
        onConfirm={onConfirmRemove}
      />
    </Card>
  );
}

export function AssignServiceDialog({
  barberId,
  open,
  onClose,
  assigned,
}: {
  barberId: number;
  open: boolean;
  onClose: () => void;
  assigned: AdminBarberService[];
}) {
  const { t, i18n } = useTranslation('admin');
  const services = useAdminServices();
  const assign = useAdminAssignBarberService();
  const [serviceId, setServiceId] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('');
  const [errors, setErrors] = useState<OverrideErrors>({});

  // Only services not already assigned to this barber are offered.
  const available = useMemo(() => {
    const taken = new Set(assigned.map((r) => r.service_id));
    return (services.data ?? []).filter((s) => !taken.has(s.id));
  }, [services.data, assigned]);

  const reset = () => {
    setServiceId('');
    setPrice('');
    setDuration('');
    setErrors({});
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: OverrideErrors = validateOverrides(price, duration);
    if (!serviceId) next.service = 'err_service_required';
    setErrors(next);
    if (next.service || next.price || next.duration) return;
    try {
      await assign.mutateAsync({
        barberId,
        service_id: Number(serviceId),
        price_override: price.trim() === '' ? null : price.trim(),
        duration_override: duration.trim() === '' ? null : Number(duration),
      });
      reset();
      onClose();
    } catch {
      /* surfaced via toast + inline error */
    }
  };

  const dismiss = () => {
    if (assign.isPending) return;
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && dismiss()}>
      <DialogContent>
        <DialogTitle>{t('barber_services.modal_assign_title')}</DialogTitle>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">{t('barber_services.f_service')}</span>
            <select
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className="h-11 px-3.5 bg-surface-2 border border-line rounded-md text-[15px] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
            >
              <option value="">{t('barber_services.select_service')}</option>
              {available.map((s) => (
                <option key={s.id} value={s.id}>
                  {pickLocalized(s.name, s.name_en, i18n.language)} —{' '}
                  {formatMoney(s.price, i18n.language)} · {s.duration_minutes}{' '}
                  {t('services.minutes_short')}
                </option>
              ))}
            </select>
            {errors.service && (
              <span className="text-xs text-danger">{t(`barber_services.${errors.service}`)}</span>
            )}
          </label>
          <Input
            label={t('barber_services.f_price_override')}
            type="number"
            min={0}
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            error={errors.price ? t(`barber_services.${errors.price}`) : undefined}
            hint={t('barber_services.override_hint')}
          />
          <Input
            label={t('barber_services.f_duration_override')}
            type="number"
            min={1}
            step={1}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            error={errors.duration ? t(`barber_services.${errors.duration}`) : undefined}
            hint={t('barber_services.override_hint')}
          />
          <ErrorMessage error={assign.error} />
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={dismiss}
              disabled={assign.isPending}
              className="rounded-pill"
            >
              {t('actions.cancel')}
            </Button>
            <Button
              type="submit"
              variant="accent"
              loading={assign.isPending}
              className="rounded-pill"
            >
              {t('barber_services.assign')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditOverridesDialog({
  barberId,
  row,
  onClose,
}: {
  barberId: number;
  row: AdminBarberService;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation('admin');
  const update = useAdminUpdateBarberService();
  const [price, setPrice] = useState(row.price_override ?? '');
  const [duration, setDuration] = useState(
    row.duration_override !== null ? String(row.duration_override) : '',
  );
  const [errors, setErrors] = useState<OverrideErrors>({});

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = validateOverrides(price, duration);
    setErrors(next);
    if (next.price || next.duration) return;
    try {
      // Empty field = clear the override (JSON null) → catalog value applies.
      await update.mutateAsync({
        barberId,
        barberServiceId: row.id,
        price_override: price.trim() === '' ? null : price.trim(),
        duration_override: duration.trim() === '' ? null : Number(duration),
      });
      onClose();
    } catch {
      /* surfaced via toast + inline error */
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !update.isPending && onClose()}>
      <DialogContent>
        <DialogTitle>
          {t('barber_services.modal_edit_title', {
            name: pickLocalized(row.service_name, row.service_name_en, i18n.language),
          })}
        </DialogTitle>
        <p className="text-sm text-ink-muted">
          {t('barber_services.base_label', {
            price: formatMoney(row.base_price, i18n.language),
            minutes: row.base_duration_minutes,
          })}
        </p>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
          <Input
            label={t('barber_services.f_price_override')}
            type="number"
            min={0}
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            error={errors.price ? t(`barber_services.${errors.price}`) : undefined}
            hint={t('barber_services.clear_hint')}
          />
          <Input
            label={t('barber_services.f_duration_override')}
            type="number"
            min={1}
            step={1}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            error={errors.duration ? t(`barber_services.${errors.duration}`) : undefined}
            hint={t('barber_services.clear_hint')}
          />
          <ErrorMessage error={update.error} />
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={update.isPending}
              className="rounded-pill"
            >
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
