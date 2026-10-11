import * as SelectPrimitive from '@radix-ui/react-select'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import { Check, ChevronDown, Minus, Search, X } from 'lucide-react'
import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'
import { TONE_LIST, toneClasses } from '@/lib/tone'
import type { Tone } from '@/types'

export const controlClass =
  'w-full rounded-control border border-hairline-strong bg-panel text-ink placeholder:text-muted/80 transition-colors hover:border-ink/40 focus-visible:border-ink disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger dark:bg-sunken'

/* ------------------------------------------------------------------- Field */

export interface FieldProps {
  label?: ReactNode
  /** Help text under the control. */
  hint?: ReactNode
  /** Error text; also turns the label red. */
  error?: ReactNode
  required?: boolean
  /** id of the control the label points at. */
  htmlFor?: string
  children: ReactNode
  className?: string
  /** Something on the right of the label row (e.g. a counter or a link). */
  aside?: ReactNode
}

export function Field({ label, hint, error, required, htmlFor, children, className, aside }: FieldProps) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      {(label || aside) && (
        <div className="flex items-baseline justify-between gap-2">
          {label && (
            <label htmlFor={htmlFor} className={cn('text-[13px] font-medium text-ink', error && 'text-danger')}>
              {label}
              {required && <span className="ml-0.5 text-danger" aria-hidden>*</span>}
            </label>
          )}
          {aside && <span className="text-xs text-muted">{aside}</span>}
        </div>
      )}
      {children}
      {error ? (
        <p className="text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------- Input */

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: 'sm' | 'md'
  /** Icon inside the left edge. */
  icon?: ReactNode
  /** Element inside the right edge (unit, button). */
  suffix?: ReactNode
  invalid?: boolean
  /** Monospace (phones, IDs, extensions). */
  mono?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, size = 'md', icon, suffix, invalid, mono, ...props },
  ref,
) {
  const input = (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        controlClass,
        size === 'sm' ? 'h-8 px-2.5 text-[13px]' : 'h-9 px-3 text-sm',
        icon && (size === 'sm' ? 'pl-8' : 'pl-9'),
        suffix && 'pr-10',
        mono && 'font-mono tabular',
        !icon && !suffix && className,
      )}
      {...props}
    />
  )
  if (!icon && !suffix) return input
  return (
    <div className={cn('relative w-full', className)}>
      {icon && (
        <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-muted [&_svg]:size-4">{icon}</span>
      )}
      {input}
      {suffix && <span className="absolute inset-y-0 right-1.5 flex items-center text-xs text-muted">{suffix}</span>}
    </div>
  )
})

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ className, invalid, rows = 3, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(controlClass, 'min-h-[72px] resize-y px-3 py-2 text-sm leading-relaxed', className)}
      {...props}
    />
  )
})

export interface SearchInputProps extends Omit<InputProps, 'onChange' | 'value' | 'icon'> {
  value: string
  onChange: (value: string) => void
}

/** Text input with a search icon and a clear (x) button. */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { value, onChange, placeholder, className, size = 'md', ...props },
  ref,
) {
  const { t } = useTranslation()
  return (
    <Input
      ref={ref}
      type="search"
      size={size}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? t('actions.search')}
      icon={<Search strokeWidth={1.75} />}
      className={cn('sm:w-64 [&_input::-webkit-search-cancel-button]:hidden', className)}
      suffix={
        value ? (
          <button
            type="button"
            onClick={() => onChange('')}
            className="grid size-6 place-items-center rounded-[4px] text-muted hover:bg-sunken hover:text-ink"
            aria-label={t('actions.clear')}
          >
            <X size={14} strokeWidth={2} />
          </button>
        ) : undefined
      }
      {...props}
    />
  )
})

/** Native date input (value: yyyy-mm-dd). */
export const DateInput = forwardRef<HTMLInputElement, Omit<InputProps, 'type'>>(function DateInput(props, ref) {
  return <Input ref={ref} type="date" mono {...props} />
})

