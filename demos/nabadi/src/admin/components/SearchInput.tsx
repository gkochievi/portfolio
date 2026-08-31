import { Search } from 'lucide-react';
import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const SearchInput = forwardRef<HTMLInputElement, Props>(function SearchInput(
  { label, className, id, ...props },
  ref,
) {
  const reactId = useId();
  const inputId = id || reactId;
  return (
    <label htmlFor={inputId} className="flex flex-col gap-1.5 w-full">
      {label && <span className="text-sm font-medium text-ink">{label}</span>}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted pointer-events-none" />
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'h-11 pl-10 pr-3.5 w-full bg-surface-2 border border-line rounded-md text-[15px] text-ink',
            'placeholder:text-ink-muted/60',
            'focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15',
            'transition',
            className,
          )}
          {...props}
        />
      </div>
    </label>
  );
});
