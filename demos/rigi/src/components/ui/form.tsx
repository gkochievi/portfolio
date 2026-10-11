import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import * as RadixSelect from '@radix-ui/react-select'
import * as RadixSwitch from '@radix-ui/react-switch'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'

const control =
  'w-full min-w-0 rounded-md border border-hairline-strong bg-panel text-ink text-sm transition-[border-color,box-shadow] duration-150 ease-rigi hover:border-ink/35 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger'

/* ------------------------------------------------------------------ Label */

export function Label({ className, children, required, ...props }: React.LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }) {
  return (
    <label className={cn('text-xs font-medium leading-4 text-ink', className)} {...props}>
      {children}
      {required ? <span className="ml-0.5 text-danger" aria-hidden>*</span> : null}
    </label>
  )
}

/* ------------------------------------------------------------------ Field */

export interface FieldProps {
  label?: ReactNode
  hint?: ReactNode
  error?: string | null | undefined
  required?: boolean
  /** id of the control; generated and passed to the child via `htmlFor` when omitted. */
  htmlFor?: string
  className?: string
  children: ReactNode
  /** Put the label beside the control (switches, checkboxes). */
  inline?: boolean
}

/** Label + control + hint/error. Pass `htmlFor` = the control's id for click-to-focus. */
export function Field({ label, hint, error, required, htmlFor, className, children, inline }: FieldProps) {
  return (
    <div className={cn(inline ? 'flex items-center justify-between gap-3' : 'flex flex-col gap-1.5', className)}>
      {label ? <Label htmlFor={htmlFor} required={required}>{label}</Label> : null}
      {children}
      {error ? (
        <p className="text-xs text-danger" role="alert">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ Input */

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  invalid?: boolean
  /** Icon inside the left edge. */
  icon?: ReactNode
  /** Text or node inside the right edge (unit, currency). */
  suffix?: ReactNode
  size?: 'sm' | 'md'
  mono?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, icon, suffix, size = 'md', mono, ...props },
  ref,
) {
  const input = (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        control,
        size === 'sm' ? 'h-8 px-2.5 text-[13px]' : 'h-9 px-3',
        icon ? 'pl-8' : null,
        suffix ? 'pr-12' : null,
        mono && 'font-mono text-[13px]',
        props.type === 'number' && 'num',
        !icon && !suffix && className,
      )}
      {...props}
    />
  )
  if (!icon && !suffix) return input
  return (
    <div className={cn('relative w-full', className)}>
      {icon ? (
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted [&_svg]:size-4 [&_svg]:stroke-[1.75]">{icon}</span>
      ) : null}
      {input}
      {suffix ? <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">{suffix}</span> : null}
    </div>
  )
})

/* --------------------------------------------------------------- Textarea */

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
  mono?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, mono, rows = 4, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(control, 'min-h-[72px] px-3 py-2 leading-5', mono && 'font-mono text-[13px]', className)}
      {...props}
    />
  )
})

/* ----------------------------------------------------------- NativeSelect */

export interface NativeSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  invalid?: boolean
  size?: 'sm' | 'md'
  /** Shorthand for <option>s. Children are rendered after these. */
  options?: ReadonlyArray<{ value: string; label: string; disabled?: boolean }>
  placeholder?: string
}

/** Styled native <select>; best with react-hook-form `register`. */
export const NativeSelect = forwardRef<HTMLSelectElement, NativeSelectProps>(function NativeSelect(
  { className, invalid, size = 'md', options, placeholder, children, ...props },
  ref,
) {
  return (
    <div className={cn('relative w-full', className)}>
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(control, 'appearance-none pr-8', size === 'sm' ? 'h-8 pl-2.5 text-[13px]' : 'h-9 pl-3')}
        {...props}
      >
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options?.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>
        ))}
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 stroke-[1.75] text-muted" aria-hidden />
    </div>
  )
})

/* ----------------------------------------------------------- Select (Radix) */

export interface SelectProps {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  size?: 'sm' | 'md'
  className?: string
  id?: string
  name?: string
  'aria-label'?: string
  children: ReactNode
}

/** Radix select. Item values must be non-empty strings (use 'all' for "any"). */
export function Select({ value, defaultValue, onValueChange, placeholder, disabled, invalid, size = 'md', className, id, name, children, ...rest }: SelectProps) {
  return (
    <RadixSelect.Root value={value} defaultValue={defaultValue} onValueChange={onValueChange} disabled={disabled} name={name}>
      <RadixSelect.Trigger
        id={id}
        aria-label={rest['aria-label']}
        aria-invalid={invalid || undefined}
        className={cn(
          control,
          'inline-flex items-center justify-between gap-2 text-left data-[placeholder]:text-subtle',
          size === 'sm' ? 'h-8 px-2.5 text-[13px]' : 'h-9 px-3',
          className,
        )}
      >
        <span className="truncate"><RadixSelect.Value placeholder={placeholder} /></span>
        <RadixSelect.Icon>
          <ChevronDown className="size-4 shrink-0 stroke-[1.75] text-muted" aria-hidden />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={4}
          className="z-50 max-h-[min(360px,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-hairline bg-panel text-ink shadow-overlay animate-pop"
        >
          <RadixSelect.Viewport className="p-1">{children}</RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  )
}

