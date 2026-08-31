import { useTranslation } from 'react-i18next';
import { formatTbilisiTime } from '@/lib/datetime';
import { cn } from '@/lib/cn';

interface Props {
  startAt: string;
  selected?: boolean;
  onClick: () => void;
}

export function SlotButton({ startAt, selected, onClick }: Props) {
  const { i18n } = useTranslation();
  // Always the shop's wall time — a 14:00 Tbilisi slot must read 14:00
  // no matter what timezone the visitor's device is set to.
  const time = formatTbilisiTime(startAt, i18n.language);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'px-3 py-2 rounded-md border text-sm font-medium transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        selected ? 'border-ink bg-ink text-bg' : 'border-line bg-surface text-ink hover:border-ink',
      )}
    >
      {time}
    </button>
  );
}
