import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail, MoreHorizontal, Phone, Power, Save, X } from 'lucide-react';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { ErrorMessage } from '@/components/ErrorMessage';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/DropdownMenu';
import { formatMoney } from '@/lib/datetime';
import { useAdminUpdateCustomer, type AdminCustomer } from '../hooks';

function relativeTime(iso: string | null, language: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days < 1) return new Intl.RelativeTimeFormat(language, { numeric: 'auto' }).format(0, 'day');
  if (days < 31)
    return new Intl.RelativeTimeFormat(language, { numeric: 'auto' }).format(-days, 'day');
  const months = Math.floor(days / 30);
  if (months < 12)
    return new Intl.RelativeTimeFormat(language, { numeric: 'auto' }).format(-months, 'month');
  const years = Math.floor(days / 365);
  return new Intl.RelativeTimeFormat(language, { numeric: 'auto' }).format(-years, 'year');
}

export function CustomersTable({ customers }: { customers: AdminCustomer[] }) {
  const { t, i18n } = useTranslation('admin');
  const navigate = useNavigate();
  const [editingId, setEditingId] = useState<number | null>(null);

  return (
    <div className="flex flex-col gap-3">
      {/* Mobile cards */}
      <div className="md:hidden flex flex-col gap-3">
        {customers.map((c) =>
          editingId === c.id ? (
            <CustomerEditCard key={c.id} customer={c} onClose={() => setEditingId(null)} />
          ) : (
            <CustomerCard
              key={c.id}
              customer={c}
              language={i18n.language}
              onEdit={() => setEditingId(c.id)}
            />
          ),
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto border border-line rounded-2xl bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-bg/50">
            <tr className="text-left text-ink-muted">
              <th scope="col" className="px-4 py-3 font-medium text-xs uppercase tracking-[0.1em]">
                {t('customers.col_customer')}
              </th>
              <th scope="col" className="px-4 py-3 font-medium text-xs uppercase tracking-[0.1em]">
                {t('customers.col_contact')}
              </th>
              <th
                scope="col"
                className="px-4 py-3 font-medium text-xs uppercase tracking-[0.1em] text-right"
              >
                {t('customers.col_bookings')}
              </th>
              <th
                scope="col"
                className="px-4 py-3 font-medium text-xs uppercase tracking-[0.1em] text-right"
              >
                {t('customers.col_spent')}
              </th>
              <th scope="col" className="px-4 py-3 font-medium text-xs uppercase tracking-[0.1em]">
                {t('customers.col_last_visit')}
              </th>
              <th scope="col" className="px-4 py-3 font-medium text-xs uppercase tracking-[0.1em]">
                {t('customers.col_status')}
              </th>
              <th scope="col" className="px-4 py-3 w-12">
                <span className="sr-only">{t('customers.col_actions_label')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) =>
              editingId === c.id ? (
                <CustomerEditRow key={c.id} customer={c} onClose={() => setEditingId(null)} />
              ) : (
                <tr
                  key={c.id}
                  className="border-b border-line last:border-b-0 hover:bg-bg/40 transition"
                >
                  <td className="px-4 py-3 align-middle">
                    <div className="flex items-center gap-3">
                      <span
                        className="inline-flex items-center justify-center w-9 h-9 rounded-pill bg-ink text-bg font-medium text-sm shrink-0"
                        aria-hidden
                      >
                        {(c.first_name?.[0] || c.phone?.[0] || '?').toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <Link
                          to={`/customers/${c.id}`}
                          className="block text-ink font-medium truncate hover:text-accent transition"
                        >
                          {c.first_name} {c.last_name}
                        </Link>
                        <div className="text-xs text-ink-muted truncate">ID #{c.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className="flex flex-col gap-0.5">
                      <a
                        href={`tel:${c.phone}`}
                        className="inline-flex items-center gap-1.5 text-ink hover:text-accent transition tabular-nums"
                      >
                        <Phone className="h-3.5 w-3.5 text-ink-muted" />
                        {c.phone}
                      </a>
                      {c.email ? (
                        <a
                          href={`mailto:${c.email}`}
                          className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink transition truncate max-w-[200px]"
                        >
                          <Mail className="h-3 w-3" />
                          {c.email}
                        </a>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted/60">
                          <Mail className="h-3 w-3" />
                          {t('customers.no_email')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-middle text-right font-medium tabular-nums">
                    {c.booking_count}
                  </td>
                  <td className="px-4 py-3 align-middle text-right font-medium tabular-nums">
                    {formatMoney(c.total_spent ?? 0, i18n.language)}
                  </td>
                  <td className="px-4 py-3 align-middle text-ink-muted text-xs">
                    {relativeTime(c.last_visit_at, i18n.language)}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <Badge variant={c.is_active ? 'success' : 'danger'}>
                      {c.is_active ? t('customers.active') : t('customers.inactive')}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex items-center justify-center w-9 h-9 rounded-pill text-ink-muted hover:bg-line/60 hover:text-ink transition"
                          aria-label={t('actions.row_actions_label')}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onSelect={() => navigate(`/customers/${c.id}`)}>
                          {t('customers.view')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setEditingId(c.id)}>
                          {t('customers.edit')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CustomerCard({
  customer,
  language,
  onEdit,
}: {
  customer: AdminCustomer;
  language: string;
  onEdit: () => void;
}) {
  const { t } = useTranslation('admin');
  return (
    <div className="bg-surface border border-line rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="inline-flex items-center justify-center w-9 h-9 rounded-pill bg-ink text-bg font-medium text-sm shrink-0">
          {(customer.first_name?.[0] || customer.phone?.[0] || '?').toUpperCase()}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-ink font-medium truncate">
            {customer.first_name} {customer.last_name}
          </div>
          <a
            href={`tel:${customer.phone}`}
            className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink transition tabular-nums"
          >
            <Phone className="h-3 w-3" />
            {customer.phone}
          </a>
        </div>
        <Badge variant={customer.is_active ? 'success' : 'danger'}>
          {customer.is_active ? t('customers.active') : t('customers.inactive')}
        </Badge>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-line">
        <div>
          <div className="text-[10px] uppercase tracking-[0.12em] text-ink-muted">
            {t('customers.col_bookings')}
          </div>
          <div className="font-display text-base text-ink tabular-nums">
            {customer.booking_count}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.12em] text-ink-muted">
            {t('customers.col_spent')}
          </div>
          <div className="font-display text-base text-ink tabular-nums">
            {formatMoney(customer.total_spent ?? 0, language)}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.12em] text-ink-muted">
            {t('customers.col_last_visit')}
          </div>
          <div className="text-xs text-ink">{relativeTime(customer.last_visit_at, language)}</div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button asChild variant="ghost" size="sm" className="rounded-pill">
          <Link to={`/customers/${customer.id}`}>{t('customers.view')}</Link>
        </Button>
        <Button variant="ghost" size="sm" onClick={onEdit} className="rounded-pill">
          {t('customers.edit')}
        </Button>
      </div>
    </div>
  );
}

function CustomerEditCard({ customer, onClose }: { customer: AdminCustomer; onClose: () => void }) {
  const { t } = useTranslation('admin');
  const [firstName, setFirstName] = useState(customer.first_name);
  const [lastName, setLastName] = useState(customer.last_name);
  const [email, setEmail] = useState(customer.email ?? '');
  const update = useAdminUpdateCustomer();

  const onSave = async () => {
    try {
      await update.mutateAsync({
        id: customer.id,
        first_name: firstName,
        last_name: lastName,
        email: email && email !== '' ? email : null,
      });
      onClose();
    } catch {
      /* surfaced */
    }
  };
  const toggleActive = () => update.mutate({ id: customer.id, is_active: !customer.is_active });

  return (
    <div className="bg-bg/60 border border-line rounded-2xl p-4 flex flex-col gap-3">
      <div className="text-xs text-ink-muted tabular-nums">{customer.phone}</div>
      <Input
        label={t('customers.first_name')}
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
      />
      <Input
        label={t('customers.last_name')}
        value={lastName}
        onChange={(e) => setLastName(e.target.value)}
      />
      <Input
        label={t('customers.email')}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <ErrorMessage error={update.error} />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleActive}
          loading={update.isPending}
          className="rounded-pill"
        >
          <Power className="h-3.5 w-3.5" />
          {customer.is_active ? t('customers.deactivate') : t('customers.reactivate')}
        </Button>
        <div className="ml-auto flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="rounded-pill"
            aria-label={t('actions.close')}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" onClick={onSave} loading={update.isPending} className="rounded-pill">
            <Save className="h-3.5 w-3.5" />
            {t('actions.save')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CustomerEditRow({ customer, onClose }: { customer: AdminCustomer; onClose: () => void }) {
  const { t } = useTranslation('admin');
  const [firstName, setFirstName] = useState(customer.first_name);
  const [lastName, setLastName] = useState(customer.last_name);
  const [email, setEmail] = useState(customer.email ?? '');
  const update = useAdminUpdateCustomer();

  const onSave = async () => {
    try {
      await update.mutateAsync({
        id: customer.id,
        first_name: firstName,
        last_name: lastName,
        email: email && email !== '' ? email : null,
      });
      onClose();
    } catch {
      /* surfaced */
    }
  };

  const toggleActive = () => update.mutate({ id: customer.id, is_active: !customer.is_active });

  return (
    <tr className="border-b border-line bg-bg/60">
      <td className="px-4 py-3 align-middle text-ink-muted text-xs tabular-nums">
        {customer.phone}
      </td>
      <td className="px-4 py-3 align-middle" colSpan={4}>
        <div className="grid sm:grid-cols-3 gap-2">
          <Input
            label={t('customers.first_name')}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <Input
            label={t('customers.last_name')}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
          <Input
            label={t('customers.email')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <ErrorMessage error={update.error} />
      </td>
      <td className="px-4 py-3 align-middle">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleActive}
          loading={update.isPending}
          className="rounded-pill"
        >
          <Power className="h-3.5 w-3.5" />
          {customer.is_active ? t('customers.deactivate') : t('customers.reactivate')}
        </Button>
      </td>
      <td className="px-4 py-3 align-middle text-right">
        <div className="flex gap-2 justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="rounded-pill"
            aria-label={t('actions.close')}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" onClick={onSave} loading={update.isPending} className="rounded-pill">
            <Save className="h-3.5 w-3.5" />
            {t('actions.save')}
          </Button>
        </div>
      </td>
    </tr>
  );
}
