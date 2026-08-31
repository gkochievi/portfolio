import { ArrowRight, Clock, Scissors } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { pickLocalized } from '@/lib/localized';
import { SERVICE_ICONS } from '@/lib/serviceIcons';
import type { ServiceItem } from '../hooks';

function ServiceVisual({ service, className }: { service: ServiceItem; className?: string }) {
  if (service.image) {
    return (
      <div className={cn('overflow-hidden bg-bg', className)}>
        <img
          src={service.image}
          alt=""
          className="w-full h-full object-cover photo-warm"
          loading="lazy"
        />
      </div>
    );
  }
  if (service.icon_key) {
    const def = SERVICE_ICONS.find((i) => i.key === service.icon_key);
    if (def) {
      const Icon = def.Icon;
      return (
        // Accent-soft is never a large fill — icon carries the accent instead.
        <div className={cn('bg-bg text-accent flex items-center justify-center', className)}>
          <Icon className="h-9 w-9" />
        </div>
      );
    }
  }
  return (
    <div className={cn('bg-line/40 text-ink-muted flex items-center justify-center', className)}>
      <Scissors className="h-7 w-7" />
    </div>
  );
}

export function ServiceCard({
  service,
  selected,
  onChoose,
}: {
  service: ServiceItem;
  selected?: boolean;
  onChoose?: (s: ServiceItem) => void;
}) {
  const { t, i18n } = useTranslation('services');
  const name = pickLocalized(service.name, service.name_en, i18n.language);
  const description = pickLocalized(service.description, service.description_en, i18n.language);
  return (
    <button
      type="button"
      onClick={() => onChoose?.(service)}
      aria-pressed={Boolean(selected)}
      className={cn(
        'group flex flex-col text-left border rounded-2xl overflow-hidden transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        selected
          ? 'border-ink bg-surface shadow-[var(--shadow-soft)]'
          : 'border-line bg-surface hover:border-line-strong',
      )}
    >
      <ServiceVisual service={service} className="aspect-[4/3] w-full border-b border-line" />
      <div className="flex flex-col gap-2 p-5 flex-1">
        <h3 className="font-display text-lg text-ink leading-tight">{name}</h3>
        {description && <p className="text-ink-muted text-sm line-clamp-2">{description}</p>}
        <div className="mt-auto flex items-center justify-between pt-3 border-t border-line">
          <span className="inline-flex items-center gap-1 text-xs uppercase tracking-wider text-ink-muted">
            <Clock className="h-3 w-3" />
            {t('duration', { minutes: service.duration_minutes })}
          </span>
          <span className="inline-flex items-center gap-1.5 font-display text-base text-ink">
            {t('price', { price: service.price })}
            {!selected && (
              <ArrowRight className="h-3.5 w-3.5 text-accent opacity-0 group-hover:opacity-100 transition" />
            )}
          </span>
        </div>
      </div>
    </button>
  );
}
