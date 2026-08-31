import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Download } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { SectionError } from '@/components/SectionError';
import { Stat } from '@/components/Stat';
import { useAdminBarbers } from '@/features/admin/hooks';
import {
  downloadAnalyticsXlsx,
  useAnalyticsByStatus,
  useAnalyticsRevenue,
  useAnalyticsSummary,
  useAnalyticsTopBarbers,
  useAnalyticsTopServices,
  type AnalyticsRange,
} from '@/features/admin/analytics-hooks';
import { useMutationFeedback } from '@/features/admin/mutation-feedback';
import { formatMoney, tbilisiYmdOffset, todayTbilisiYmd } from '@/lib/datetime';
import { pickLocalized } from '@/lib/localized';

const STATUS_COLORS: Record<string, string> = {
  pending: '#8f5d33',
  confirmed: '#20180f',
  completed: '#497155',
  cancelled: '#b04545',
  no_show: '#70675e',
};

function defaultRange(): AnalyticsRange {
  // Shop-local (Tbilisi) calendar dates, not UTC.
  return { date_from: tbilisiYmdOffset(-29), date_to: todayTbilisiYmd(), barber_id: null };
}

export function AdminAnalytics() {
  const { t, i18n } = useTranslation('admin');
  const [range, setRange] = useState<AnalyticsRange>(defaultRange());
  const [exporting, setExporting] = useState(false);
  const feedback = useMutationFeedback();

  const summary = useAnalyticsSummary(range);
  const revenue = useAnalyticsRevenue(range);
  const byStatus = useAnalyticsByStatus(range);
  const topServices = useAnalyticsTopServices(range);
  const topBarbers = useAnalyticsTopBarbers(range);
  const barbers = useAdminBarbers();

  const isPerBarber = range.barber_id !== null && range.barber_id !== undefined;

  const onExport = async () => {
    setExporting(true);
    try {
      await downloadAnalyticsXlsx(range);
    } catch (err) {
      feedback.error(err);
    } finally {
      setExporting(false);
    }
  };

  const revenueChart = useMemo(
    () =>
      (revenue.data ?? []).map((p) => ({
        date: p.date,
        revenue: Number(p.revenue),
        count: p.count,
      })),
    [revenue.data],
  );
  const statusChart = useMemo(
    () =>
      (byStatus.data ?? []).map((row) => ({
        // Recharts feeds `name` straight into the legend/tooltip — translate
        // the raw status key so the chart isn't showing machine keys.
        name: t(`status.${row.status}`, { defaultValue: row.status }),
        status: row.status,
        value: row.count,
      })),
    [byStatus.data, t],
  );

  const exportLabel = isPerBarber
    ? t('analytics_page.export_barber')
    : t('analytics_page.export_overall');

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={t('page.analytics')}
        title={t('page.analytics')}
        subtitle={t('analytics_page.subtitle')}
        actions={
          <Button variant="primary" onClick={onExport} loading={exporting} className="rounded-pill">
            <Download className="h-4 w-4" />
            {exportLabel}
          </Button>
        }
      />

      {/* Filters: date range + barber */}
      <Card>
        <div className="grid sm:grid-cols-3 gap-3">
          <Input
            label={t('analytics_page.f_from')}
            type="date"
            value={range.date_from ?? ''}
            onChange={(e) => setRange({ ...range, date_from: e.target.value || undefined })}
          />
          <Input
            label={t('analytics_page.f_to')}
            type="date"
            value={range.date_to ?? ''}
            onChange={(e) => setRange({ ...range, date_to: e.target.value || undefined })}
          />
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">
              {t('analytics_page.barber_select')}
            </span>
            <select
              value={range.barber_id ?? ''}
              onChange={(e) =>
                setRange({
                  ...range,
                  barber_id: e.target.value ? Number(e.target.value) : null,
                })
              }
              className="h-11 px-3.5 bg-surface-2 border border-line rounded-md text-[15px] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
            >
              <option value="">{t('analytics_page.all_barbers')}</option>
              {(barbers.data ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.user_first_name} {b.user_last_name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      {summary.isError && <SectionError error={summary.error} onRetry={() => summary.refetch()} />}

      {summary.data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label={t('analytics_page.kpi_total')} value={summary.data.total_bookings} />
          <Stat
            label={t('analytics_page.kpi_completed')}
            value={summary.data.completed_bookings}
            variant="success"
          />
          <Stat
            label={t('analytics_page.kpi_completion')}
            value={`${(summary.data.completion_rate * 100).toFixed(0)}%`}
          />
          <Stat
            label={t('analytics_page.kpi_revenue')}
            value={formatMoney(summary.data.revenue_completed, i18n.language)}
            variant="ink"
          />
          <Stat
            label={t('analytics_page.kpi_avg_ticket')}
            value={formatMoney(summary.data.avg_ticket_size, i18n.language)}
          />
          <Stat
            label={t('analytics_page.kpi_unique_customers')}
            value={summary.data.unique_customers}
          />
          <Stat
            label={t('analytics_page.kpi_cancellation')}
            value={`${(summary.data.cancellation_rate * 100).toFixed(0)}%`}
            variant="danger"
          />
          <Stat
            label={t('analytics_page.kpi_no_show')}
            value={`${(summary.data.no_show_rate * 100).toFixed(0)}%`}
          />
        </div>
      )}

      <Card>
        <h2 className="font-display text-xl mb-4 tracking-tight">
          {t('analytics_page.section_revenue')}
        </h2>
        {revenue.isLoading ? (
          <p role="status" aria-live="polite" className="text-ink-muted text-sm">
            {t('actions.loading')}
          </p>
        ) : revenueChart.length === 0 ? (
          <p className="text-ink-muted text-sm">{t('analytics_page.no_revenue')}</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={revenueChart}>
              <CartesianGrid stroke="#e6dec9" strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke="#70675e" fontSize={12} />
              <YAxis stroke="#70675e" fontSize={12} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#8f5d33"
                strokeWidth={2}
                dot={{ r: 3, fill: '#8f5d33' }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <h2 className="font-display text-xl mb-4 tracking-tight">
            {t('analytics_page.section_status')}
          </h2>
          {byStatus.isLoading ? (
            <p role="status" aria-live="polite" className="text-ink-muted text-sm">
              {t('actions.loading')}
            </p>
          ) : statusChart.length === 0 ? (
            <p className="text-ink-muted text-sm">{t('analytics_page.no_bookings')}</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={statusChart}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label
                >
                  {statusChart.map((row) => (
                    <Cell key={row.status} fill={STATUS_COLORS[row.status] ?? '#70675e'} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card>
          <h2 className="font-display text-xl mb-4 tracking-tight">
            {t('analytics_page.section_daily')}
          </h2>
          {revenue.isLoading ? (
            <p role="status" aria-live="polite" className="text-ink-muted text-sm">
              {t('actions.loading')}
            </p>
          ) : revenueChart.length === 0 ? (
            <p className="text-ink-muted text-sm">{t('analytics_page.no_data')}</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={revenueChart}>
                <CartesianGrid stroke="#e6dec9" strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke="#70675e" fontSize={12} />
                <YAxis stroke="#70675e" fontSize={12} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#8f5d33" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <div className={isPerBarber ? '' : 'grid md:grid-cols-2 gap-4'}>
        <Card>
          <h2 className="font-display text-xl mb-4 tracking-tight">
            {t('analytics_page.section_top_services')}
          </h2>
          {(topServices.data?.length ?? 0) === 0 ? (
            <p className="text-ink-muted text-sm">{t('analytics_page.no_completed')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-line">
                <tr className="text-left text-ink-muted">
                  <th
                    scope="col"
                    className="px-2 py-2 font-medium text-xs uppercase tracking-[0.1em]"
                  >
                    {t('analytics_page.col_service')}
                  </th>
                  <th
                    scope="col"
                    className="px-2 py-2 font-medium text-xs uppercase tracking-[0.1em] text-right"
                  >
                    {t('analytics_page.col_count')}
                  </th>
                  <th
                    scope="col"
                    className="px-2 py-2 font-medium text-xs uppercase tracking-[0.1em] text-right"
                  >
                    {t('analytics_page.col_revenue')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {topServices.data?.map((s) => (
                  <tr key={s.service_id} className="border-b border-line last:border-b-0">
                    <td className="px-2 py-2.5 text-ink">
                      {pickLocalized(s.service_name, s.service_name_en, i18n.language)}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{s.count}</td>
                    <td className="px-2 py-2.5 text-right font-medium tabular-nums">
                      {formatMoney(s.revenue, i18n.language)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {/* Top barbers card only when viewing all barbers */}
        {!isPerBarber && (
          <Card>
            <h2 className="font-display text-xl mb-4 tracking-tight">
              {t('analytics_page.section_top_barbers')}
            </h2>
            {(topBarbers.data?.length ?? 0) === 0 ? (
              <p className="text-ink-muted text-sm">{t('analytics_page.no_completed')}</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-line">
                  <tr className="text-left text-ink-muted">
                    <th
                      scope="col"
                      className="px-2 py-2 font-medium text-xs uppercase tracking-[0.1em]"
                    >
                      {t('analytics_page.col_barber')}
                    </th>
                    <th
                      scope="col"
                      className="px-2 py-2 font-medium text-xs uppercase tracking-[0.1em] text-right"
                    >
                      {t('analytics_page.col_count')}
                    </th>
                    <th
                      scope="col"
                      className="px-2 py-2 font-medium text-xs uppercase tracking-[0.1em] text-right"
                    >
                      {t('analytics_page.col_revenue')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {topBarbers.data?.map((b) => (
                    <tr key={b.barber_id} className="border-b border-line last:border-b-0">
                      <td className="px-2 py-2.5 text-ink">
                        {b.first_name} {b.last_name}
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{b.count}</td>
                      <td className="px-2 py-2.5 text-right font-medium tabular-nums">
                        {formatMoney(b.revenue, i18n.language)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
