import type { ReactNode } from 'react'
import * as RS from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'

import { cn } from '@/lib/cn'

export interface SelectOption<V extends string = string> {
  value: V
  label: ReactNode
  /** Plain-text label for typeahead when `label` is not a string. */
  textValue?: string
  icon?: ReactNode
  description?: ReactNode
  disabled?: boolean
}

export interface SelectProps<V extends string = string> {
  value: V | undefined
  onValueChange: (value: V) => void
  options: readonly SelectOption<V>[]
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  size?: 'sm' | 'md'
  id?: string
  name?: string
  'aria-label'?: string
  className?: string
  contentClassName?: string
}

/** Radix select with brand styling. Values must be non-empty strings. */
export function Select<V extends string = string>({
  value,
  onValueChange,
  options,
  placeholder,
  disabled,
  invalid,
  size = 'md',
  id,
  name,
  className,
  contentClassName,
  ...rest
}: SelectProps<V>) {
  return (
    <RS.Root value={value} onValueChange={(v) => onValueChange(v as V)} disabled={disabled} name={name}>
      <RS.Trigger
        id={id}
        aria-label={rest['aria-label']}
        aria-invalid={invalid || undefined}
        className={cn(
          'inline-flex w-full min-w-0 items-center justify-between gap-2 rounded-ui border border-line-strong bg-panel px-3 text-left text-ink transition-colors hover:border-ink/60 focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-accent/40 disabled:opacity-55 aria-[invalid=true]:border-danger data-[placeholder]:text-muted [&>span]:truncate',
          size === 'sm' ? 'h-8 text-[13px]' : 'h-9 text-sm',
          className,
        )}
      >
        <RS.Value placeholder={placeholder} />
        <RS.Icon className="shrink-0 text-muted">
          <ChevronDown size={16} strokeWidth={1.75} />
        </RS.Icon>
      </RS.Trigger>
      <RS.Portal>
        <RS.Content
          position="popper"
          sideOffset={6}
          className={cn(
            'z-[60] max-h-[min(360px,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-ui border border-line bg-panel text-ink shadow-pop animate-pop-in',
            contentClassName,
          )}
        >
          <RS.Viewport className="p-1">
            {options.map((o) => (
              <RS.Item
                key={o.value}
                value={o.value}
                disabled={o.disabled}
                textValue={o.textValue ?? (typeof o.label === 'string' ? o.label : o.value)}
                className="relative flex cursor-default select-none items-center gap-2 rounded-md py-1.5 pl-2 pr-8 text-sm outline-none data-[disabled]:opacity-45 data-[highlighted]:bg-hover data-[state=checked]:font-medium"
              >
                {o.icon ? <span className="flex text-muted [&_svg]:size-4">{o.icon}</span> : null}
                <span className="flex min-w-0 flex-col">
                  <RS.ItemText>{o.label}</RS.ItemText>
                  {o.description ? <span className="text-xs text-muted">{o.description}</span> : null}
                </span>
                <RS.ItemIndicator className="absolute right-2 text-accent">
                  <Check size={16} strokeWidth={2} />
                </RS.ItemIndicator>
              </RS.Item>
            ))}
          </RS.Viewport>
        </RS.Content>
      </RS.Portal>
    </RS.Root>
  )
}
