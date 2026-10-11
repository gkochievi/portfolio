import * as RSwitch from '@radix-ui/react-switch'
import { useId, type ReactNode } from 'react'

import { cn } from '@/lib/cn'

export interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  /** Visible label to the right; otherwise pass aria-label. */
  label?: ReactNode
  description?: ReactNode
  id?: string
  'aria-label'?: string
  className?: string
}

export function Switch({ checked, onCheckedChange, disabled, label, description, id, className, ...rest }: SwitchProps) {
  const generated = useId()
  const switchId = id ?? generated
  const control = (
    <RSwitch.Root
      id={switchId}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={rest['aria-label']}
      className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-[1.5px] border-line-strong bg-sunken transition-colors data-[state=checked]:border-primary data-[state=checked]:bg-primary disabled:cursor-not-allowed disabled:opacity-50"
    >
      <RSwitch.Thumb className="block size-[18px] translate-x-[2px] rounded-full bg-panel shadow-[0_1px_2px_rgb(11_42_49/0.3)] transition-transform data-[state=checked]:translate-x-[20px] data-[state=checked]:bg-on-primary" />
    </RSwitch.Root>
  )
  if (!label && !description) return <span className={className}>{control}</span>
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <span className="mt-0.5">{control}</span>
      <label htmlFor={switchId} className={cn('min-w-0 cursor-pointer', disabled && 'cursor-not-allowed opacity-60')}>
        {label && <span className="block text-[15px] font-medium leading-snug text-ink">{label}</span>}
        {description && <span className="block text-sm text-muted">{description}</span>}
      </label>
    </div>
  )
}
