import { useTranslation } from 'react-i18next'

import { Field, FilterBar, NativeSelect } from '@/components/ui'
import { monthName } from '@/lib/format'

import { reportYears } from '../api'

/** Year (required) and month filters shared by the two reports. */
export function PeriodFilters({
  year,
  month,
  allowAllMonths,
  onYear,
  onMonth,
}: {
  year: number
  month: number | null
  allowAllMonths: boolean
  onYear: (year: number) => void
  onMonth: (month: number | null) => void
}) {
  const { t } = useTranslation(['ledger', 'common'])
  const years = reportYears()
  if (!years.includes(year)) years.push(year)
  return (
    <FilterBar>
      <Field label={t('reports.filters.year')} htmlFor="rep-year" required inline>
        <NativeSelect
          id="rep-year"
          size="sm"
          value={year}
          onChange={(e) => onYear(Number(e.target.value))}
          options={years.sort((a, b) => b - a).map((y) => ({ value: String(y), label: String(y) }))}
        />
      </Field>
      <Field label={t('reports.filters.month')} htmlFor="rep-month" inline>
        <NativeSelect
          id="rep-month"
          size="sm"
          value={month === null ? '' : String(month)}
          onChange={(e) => onMonth(e.target.value ? Number(e.target.value) : null)}
          options={[
            ...(allowAllMonths ? [{ value: '', label: t('reports.filters.allMonths') }] : []),
            ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: monthName(i + 1) })),
          ]}
        />
      </Field>
    </FilterBar>
  )
}
