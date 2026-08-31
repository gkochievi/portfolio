import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export type DatePreset = 'all' | 'today' | 'last7' | 'last30' | 'thisMonth' | 'custom';

const VALID_PRESETS: DatePreset[] = ['today', 'last7', 'last30', 'thisMonth', 'custom'];

const isoDate = (d: Date) => {
  // YYYY-MM-DD in local time. Avoids the UTC shift toISOString() would
  // introduce — the admin thinks in their own day boundaries.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const computeRange = (preset: Exclude<DatePreset, 'all' | 'custom'>): { from: string; to: string } => {
  const today = new Date();
  const to = isoDate(today);
  if (preset === 'today') return { from: to, to };
  if (preset === 'thisMonth') {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: isoDate(first), to };
  }
  // last7 spans 7 days inclusive of today, so subtract 6
  const days = preset === 'last7' ? 6 : 29;
  const start = new Date(today);
  start.setDate(start.getDate() - days);
  return { from: isoDate(start), to };
};

/**
 * Shared date-range filter hook for admin list pages.
 *
 * URL state:
 *   - rolling preset: ?datePreset=last7 (dates recomputed at render time)
 *   - custom range:   ?datePreset=custom&dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD
 *   - "all":          no params
 *
 * The hook returns:
 *   - preset: the active preset name
 *   - effectiveFrom / effectiveTo: ISO date strings to send to the API
 *   - dateFromParam / dateToParam: the raw URL values (for binding to date inputs in custom mode)
 *   - onPresetChange / onCustomDateChange: handlers that mutate URL state
 */
export function useDateRangeFilter() {
  const [searchParams, setSearchParams] = useSearchParams();

  const dateFromParam = searchParams.get('dateFrom') ?? '';
  const dateToParam = searchParams.get('dateTo') ?? '';
  const datePresetParam = searchParams.get('datePreset') as DatePreset | null;

  const preset: DatePreset =
    datePresetParam && VALID_PRESETS.includes(datePresetParam)
      ? datePresetParam
      : dateFromParam || dateToParam
        ? 'custom'
        : 'all';

  const { effectiveFrom, effectiveTo } = useMemo(() => {
    if (preset === 'all') return { effectiveFrom: '', effectiveTo: '' };
    if (preset === 'custom')
      return { effectiveFrom: dateFromParam, effectiveTo: dateToParam };
    const { from, to } = computeRange(preset);
    return { effectiveFrom: from, effectiveTo: to };
  }, [preset, dateFromParam, dateToParam]);

  const onPresetChange = (next: DatePreset) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'all') {
      params.delete('datePreset');
      params.delete('dateFrom');
      params.delete('dateTo');
    } else if (next === 'custom') {
      params.set('datePreset', 'custom');
      if (!dateFromParam && !dateToParam) {
        const today = isoDate(new Date());
        params.set('dateFrom', today);
        params.set('dateTo', today);
      }
    } else {
      params.set('datePreset', next);
      params.delete('dateFrom');
      params.delete('dateTo');
    }
    setSearchParams(params, { replace: true });
  };

  const onCustomDateChange = (key: 'dateFrom' | 'dateTo', value: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('datePreset', 'custom');
    if (value) params.set(key, value);
    else params.delete(key);
    setSearchParams(params, { replace: true });
  };

  return {
    preset,
    dateFromParam,
    dateToParam,
    effectiveFrom,
    effectiveTo,
    onPresetChange,
    onCustomDateChange,
  };
}
