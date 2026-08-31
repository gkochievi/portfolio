import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { DatePreset } from '@/hooks/use-date-range-filter';

/**
 * Shared "All time / Today / Last 7 days / … / Custom range" Select with
 * custom-mode date inputs revealed below. Wire up via useDateRangeFilter.
 */
const DateRangeFilter = ({
  preset,
  dateFromParam,
  dateToParam,
  onPresetChange,
  onCustomDateChange,
  className,
}: {
  preset: DatePreset;
  dateFromParam: string;
  dateToParam: string;
  onPresetChange: (next: DatePreset) => void;
  onCustomDateChange: (key: 'dateFrom' | 'dateTo', value: string) => void;
  className?: string;
}) => {
  const { t } = useTranslation();
  return (
    <div className={className}>
      <Select value={preset} onValueChange={(v) => onPresetChange(v as DatePreset)}>
        <SelectTrigger className="sm:w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('admin.dateFilter.all', { defaultValue: 'All time' })}</SelectItem>
          <SelectItem value="today">{t('admin.dateFilter.today', { defaultValue: 'Today' })}</SelectItem>
          <SelectItem value="last7">{t('admin.dateFilter.last7', { defaultValue: 'Last 7 days' })}</SelectItem>
          <SelectItem value="last30">{t('admin.dateFilter.last30', { defaultValue: 'Last 30 days' })}</SelectItem>
          <SelectItem value="thisMonth">{t('admin.dateFilter.thisMonth', { defaultValue: 'This month' })}</SelectItem>
          <SelectItem value="custom">{t('admin.dateFilter.custom', { defaultValue: 'Custom range…' })}</SelectItem>
        </SelectContent>
      </Select>

      {preset === 'custom' && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">
            {t('admin.dateFilter.from', { defaultValue: 'From' })}
          </span>
          <Input
            type="date"
            value={dateFromParam}
            max={dateToParam || undefined}
            onChange={(e) => onCustomDateChange('dateFrom', e.target.value)}
            className="w-40"
          />
          <span className="text-muted-foreground">
            {t('admin.dateFilter.to', { defaultValue: 'to' })}
          </span>
          <Input
            type="date"
            value={dateToParam}
            min={dateFromParam || undefined}
            onChange={(e) => onCustomDateChange('dateTo', e.target.value)}
            className="w-40"
          />
        </div>
      )}
    </div>
  );
};

export default DateRangeFilter;
