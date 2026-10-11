/** Radix Select styled as a Tova control. Values must be non-empty strings. */
import * as RS from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'
import { controlBase } from './Field'

export interface SelectOption {
  value: string
  label: ReactNode
  /** Extra content shown in the list only (a status badge, a count). */
  hint?: ReactNode
  disabled?: boolean
}

export interface SelectProps {
  value: string | undefined
  onValueChange: (value: string) => void
  options: SelectOption[]
  placeholder?: ReactNode
  disabled?: boolean
  invalid?: boolean
  id?: string
  name?: string
  size?: 'sm' | 'md'
  className?: string
  /** Required when there is no visible <Label htmlFor>. */
  'aria-label'?: string
  /** Leading icon inside the trigger. */
  icon?: ReactNode
}

export function Select({
  value,
  onValueChange,
  options,
  placeholder,
  disabled,
  invalid,
  id,
  name,
  size = 'md',
  className,
  icon,
  ...rest
}: SelectProps) {
  return (
    <RS.Root value={value ?? ''} onValueChange={onValueChange} disabled={disabled} name={name}>
      <RS.Trigger
        id={id}
        aria-label={rest['aria-label']}
        aria-invalid={invalid || undefined}
        className={cn(
          controlBase,
          'flex items-center gap-2 px-3 text-left data-[placeholder]:text-muted',
          size === 'sm' ? 'h-9 text-sm' : 'h-11',
          className,
        )}
      >
        {icon && <span className="shrink-0 text-muted [&_svg]:size-[18px]">{icon}</span>}
        <span className="min-w-0 flex-1 truncate">
          <RS.Value placeholder={placeholder} />
        </span>
        <RS.Icon asChild>
          <ChevronDown className="size-4 shrink-0 text-muted" aria-hidden />
        </RS.Icon>
      </RS.Trigger>
      <RS.Portal>
        <RS.Content
          position="popper"
          sideOffset={6}
          collisionPadding={12}
          className="z-[80] max-h-[min(360px,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-card border-[1.5px] border-line bg-panel text-ink shadow-pop data-[state=open]:animate-fade-in"
        >
          <RS.Viewport className="p-1">
            {options.map((option) => (
              <RS.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className="relative flex min-h-10 cursor-pointer select-none items-center gap-2 rounded-chip py-2 pl-8 pr-3 text-[15px] outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-sunken data-[state=checked]:font-semibold data-[disabled]:opacity-50"
              >
                <RS.ItemIndicator className="absolute left-2 inline-flex">
                  <Check className="size-4 text-primary" />
                </RS.ItemIndicator>
                <span className="min-w-0 flex-1 truncate">
                  <RS.ItemText>{option.label}</RS.ItemText>
                </span>
                {option.hint && <span className="shrink-0">{option.hint}</span>}
              </RS.Item>
            ))}
          </RS.Viewport>
        </RS.Content>
      </RS.Portal>
    </RS.Root>
  )
}
