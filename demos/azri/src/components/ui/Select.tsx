/**
 * Select on Radix. Options are plain data; an option with value '' is allowed
 * (use it for "All ..."), it is mapped internally because Radix forbids ''.
 * Owner: design-system agent.
 */
import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'
import { controlClass, useFieldControl } from './Field'

export interface SelectOption {
  value: string
  label: ReactNode
  /** Plain-text label for the closed trigger when `label` is rich. */
  textValue?: string
  description?: ReactNode
  /** Leading visual (TenantMark, dot, icon). */
  icon?: ReactNode
  disabled?: boolean
}

export interface SelectProps {
  value: string
  onValueChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  /** 'field' = form input look; 'pill' = compact filter-bar pill. */
  variant?: 'field' | 'pill'
  size?: 'sm' | 'md'
  disabled?: boolean
  invalid?: boolean
  id?: string
  className?: string
  'aria-label'?: string
  /** Leading icon inside the trigger. */
  icon?: ReactNode
}

const EMPTY = '__azri_empty__'
const toRadix = (value: string) => (value === '' ? EMPTY : value)
const fromRadix = (value: string) => (value === EMPTY ? '' : value)

export function Select({
  value,
  onValueChange,
  options,
  placeholder,
  variant = 'field',
  size = 'md',
  disabled,
  invalid,
  id,
  className,
  icon,
  ...rest
}: SelectProps) {
  const field = useFieldControl()
  const hasValue = options.some((option) => option.value === value)
  return (
    <SelectPrimitive.Root
      value={hasValue ? toRadix(value) : ''}
      onValueChange={(next) => onValueChange(fromRadix(next))}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        id={id ?? field?.id}
        aria-label={rest['aria-label']}
        aria-invalid={invalid || field?.invalid || undefined}
        aria-describedby={field?.describedBy}
        className={cn(
          'group inline-flex min-w-0 items-center gap-2 text-left data-[placeholder]:text-subtle [&>span]:min-w-0 [&>span]:truncate',
          variant === 'field'
            ? cn(controlClass, size === 'sm' ? 'h-9 px-3 text-[13px]' : 'h-10 px-3.5 text-sm')
            : cn(
                'rounded-full border border-border-strong bg-panel font-medium text-ink transition-colors hover:border-ink/35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60',
                size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-9 px-3.5 text-[13px]',
              ),
          className,
        )}
      >
        {icon && <span className="shrink-0 text-muted [&_svg]:size-4">{icon}</span>}
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon className="ml-auto shrink-0 text-muted transition-transform group-data-[state=open]:rotate-180">
          <ChevronDown className="size-4" strokeWidth={1.75} />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          collisionPadding={8}
          className="z-[60] max-h-[min(360px,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] animate-fade-in overflow-hidden rounded-[14px] border border-border bg-panel text-sm text-ink shadow-float"
        >
          <SelectPrimitive.Viewport className="p-1.5">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value || EMPTY}
                value={toRadix(option.value)}
                disabled={option.disabled}
                textValue={option.textValue}
                className="relative flex min-h-9 cursor-pointer select-none items-center gap-2.5 rounded-[10px] py-1.5 pl-2.5 pr-8 outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-ink/6 data-[state=checked]:font-semibold data-[disabled]:opacity-50"
              >
                {option.icon && <span className="shrink-0">{option.icon}</span>}
                <span className="flex min-w-0 flex-col">
                  <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                  {option.description && <span className="text-xs font-normal text-muted">{option.description}</span>}
                </span>
                <SelectPrimitive.ItemIndicator className="absolute right-2.5 text-primary">
                  <Check className="size-4" strokeWidth={2} />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}
