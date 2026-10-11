import { useId, type ReactNode } from 'react'
import * as RSwitch from '@radix-ui/react-switch'

import { cn } from '@/lib/cn'

export interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label?: ReactNode
  description?: ReactNode
  disabled?: boolean
  size?: 'sm' | 'md'
  id?: string
  'aria-label'?: string
  /** Put the switch on the right of the label (settings rows). */
  labelFirst?: boolean
  className?: string
}

/** Radix switch: olive track when on. */
export function Switch({ checked, onCheckedChange, label, description, disabled, size = 'md', id, labelFirst, className, ...rest }: SwitchProps) {
  const auto = useId()
  const sid = id ?? `sw-${auto.replace(/:/g, '')}`
  const control = (
    <RSwitch.Root
      id={sid}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={rest['aria-label']}
      className={cn(
        'relative inline-flex shrink-0 items-center rounded-full border-[1.5px] border-line-strong bg-sunken transition-colors duration-150 ease-chirp data-[state=checked]:border-accent data-[state=checked]:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-5 w-9' : 'h-6 w-11',
      )}
    >
      <RSwitch.Thumb
        className={cn(
          'block rounded-full bg-line-strong transition-transform duration-150 ease-chirp data-[state=checked]:bg-on-accent',
          size === 'sm' ? 'size-3.5 translate-x-0.5 data-[state=checked]:translate-x-[17px]' : 'size-4 translate-x-[3px] data-[state=checked]:translate-x-[22px]',
        )}
      />
    </RSwitch.Root>
  )
  if (!label && !description) return <span className={className}>{control}</span>
  const text = (
    <label htmlFor={sid} className={cn('flex min-w-0 flex-col', disabled ? 'cursor-not-allowed' : 'cursor-pointer')}>
      {label ? <span className="text-sm text-ink">{label}</span> : null}
      {description ? <span className="text-xs text-muted">{description}</span> : null}
    </label>
  )
  return (
    <div className={cn('flex items-start gap-3', labelFirst && 'justify-between', disabled && 'opacity-70', className)}>
      {labelFirst ? (
        <>
          {text}
          {control}
        </>
      ) : (
        <>
          {control}
          {text}
        </>
      )}
    </div>
  )
}
