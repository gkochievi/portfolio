import * as RSelect from '@radix-ui/react-select'
import * as RSwitch from '@radix-ui/react-switch'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import {
  cloneElement,
  forwardRef,
  isValidElement,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'

const controlBase =
  'w-full rounded-ctl border border-line-strong bg-panel text-sm text-ink transition-colors placeholder:text-subtle hover:border-muted/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-55 aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/20'

/* -------------------------------------------------------------------- Field */

export interface FieldProps {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  /** Shows "(optional)" after the label. */
  optional?: boolean
  /** A single control; Field wires id / aria-describedby / aria-invalid onto it. */
  children: ReactElement
  className?: string
  /** Put the label to the right of the control (Checkbox/Switch rows). */
  inline?: boolean
}

export function Field({ label, hint, error, optional, children, className, inline }: FieldProps) {
  const { t } = useTranslation('common')
  const auto = useId()
  const childProps = (isValidElement(children) ? (children.props as Record<string, unknown>) : {}) ?? {}
  const id = (childProps.id as string | undefined) ?? auto
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined
  const control = cloneElement(children as ReactElement<Record<string, unknown>>, {
    id,
    'aria-describedby': describedBy,
    'aria-invalid': error ? true : undefined,
  })
  return (
    <div className={cn(inline ? 'flex items-start gap-3' : 'flex flex-col gap-1.5', className)}>
      {inline ? control : null}
      {label ? (
        <label htmlFor={id} className={cn('text-[13px] font-medium text-ink', inline && 'pt-0.5')}>
          {label}
          {optional ? <span className="ml-1 font-normal text-muted">({t('optional')})</span> : null}
          {inline && hint ? <span id={`${id}-hint`} className="mt-0.5 block text-xs font-normal text-muted">{hint}</span> : null}
        </label>
      ) : null}
      {inline ? null : control}
      {!inline && hint && !error ? (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-err`} role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/* -------------------------------------------------------------------- Input */

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Icon inside the left edge. */
  leading?: ReactNode
  /** Element inside the right edge (unit, button). */
  trailing?: ReactNode
  size?: 'sm' | 'md'
  mono?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, leading, trailing, size = 'md', mono, ...props },
  ref,
) {
  const input = (
    <input
      ref={ref}
      className={cn(
        controlBase,
        size === 'sm' ? 'h-8 px-2.5 text-[13px]' : 'h-9 px-3',
        leading ? 'pl-9' : null,
        trailing ? 'pr-10' : null,
        mono && 'font-mono text-[13px]',
        !leading && !trailing && className,
      )}
      {...props}
    />
  )
  if (!leading && !trailing) return input
  return (
    <div className={cn('relative', className)}>
      {leading ? (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted [&_svg]:size-4 [&_svg]:stroke-[1.75]">
          {leading}
        </span>
      ) : null}
      {input}
      {trailing ? <span className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center text-muted">{trailing}</span> : null}
    </div>
  )
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { mono?: boolean }>(
  function Textarea({ className, mono, rows = 4, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={cn(controlBase, 'min-h-20 resize-y px-3 py-2 leading-relaxed', mono && 'font-mono text-[13px]', className)}
        {...props}
      />
    )
  },
)

/** Search box with a magnifier and a clear button. Controlled. */
export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
  size = 'md',
  autoFocus,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  size?: 'sm' | 'md'
  autoFocus?: boolean
}) {
  const { t } = useTranslation('common')
  return (
    <Input
      type="search"
      size={size}
      value={value}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? t('search.placeholder')}
      aria-label={placeholder ?? t('search.placeholder')}
      leading={<Search />}
      className={cn('min-w-0 sm:w-64 [&_input::-webkit-search-cancel-button]:hidden', className)}
      trailing={
        value ? (
          <button
            type="button"
            onClick={() => onChange('')}
            className="grid size-6 place-items-center rounded-md hover:bg-ink/6"
            aria-label={t('search.clear')}
          >
            <X className="size-3.5" />
          </button>
        ) : undefined
      }
    />
  )
}

/* ------------------------------------------------------------------- Select */

export interface SelectOption {
  value: string
  label: ReactNode
  /** Optional muted second line / right hint. */
  hint?: ReactNode
  disabled?: boolean
}

export interface SelectProps {
  value: string | undefined
  onValueChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  size?: 'sm' | 'md'
  className?: string
  id?: string
  'aria-label'?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

export function Select({ value, onValueChange, options, placeholder, disabled, size = 'md', className, ...aria }: SelectProps) {
  return (
    <RSelect.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <RSelect.Trigger
        {...aria}
        className={cn(
          controlBase,
          'inline-flex items-center justify-between gap-2 text-left data-[placeholder]:text-subtle',
          size === 'sm' ? 'h-8 px-2.5 text-[13px]' : 'h-9 px-3',
          className,
        )}
      >
        <span className="truncate">
          <RSelect.Value placeholder={placeholder} />
        </span>
        <RSelect.Icon>
          <ChevronDown className="size-4 text-muted" strokeWidth={1.75} />
        </RSelect.Icon>
      </RSelect.Trigger>
      <RSelect.Portal>
        <RSelect.Content
          position="popper"
          sideOffset={6}
          className="z-[60] max-h-[min(360px,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] animate-fade-in overflow-hidden rounded-card border border-line bg-panel shadow-pop"
        >
          <RSelect.Viewport className="p-1">
            {options.map((opt) => (
              <RSelect.Item
                key={opt.value}
                value={opt.value}
                disabled={opt.disabled}
                className="relative flex min-h-8 cursor-pointer select-none items-center gap-2 rounded-md py-1.5 pl-8 pr-3 text-sm outline-none data-[disabled]:opacity-45 data-[highlighted]:bg-ink/6"
              >
                <RSelect.ItemIndicator className="absolute left-2.5">
                  <Check className="size-4 text-primary" strokeWidth={2} />
                </RSelect.ItemIndicator>
                <RSelect.ItemText>{opt.label}</RSelect.ItemText>
                {opt.hint ? <span className="ml-auto pl-3 text-xs text-muted">{opt.hint}</span> : null}
              </RSelect.Item>
            ))}
          </RSelect.Viewport>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  )
}

/* ------------------------------------------------------------------- Switch */

export interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  label?: ReactNode
  description?: ReactNode
  id?: string
  className?: string
  size?: 'sm' | 'md'
  'aria-label'?: string
}

export function Switch({ checked, onCheckedChange, disabled, label, description, id, className, size = 'md', ...aria }: SwitchProps) {
  const auto = useId()
  const sid = id ?? auto
  const sw = (
    <RSwitch.Root
      id={sid}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={aria['aria-label']}
      className={cn(
        'relative inline-flex shrink-0 items-center rounded-pill border border-transparent bg-line-strong transition-colors data-[state=checked]:bg-primary disabled:opacity-50',
        size === 'sm' ? 'h-4.5 w-8' : 'h-5.5 w-10',
      )}
    >
      <RSwitch.Thumb
        className={cn(
          'block rounded-full bg-panel shadow-sm transition-transform translate-x-0.5',
          size === 'sm' ? 'size-3.5 data-[state=checked]:translate-x-[15px]' : 'size-4.5 data-[state=checked]:translate-x-[19px]',
        )}
      />
    </RSwitch.Root>
  )
  if (!label) return <span className={className}>{sw}</span>
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <span className="pt-0.5">{sw}</span>
      <label htmlFor={sid} className={cn('min-w-0 cursor-pointer text-sm', disabled && 'cursor-not-allowed opacity-60')}>
        <span className="font-medium">{label}</span>
        {description ? <span className="mt-0.5 block text-xs text-muted">{description}</span> : null}
      </label>
    </div>
  )
}

/* ----------------------------------------------------------------- Checkbox */

export interface CheckboxProps {
  checked: boolean | 'indeterminate'
  onCheckedChange: (checked: boolean) => void
  label?: ReactNode
  description?: ReactNode
  disabled?: boolean
  id?: string
  className?: string
  'aria-label'?: string
}

export function Checkbox({ checked, onCheckedChange, label, description, disabled, id, className, ...aria }: CheckboxProps) {
  const auto = useId()
  const cid = id ?? auto
  const box = (
    <span className="relative inline-grid size-4 shrink-0 place-items-center">
      <input
        id={cid}
        type="checkbox"
        disabled={disabled}
        aria-label={aria['aria-label']}
        checked={checked === true}
        ref={(el) => {
          if (el) el.indeterminate = checked === 'indeterminate'
        }}
        onChange={(e) => onCheckedChange(e.target.checked)}
        onClick={(e) => e.stopPropagation()}
        className="peer size-4 cursor-pointer appearance-none rounded-[4px] border border-line-strong bg-panel transition-colors checked:border-primary checked:bg-primary indeterminate:border-primary indeterminate:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
      />
      <Check
        className="pointer-events-none absolute size-3 text-on-primary opacity-0 peer-checked:opacity-100"
        strokeWidth={3}
        aria-hidden
      />
      <span className="pointer-events-none absolute h-0.5 w-2 rounded bg-on-primary opacity-0 peer-indeterminate:opacity-100" />
    </span>
  )
  if (!label) return <span className={cn('inline-flex', className)}>{box}</span>
  return (
    <label htmlFor={cid} className={cn('flex cursor-pointer items-start gap-2.5 text-sm', disabled && 'cursor-not-allowed opacity-60', className)}>
      <span className="pt-0.5">{box}</span>
      <span className="min-w-0">
        <span className="font-medium">{label}</span>
        {description ? <span className="mt-0.5 block text-xs text-muted">{description}</span> : null}
      </span>
    </label>
  )
}

/* ------------------------------------------------------------------- Slider */

export function Slider({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  disabled,
  id,
  className,
  format,
  'aria-label': ariaLabel,
}: {
  value: number
  onValueChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  id?: string
  className?: string
  /** Render the current value to the right (e.g. v => `${v}%`). */
  format?: (value: number) => ReactNode
  'aria-label'?: string
}) {
  const pct = ((value - min) / (max - min || 1)) * 100
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => onValueChange(Number(e.target.value))}
        style={{
          background: `linear-gradient(to right, var(--color-primary) ${pct}%, var(--color-line-strong) ${pct}%)`,
        }}
        className="h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-pill disabled:cursor-not-allowed disabled:opacity-50 [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:bg-panel [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-panel"
      />
      {format ? <span className="tabular min-w-10 text-right font-mono text-xs text-muted">{format(value)}</span> : null}
    </div>
  )
}

/* -------------------------------------------------------- SegmentedControl */

export function SegmentedControl<V extends string>({
  value,
  onValueChange,
  options,
  size = 'md',
  className,
  'aria-label': ariaLabel,
}: {
  value: V
  onValueChange: (value: V) => void
  options: { value: V; label: ReactNode; icon?: ReactNode; disabled?: boolean }[]
  size?: 'sm' | 'md'
  className?: string
  'aria-label'?: string
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn('inline-flex rounded-ctl border border-line bg-sunken p-0.5', className)}>
      {options.map((opt) => {
        const on = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={opt.disabled}
            onClick={() => onValueChange(opt.value)}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[6px] font-medium text-muted transition-colors hover:text-ink disabled:opacity-45 [&_svg]:size-4 [&_svg]:stroke-[1.75]',
              size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-[13px]',
              on && 'bg-panel text-ink shadow-[0_1px_0_var(--color-line)]',
            )}
          >
            {opt.icon}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
