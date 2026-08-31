import { Check } from 'lucide-react';
import { Badge } from '@/components/Badge';
import { cn } from '@/lib/cn';
import type { BarberItem } from '../hooks';

export function BarberCard({
  barber,
  selected,
  onChoose,
}: {
  barber: BarberItem;
  selected?: boolean;
  onChoose?: (b: BarberItem) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChoose?.(barber)}
      aria-pressed={Boolean(selected)}
      className={cn(
        'flex gap-4 p-4 text-left border rounded-2xl transition relative',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        selected
          ? 'border-ink bg-surface shadow-[var(--shadow-soft)]'
          : 'border-line bg-surface hover:border-line-strong',
      )}
    >
      {barber.photo ? (
        <img
          src={barber.photo}
          alt={`${barber.first_name} ${barber.last_name}`}
          className="w-20 h-24 object-cover rounded-sm border border-line shrink-0"
        />
      ) : (
        <div className="w-20 h-24 bg-bg border border-line rounded-sm shrink-0 flex items-center justify-center text-ink-muted/30 font-display text-2xl">
          {barber.first_name?.[0] ?? '?'}
        </div>
      )}
      <div className="flex-1 flex flex-col gap-1.5">
        <h3 className="font-display text-lg text-ink">
          {barber.first_name} {barber.last_name}
        </h3>
        {barber.bio && <p className="text-ink-muted text-sm line-clamp-2">{barber.bio}</p>}
        {barber.specialties.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-auto">
            {barber.specialties.slice(0, 3).map((s) => (
              <Badge key={s.id}>{s.name}</Badge>
            ))}
          </div>
        )}
      </div>
      {selected && (
        <span
          aria-hidden
          className="absolute top-3 right-3 h-6 w-6 rounded-pill bg-ink text-bg flex items-center justify-center"
        >
          <Check className="h-3.5 w-3.5" />
        </span>
      )}
    </button>
  );
}
