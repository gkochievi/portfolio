import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { SectionError } from '@/components/SectionError';
import { Stat } from '@/components/Stat';
import { useAnalyticsBarberDetail, type AnalyticsRange } from '../analytics-hooks';
import { formatMoney, tbilisiYmdOffset, todayTbilisiYmd } from '@/lib/datetime';
import { pickLocalized } from '@/lib/localized';

function defaultRange(): AnalyticsRange {
  // Shop-local (Tbilisi) calendar dates, not UTC — same as the Analytics page.
  return { date_from: tbilisiYmdOffset(-29), date_to: todayTbilisiYmd() };
}

/**
 * "Analytics" tab on the barber detail page (spec §9.4) — per-barber KPIs,
 * revenue series, and top services from /admin/analytics/barber/{id}/.
 */
export function BarberAnalyticsTab({ barberId }: { barberId: number }) {
  const { t, i18n } = useTranslation('admin');
  const [range, setRange] = useState<AnalyticsRange>(defaultRange());
  const detail = useAnalyticsBarberDetail(barberId, range);

  const revenueChart = useMemo(
    () =>
      (detail.data?.revenue ?? []).map((p) => ({
        date: p.date,
        revenue: Number(p.revenue),
        count: p.count,
      })),
    [detail.data?.revenue],
  );

  const summary = detail.data?.summary;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="grid sm:grid-cols-2 gap-3">
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
        </div>
      </Card>

      {detail.isError ? (
        <SectionError error={detail.error} onRetry={() => detail.refetch()} />
      ) : detail.isLoading ? (
        <Card>
          <p role="status" aria-live="polite" className="text-ink-muted text-sm">
            {t('actions.loading')}
          </p>
        </Card>
      ) : (
        summary && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Stat label={t('analytics_page.kpi_total')} value={summary.total_bookings} />
              <Stat
                label={t('analytics_page.kpi_completed')}
                value={summary.completed_bookings}
                variant="success"
              />
              <Stat
                label={t('analytics_page.kpi_completion')}
                value={`${(summary.completion_rate * 100).toFixed(0)}%`}
              />
              <Stat
                label={t('analytics_page.kpi_revenue')}
                value={formatMoney(summary.revenue_completed, i18n.language)}
                variant="ink"
              />
              <Stat
                label={t('analytics_page.kpi_avg_ticket')}
                value={formatMoney(summary.avg_ticket_size, i18n.language)}
              />
              <Stat
                label={t('analytics_page.kpi_no_show')}
                value={`${(summary.no_show_rate * 100).toFixed(0)}%`}
              />
            </div>

            <Card>
              <h2 className="font-display text-xl mb-4 tracking-tight">
                {t('analytics_page.section_revenue')}
              </h2>
              {revenueChart.length === 0 ? (
                <p className="text-ink-muted text-sm">{t('analytics_page.no_revenue')}</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
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

            <Card>
              <h2 className="font-display text-xl mb-4 tracking-tight">
                {t('analytics_page.section_top_services')}
              </h2>
              {(detail.data?.top_services.length ?? 0) === 0 ? (
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
                    {detail.data?.top_services.map((s) => (
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
          </>
        )
      )}
    </div>
  );
}
