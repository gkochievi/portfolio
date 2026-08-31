import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ChipOption {
  value: string;
  label: React.ReactNode;
}

interface MultiSelectChipsProps {
  options: ChipOption[];
  values: string[];
  onChange: (values: string[]) => void;
  className?: string;
}

const MultiSelectChips = ({ options, values, onChange, className }: MultiSelectChipsProps) => {
  const toggle = (value: string) => {
    onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);
  };

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {options.map((opt) => {
        const active = values.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1 text-xs md:text-sm rounded-full border transition-colors',
              active
                ? 'border-gold bg-gold/10 text-foreground'
                : 'border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground',
            )}
          >
            {active && <Check size={12} />}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default MultiSelectChips;