/** Native datetime-local input (value: yyyy-mm-ddThh:mm). */
export const DateTimeInput = forwardRef<HTMLInputElement, Omit<InputProps, 'type'>>(function DateTimeInput(props, ref) {
  return <Input ref={ref} type="datetime-local" mono {...props} />
})

/* ------------------------------------------------------------------ Select */

export interface SelectOption<V extends string = string> {
  value: V
  label: ReactNode
  /** Small leading element (dot, icon). */
  icon?: ReactNode
  disabled?: boolean
  /** Muted second line. */
  description?: ReactNode
}

export interface SelectProps<V extends string = string> {
  value: V | undefined
  onValueChange: (value: V) => void
  options: SelectOption<V>[]
  placeholder?: ReactNode
  size?: 'sm' | 'md'
  disabled?: boolean
  invalid?: boolean
  className?: string
  id?: string
  'aria-label'?: string
  /** Left adornment inside the trigger. */
  icon?: ReactNode
}

/** Radix select. Option values must be non-empty strings (use 'all' for "any"). */
export function Select<V extends string = string>({
  value,
  onValueChange,
  options,
  placeholder,
  size = 'md',
  disabled,
  invalid,
  className,
  id,
  icon,
  ...aria
}: SelectProps<V>) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={(v) => onValueChange(v as V)} disabled={disabled}>
      <SelectPrimitive.Trigger
        id={id}
        aria-label={aria['aria-label']}
        aria-invalid={invalid || undefined}
        className={cn(
          controlClass,
          'inline-flex items-center gap-2 text-left',
          size === 'sm' ? 'h-8 px-2.5 text-[13px]' : 'h-9 px-3 text-sm',
          'data-[placeholder]:text-muted',
          className,
        )}
      >
        {icon && <span className="text-muted [&_svg]:size-4">{icon}</span>}
        <span className="min-w-0 flex-1 truncate">
          <SelectPrimitive.Value placeholder={placeholder} />
        </span>
        <SelectPrimitive.Icon>
          <ChevronDown size={16} strokeWidth={1.75} className="text-muted" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className="dk-popover z-[60] max-h-[min(360px,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-card border border-hairline bg-panel text-ink shadow-pop"
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((opt) => (
              <SelectPrimitive.Item
                key={opt.value}
                value={opt.value}
                disabled={opt.disabled}
                className="relative flex min-h-9 cursor-pointer select-none items-center gap-2 rounded-[5px] py-1.5 pl-8 pr-3 text-sm outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-sunken data-[disabled]:opacity-45"
              >
                <SelectPrimitive.ItemIndicator className="absolute left-2.5 inline-flex">
                  <Check size={15} strokeWidth={2.25} />
                </SelectPrimitive.ItemIndicator>
                {opt.icon}
                <span className="min-w-0">
                  <SelectPrimitive.ItemText>{opt.label}</SelectPrimitive.ItemText>
                  {opt.description && <span className="block text-xs text-muted">{opt.description}</span>}
                </span>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}

/* ------------------------------------------------------- Checkbox / Switch */

export interface CheckboxProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label?: ReactNode
  description?: ReactNode
  indeterminate?: boolean
  disabled?: boolean
  id?: string
  className?: string
  'aria-label'?: string
}

export function Checkbox({ checked, onCheckedChange, label, description, indeterminate, disabled, id, className, ...aria }: CheckboxProps) {
  const autoId = useId()
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate)
  }, [indeterminate])
  const inputId = id ?? autoId
  const on = checked || indeterminate
  return (
    <label htmlFor={inputId} className={cn('inline-flex cursor-pointer select-none items-start gap-2.5', disabled && 'cursor-not-allowed opacity-50', className)}>
      <span className="relative mt-px inline-grid size-[18px] shrink-0 place-items-center">
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onCheckedChange(e.target.checked)}
          aria-label={aria['aria-label']}
          className="peer absolute inset-0 m-0 cursor-[inherit] appearance-none rounded-[4px] border border-hairline-strong bg-panel transition-colors checked:border-carbon checked:bg-carbon indeterminate:border-carbon indeterminate:bg-carbon dark:bg-sunken dark:checked:border-lime dark:checked:bg-lime dark:indeterminate:border-lime dark:indeterminate:bg-lime"
        />
        {on && (
          <span className="pointer-events-none relative text-lime dark:text-on-lime">
            {indeterminate ? <Minus size={13} strokeWidth={3} /> : <Check size={13} strokeWidth={3} />}
          </span>
        )}
      </span>
      {(label || description) && (
        <span className="min-w-0 text-sm leading-tight">
          {label}
          {description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
        </span>
      )}
    </label>
  )
}

export interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label?: ReactNode
  description?: ReactNode
  disabled?: boolean
  id?: string
  className?: string
  'aria-label'?: string
}

export function Switch({ checked, onCheckedChange, label, description, disabled, id, className, ...aria }: SwitchProps) {
  const autoId = useId()
  const switchId = id ?? autoId
  const control = (
    <SwitchPrimitive.Root
      id={switchId}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={aria['aria-label']}
      className="relative inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full border border-hairline-strong bg-sunken transition-colors disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-carbon data-[state=checked]:bg-carbon dark:data-[state=checked]:border-lime dark:data-[state=checked]:bg-lime"
    >
      <SwitchPrimitive.Thumb className="block size-4 translate-x-[2px] rounded-full bg-muted transition-transform duration-150 data-[state=checked]:translate-x-[18px] data-[state=checked]:bg-lime dark:data-[state=checked]:bg-on-lime" />
    </SwitchPrimitive.Root>
  )
  if (!label && !description) return <span className={className}>{control}</span>
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <label htmlFor={switchId} className={cn('min-w-0 cursor-pointer text-sm', disabled && 'cursor-not-allowed opacity-60')}>
        <span className="font-medium">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
      </label>
      {control}
    </div>
  )
}

/* --------------------------------------------------------------- Segmented */

export interface SegmentedProps<V extends string = string> {
  value: V
  onChange: (value: V) => void
  options: { value: V; label: ReactNode; icon?: ReactNode; disabled?: boolean }[]
  size?: 'sm' | 'md'
  className?: string
  'aria-label'?: string
}

/** A compact radio group drawn as a segmented control. */
export function Segmented<V extends string = string>({ value, onChange, options, size = 'md', className, ...aria }: SegmentedProps<V>) {
  return (
    <div
      role="radiogroup"
      aria-label={aria['aria-label']}
      className={cn('inline-flex rounded-control border border-hairline bg-sunken p-0.5', size === 'sm' ? 'h-8' : 'h-9', className)}
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={opt.disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              'inline-flex min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[4px] px-3 font-medium text-muted transition-colors hover:text-ink disabled:opacity-40 [&_svg]:size-4',
              size === 'sm' ? 'text-xs' : 'text-[13px]',
              active && 'bg-panel text-ink shadow-[0_0_0_1px_var(--color-hairline)] dark:bg-carbon',
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

/* -------------------------------------------------------- ToneSwatchPicker */

export function ToneSwatchPicker({ value, onChange, className }: { value: Tone; onChange: (tone: Tone) => void; className?: string }) {
  const { t } = useTranslation()
  return (
    <div role="radiogroup" aria-label={t('tones.label')} className={cn('flex flex-wrap gap-2', className)}>
      {TONE_LIST.map((tone) => {
        const active = tone === value
        return (
          <button
            key={tone}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={t(`tones.${tone}`)}
            title={t(`tones.${tone}`)}
            onClick={() => onChange(tone)}
            className={cn(
              'grid size-8 place-items-center rounded-full border-2 transition-transform hover:scale-105',
              active ? 'border-ink' : 'border-transparent',
            )}
          >
            <span className={cn('size-5 rounded-full', toneClasses(tone).dot, tone === 'lime' && 'ring-1 ring-ink/20')} />
          </button>
        )
      })}
    </div>
  )
}
