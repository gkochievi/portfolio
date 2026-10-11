import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Check, Minus } from 'lucide-react'

import { cn } from '@/lib/cn'

export interface CheckboxProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label?: ReactNode
  description?: ReactNode
  indeterminate?: boolean
  disabled?: boolean
  id?: string
  name?: string
  'aria-label'?: string
  className?: string
}

/** Native checkbox, drawn in olive. */
export function Checkbox({ checked, onCheckedChange, label, description, indeterminate, disabled, id, name, className, ...rest }: CheckboxProps) {
  const auto = useId()
  const inputId = id ?? `cb-${auto.replace(/:/g, '')}`
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate)
  }, [indeterminate])
  const on = checked || indeterminate
  return (
    <label htmlFor={inputId} className={cn('inline-flex items-start gap-2.5', disabled ? 'cursor-not-allowed opacity-55' : 'cursor-pointer', className)}>
      <span className="relative mt-[1px] grid size-[18px] shrink-0 place-items-center">
        <input
          ref={ref}
          id={inputId}
          name={name}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          aria-label={rest['aria-label']}
          onChange={(e) => onCheckedChange(e.target.checked)}
          className="peer absolute inset-0 m-0 cursor-[inherit] appearance-none rounded-[5px] border-[1.5px] border-line-strong bg-panel transition-colors checked:border-accent checked:bg-accent indeterminate:border-accent indeterminate:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
        {on ? (
          <span className="pointer-events-none relative text-on-accent">
            {indeterminate ? <Minus size={13} strokeWidth={3} /> : <Check size={13} strokeWidth={3} />}
          </span>
        ) : null}
      </span>
      {label || description ? (
        <span className="flex flex-col">
          {label ? <span className="text-sm leading-5 text-ink">{label}</span> : null}
          {description ? <span className="text-xs text-muted">{description}</span> : null}
        </span>
      ) : null}
    </label>
  )
}