export function SelectItem({ value, children, disabled, className }: { value: string; children: ReactNode; disabled?: boolean; className?: string }) {
  return (
    <RadixSelect.Item
      value={value}
      disabled={disabled}
      className={cn(
        'relative flex h-8 cursor-default select-none items-center rounded-md pl-7 pr-3 text-[13px] outline-none data-[disabled]:opacity-50 data-[highlighted]:bg-row-hover',
        className,
      )}
    >
      <RadixSelect.ItemIndicator className="absolute left-2 inline-flex">
        <Check className="size-3.5 stroke-[2] text-primary" aria-hidden />
      </RadixSelect.ItemIndicator>
      <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
    </RadixSelect.Item>
  )
}

/* --------------------------------------------------------------- Checkbox */

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: ReactNode
  description?: ReactNode
  indeterminate?: boolean
}

/** Native checkbox (works with `register`), square signal fill. */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, description, indeterminate, className, id, ...props },
  ref,
) {
  const auto = useId()
  const inner = useRef<HTMLInputElement | null>(null)
  useEffect(() => {
    if (inner.current) inner.current.indeterminate = Boolean(indeterminate)
  }, [indeterminate])
  const box = (
    <input
      ref={(node) => {
        inner.current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) ref.current = node
      }}
      id={id ?? auto}
      type="checkbox"
      className={cn('size-4 shrink-0 cursor-pointer rounded-[3px] border-hairline-strong accent-[var(--primary)] disabled:cursor-not-allowed', !label && className)}
      {...props}
    />
  )
  if (!label) return box
  return (
    <label htmlFor={id ?? auto} className={cn('flex cursor-pointer items-start gap-2 text-sm', props.disabled && 'cursor-not-allowed opacity-60', className)}>
      <span className="mt-0.5 flex">{box}</span>
      <span className="flex flex-col">
        <span>{label}</span>
        {description ? <span className="text-xs text-muted">{description}</span> : null}
      </span>
    </label>
  )
})

/* ----------------------------------------------------------------- Switch */

export interface SwitchProps {
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  label?: ReactNode
  description?: ReactNode
  id?: string
  className?: string
  'aria-label'?: string
}

export function Switch({ checked, defaultChecked, onCheckedChange, disabled, label, description, id, className, ...rest }: SwitchProps) {
  const auto = useId()
  const sw = (
    <RadixSwitch.Root
      id={id ?? auto}
      checked={checked}
      defaultChecked={defaultChecked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={rest['aria-label']}
      className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-[5px] border border-hairline-strong bg-sunken transition-colors duration-150 ease-rigi disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
    >
      <RadixSwitch.Thumb className="block size-3.5 translate-x-[2px] rounded-[3px] bg-panel shadow-sm ring-1 ring-ink/10 transition-transform duration-150 ease-rigi data-[state=checked]:translate-x-[17px]" />
    </RadixSwitch.Root>
  )
  if (!label) return <span className={className}>{sw}</span>
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <label htmlFor={id ?? auto} className="flex cursor-pointer flex-col text-sm">
        <span className="font-medium">{label}</span>
        {description ? <span className="text-xs text-muted">{description}</span> : null}
      </label>
      {sw}
    </div>
  )
}

/* ------------------------------------------------------------ SearchInput */

export interface SearchInputProps {
  value: string
  /** Called after `debounce` ms of quiet (0 = immediately). */
  onChange: (value: string) => void
  placeholder?: string
  debounce?: number
  className?: string
  autoFocus?: boolean
  'aria-label'?: string
}

export function SearchInput({ value, onChange, placeholder, debounce = 200, className, autoFocus, ...rest }: SearchInputProps) {
  const { t } = useTranslation('common')
  const [draft, setDraft] = useState(value)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => setDraft(value), [value])
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const push = (next: string) => {
    setDraft(next)
    window.clearTimeout(timer.current)
    if (debounce <= 0) onChange(next)
    else timer.current = window.setTimeout(() => onChange(next), debounce)
  }
  return (
    <div className={cn('relative w-full sm:w-64', className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 stroke-[1.75] text-muted" aria-hidden />
      <input
        type="search"
        value={draft}
        autoFocus={autoFocus}
        onChange={(e) => push(e.target.value)}
        placeholder={placeholder ?? t('actions.search')}
        aria-label={rest['aria-label'] ?? placeholder ?? t('actions.search')}
        className={cn(control, 'h-9 pl-8 pr-8 [&::-webkit-search-cancel-button]:hidden')}
      />
      {draft ? (
        <button
          type="button"
          onClick={() => push('')}
          aria-label={t('actions.clear')}
          className="absolute right-1.5 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded text-muted hover:text-ink"
        >
          <X className="size-3.5 stroke-[1.75]" aria-hidden />
        </button>
      ) : null}
    </div>
  )
}
