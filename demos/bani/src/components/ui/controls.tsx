/** Buttons and form controls. */
import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react'
import { Slot } from '@radix-ui/react-slot'
import * as SelectPrimitive from '@radix-ui/react-select'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import { Command } from 'cmdk'
import { cva, type VariantProps } from 'class-variance-authority'
import { Check, ChevronDown, ChevronsUpDown, Copy, Loader2, Search, X, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'

/* ------------------------------------------------------------------ Spinner */

export function Spinner({ className, size = 16, label }: { className?: string; size?: number; label?: string }) {
  return (
    <Loader2
      className={cn('animate-spin-slow shrink-0 text-current', className)}
      style={{ width: size, height: size }}
      strokeWidth={2}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  )
}

/* ------------------------------------------------------------------- Button */

const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[8px] font-medium transition-[background-color,border-color,color,opacity] duration-[160ms] ease-out disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus select-none',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-on-primary hover:bg-primary-hover',
        secondary: 'border border-line-strong bg-panel text-ink hover:bg-hover',
        ghost: 'text-ink hover:bg-hover',
        danger: 'border border-danger/70 bg-transparent text-danger hover:bg-danger/10',
        link: 'h-auto px-0 text-primary underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3 text-[13px]',
        md: 'h-9 px-4 text-sm',
      },
    },
    compoundVariants: [{ variant: 'link', className: 'h-auto px-0' }],
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
)

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean
  icon?: LucideIcon
  /** Icon after the label. */
  iconRight?: LucideIcon
  asChild?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, loading, icon: Icon, iconRight: IconRight, asChild, className, children, disabled, type, ...rest },
  ref,
) {
  const iconSize = size === 'sm' ? 15 : 16
  if (asChild) {
    return (
      <Slot ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...rest}>
        {children}
      </Slot>
    )
  }
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size }), className)}
      {...rest}
    >
      {loading ? <Spinner size={iconSize} /> : Icon ? <Icon size={iconSize} strokeWidth={1.75} aria-hidden /> : null}
      {children}
      {IconRight && !loading ? <IconRight size={iconSize} strokeWidth={1.75} aria-hidden /> : null}
    </button>
  )
})

/* --------------------------------------------------------------- IconButton */

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  label: string
  icon: LucideIcon
  size?: 'sm' | 'md'
  variant?: 'ghost' | 'secondary' | 'danger'
  /** Show the label as a tooltip (title). Default true. */
  showTitle?: boolean
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon: Icon, size = 'md', variant = 'ghost', showTitle = true, className, type, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      aria-label={label}
      title={showTitle ? label : undefined}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-[8px] transition-colors duration-[160ms] ease-out disabled:opacity-50 disabled:pointer-events-none',
        size === 'sm' ? 'h-7 w-7' : 'h-9 w-9',
        variant === 'ghost' && 'text-muted hover:bg-hover hover:text-ink',
        variant === 'secondary' && 'border border-line-strong bg-panel text-ink hover:bg-hover',
        variant === 'danger' && 'text-danger hover:bg-danger/10',
        className,
      )}
      {...rest}
    >
      <Icon size={size === 'sm' ? 15 : 18} strokeWidth={1.75} aria-hidden />
    </button>
  )
})

/* -------------------------------------------------------------------- Field */

export interface FieldProps {
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  /** Optional id to wire the label; otherwise the label wraps the control. */
  htmlFor?: string
  required?: boolean
  className?: string
  children: ReactNode
}

export function Field({ label, hint, error, htmlFor, required, className, children }: FieldProps) {
  const Wrapper = htmlFor ? 'div' : 'label'
  return (
    <Wrapper className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      {htmlFor ? (
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink">
          {label}
          {required && <span className="ml-0.5 text-danger">*</span>}
        </label>
      ) : (
        <span className="text-[13px] font-medium text-ink">
          {label}
          {required && <span className="ml-0.5 text-danger">*</span>}
        </span>
      )}
      {children}
      {error ? (
        <span role="alert" className="text-[12.5px] text-danger">
          {error}
        </span>
      ) : hint ? (
        <span className="text-[12.5px] text-muted">{hint}</span>
      ) : null}
    </Wrapper>
  )
}

/* -------------------------------------------------------------------- Input */

const controlBase =
  'w-full min-w-0 rounded-[8px] border border-line-strong bg-panel px-3 text-sm text-ink placeholder:text-faint transition-colors duration-[160ms] ease-out hover:border-muted/60 focus:border-primary focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
  mono?: boolean
  /** Icon at the left inside the field. */
  icon?: LucideIcon
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, mono, icon: Icon, ...rest },
  ref,
) {
  const input = (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(controlBase, 'h-9', mono && 'font-mono text-[13px] tabular', Icon && 'pl-9', className)}
      {...rest}
    />
  )
  if (!Icon) return input
  return (
    <span className="relative flex w-full min-w-0 items-center">
      <Icon size={16} strokeWidth={1.75} className="pointer-events-none absolute left-3 text-muted" aria-hidden />
      {input}
    </span>
  )
})

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
  mono?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, mono, rows = 4, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(controlBase, 'min-h-[80px] py-2 leading-relaxed', mono && 'font-mono text-[13px]', className)}
      {...rest}
    />
  )
})

/* -------------------------------------------------------------- SearchInput */

export interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string
  onChange: (value: string) => void
  /** Called with the value after `debounceMs` of no typing (in addition to onChange). */
  onDebouncedChange?: (value: string) => void
  debounceMs?: number
}

export function SearchInput({
  value,
  onChange,
  onDebouncedChange,
  debounceMs = 250,
  placeholder,
  className,
  ...rest
}: SearchInputProps) {
  const { t } = useTranslation('common')
  const first = useRef(true)
  useEffect(() => {
    if (!onDebouncedChange) return
    if (first.current) {
      first.current = false
      return
    }
    const handle = window.setTimeout(() => onDebouncedChange(value), debounceMs)
    return () => window.clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return (
    <span className={cn('relative flex min-w-0 items-center', className)}>
      <Search size={16} strokeWidth={1.75} className="pointer-events-none absolute left-3 text-muted" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? t('ui.searchPlaceholder')}
        className={cn(controlBase, 'h-9 pl-9 pr-8 [&::-webkit-search-cancel-button]:hidden')}
        {...rest}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label={t('ui.clear')}
          className="absolute right-2 inline-flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-ink"
        >
          <X size={14} aria-hidden />
        </button>
      )}
    </span>
  )
}

/* ------------------------------------------------------------------- Select */

export interface SelectOption<V extends string = string> {
  value: V
  label: ReactNode
  disabled?: boolean
}

export interface SelectProps<V extends string = string> {
  value: V | undefined
  onValueChange: (value: V) => void
  options: readonly SelectOption<V>[]
  placeholder?: string
  disabled?: boolean
  size?: 'sm' | 'md'
  className?: string
  id?: string
  'aria-label'?: string
  invalid?: boolean
}

export function Select<V extends string = string>({
  value,
  onValueChange,
  options,
  placeholder,
  disabled,
  size = 'md',
  className,
  id,
  invalid,
  ...aria
}: SelectProps<V>) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={(v) => onValueChange(v as V)} disabled={disabled}>
      <SelectPrimitive.Trigger
        id={id}
        aria-label={aria['aria-label']}
        aria-invalid={invalid || undefined}
        className={cn(
          controlBase,
          'inline-flex items-center justify-between gap-2 text-left data-[placeholder]:text-faint',
          size === 'sm' ? 'h-8 text-[13px]' : 'h-9',
          className,
        )}
      >
        <span className="truncate">
          <SelectPrimitive.Value placeholder={placeholder} />
        </span>
        <SelectPrimitive.Icon>
          <ChevronDown size={16} strokeWidth={1.75} className="text-muted" aria-hidden />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className="z-[60] max-h-[min(360px,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[10px] border border-pop-border bg-panel text-ink shadow-pop animate-pop-in"
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((o) => (
              <SelectPrimitive.Item
                key={o.value}
                value={o.value}
                disabled={o.disabled}
                className="relative flex cursor-pointer select-none items-center rounded-md py-1.5 pl-8 pr-3 text-sm outline-none data-[disabled]:opacity-50 data-[highlighted]:bg-hover"
              >
                <SelectPrimitive.ItemIndicator className="absolute left-2 inline-flex">
                  <Check size={15} className="text-primary" aria-hidden />
                </SelectPrimitive.ItemIndicator>
                <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}

/* ------------------------------------------------------------------- Switch */

export interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  label?: ReactNode
  id?: string
  className?: string
  'aria-label'?: string
}

export function Switch({ checked, onCheckedChange, disabled, label, id, className, ...aria }: SwitchProps) {
  const autoId = useId()
  const switchId = id ?? autoId
  const control = (
    <SwitchPrimitive.Root
      id={switchId}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={aria['aria-label']}
      className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent bg-line-strong transition-colors duration-[160ms] ease-out data-[state=checked]:bg-primary disabled:opacity-50"
    >
      <SwitchPrimitive.Thumb className="block h-4 w-4 translate-x-0.5 rounded-full bg-panel shadow-sm transition-transform duration-[160ms] ease-out data-[state=checked]:translate-x-[17px]" />
    </SwitchPrimitive.Root>
  )
  if (!label) return <span className={className}>{control}</span>
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      {control}
      <label htmlFor={switchId} className="text-sm text-ink">
        {label}
      </label>
    </span>
  )
}

/* ----------------------------------------------------------------- Checkbox */

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange' | 'checked'> {
  checked: boolean | 'indeterminate'
  onCheckedChange: (checked: boolean) => void
  label?: ReactNode
}

export function Checkbox({ checked, onCheckedChange, label, className, disabled, ...rest }: CheckboxProps) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = checked === 'indeterminate'
  }, [checked])
  const box = (
    <span className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center">
      <input
        ref={ref}
        type="checkbox"
        checked={checked === true}
        disabled={disabled}
        onChange={(e) => onCheckedChange(e.target.checked)}
        className="peer absolute inset-0 m-0 cursor-pointer appearance-none rounded-[4px] border border-line-strong bg-panel transition-colors duration-[160ms] checked:border-primary checked:bg-primary indeterminate:border-primary indeterminate:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50"
        {...rest}
      />
      {checked === true && <Check size={12} strokeWidth={3} className="pointer-events-none relative text-on-primary" aria-hidden />}
      {checked === 'indeterminate' && <span className="pointer-events-none relative h-[2px] w-2 rounded bg-on-primary" />}
    </span>
  )
  if (!label) return <span className={cn('inline-flex', className)}>{box}</span>
  return (
    <label className={cn('inline-flex cursor-pointer items-center gap-2 text-sm text-ink', disabled && 'opacity-60', className)}>
      {box}
      <span>{label}</span>
    </label>
  )
}

/* --------------------------------------------------------- SegmentedControl */

export interface SegmentedOption<V extends string = string> {
  value: V
  label: ReactNode
  icon?: LucideIcon
  disabled?: boolean
}

export interface SegmentedControlProps<V extends string = string> {
  options: readonly SegmentedOption<V>[]
  value: V
  onChange: (value: V) => void
  size?: 'sm' | 'md'
  className?: string
  'aria-label'?: string
}

export function SegmentedControl<V extends string = string>({
  options,
  value,
  onChange,
  size = 'md',
  className,
  ...aria
}: SegmentedControlProps<V>) {
  return (
    <div
      role="radiogroup"
      aria-label={aria['aria-label']}
      className={cn('inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-[8px] border border-line bg-sunken p-0.5', className)}
    >
      {options.map((o) => {
        const active = o.value === value
        const Icon = o.icon
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[6px] font-medium transition-colors duration-[160ms] ease-out disabled:opacity-50',
              size === 'sm' ? 'h-7 px-2.5 text-[12.5px]' : 'h-8 px-3 text-[13px]',
              active ? 'bg-panel text-ink shadow-[0_1px_0_var(--bani-line-strong)] ring-1 ring-line' : 'text-muted hover:text-ink',
            )}
          >
            {Icon && <Icon size={15} strokeWidth={1.75} aria-hidden />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/* ----------------------------------------------------------------- Combobox */

export interface ComboboxItem {
  value: string
  label: string
  meta?: string
  disabled?: boolean
}

export interface ComboboxProps {
  items: readonly ComboboxItem[]
  value: string | null | undefined
  onChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  className?: string
  'aria-label'?: string
}

/** Searchable single select (cmdk). Popover anchored below the trigger. */
export function Combobox({
  items,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  disabled,
  className,
  ...aria
}: ComboboxProps) {
  const { t } = useTranslation('common')
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const selected = items.find((i) => i.value === value)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className={cn('relative min-w-0', className)}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={aria['aria-label']}
        onClick={() => setOpen((o) => !o)}
        className={cn(controlBase, 'inline-flex h-9 items-center justify-between gap-2 text-left')}
      >
        <span className={cn('min-w-0 truncate', !selected && 'text-faint')}>
          {selected ? selected.label : (placeholder ?? t('ui.select'))}
        </span>
        <ChevronsUpDown size={15} className="shrink-0 text-muted" aria-hidden />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-[60] min-w-[240px] overflow-hidden rounded-[10px] border border-pop-border bg-panel shadow-pop animate-pop-in">
          <Command
            filter={(itemValue, search) => {
              const item = items.find((i) => i.value === itemValue)
              const hay = `${item?.label ?? ''} ${item?.meta ?? ''} ${itemValue}`.toLowerCase()
              return hay.includes(search.toLowerCase()) ? 1 : 0
            }}
          >
            <div className="flex items-center gap-2 border-b border-line px-3">
              <Search size={15} className="text-muted" aria-hidden />
              <Command.Input
                autoFocus
                placeholder={searchPlaceholder ?? t('ui.searchPlaceholder')}
                className="h-9 w-full bg-transparent text-sm text-ink outline-none placeholder:text-faint"
              />
            </div>
            <Command.List className="scrollbar-thin max-h-[280px] overflow-y-auto p-1">
              <Command.Empty className="px-3 py-6 text-center text-[13px] text-muted">
                {emptyText ?? t('states.noResults')}
              </Command.Empty>
              {items.map((item) => (
                <Command.Item
                  key={item.value}
                  value={item.value}
                  disabled={item.disabled}
                  onSelect={() => {
                    onChange(item.value)
                    setOpen(false)
                  }}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm data-[disabled=true]:opacity-50 data-[selected=true]:bg-hover"
                >
                  <Check size={14} className={cn('shrink-0 text-primary', item.value === value ? 'opacity-100' : 'opacity-0')} aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.meta && <span className="shrink-0 font-mono text-[12px] text-muted">{item.meta}</span>}
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </div>
      )}
    </div>
  )
}

/* --------------------------------------------------------------- CopyButton */

export function CopyButton({ value, label, className }: { value: string; label?: string; className?: string }) {
  const { t } = useTranslation('common')
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const h = window.setTimeout(() => setCopied(false), 1400)
    return () => window.clearTimeout(h)
  }, [copied])
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = value
      document.body.appendChild(ta)
      ta.select()
      try {
        document.execCommand('copy')
      } finally {
        ta.remove()
      }
    }
    setCopied(true)
  }
  const text = copied ? t('actions.copied') : (label ?? t('actions.copy'))
  if (label) {
    return (
      <Button size="sm" variant="secondary" icon={copied ? Check : Copy} onClick={() => void copy()} className={className}>
        {text}
      </Button>
    )
  }
  return <IconButton size="sm" label={text} icon={copied ? Check : Copy} onClick={() => void copy()} className={className} />
}

/* --------------------------------------------------------------------- Mono */

export function Mono({ children, className, muted }: { children: ReactNode; className?: string; muted?: boolean }) {
  return <span className={cn('font-mono text-[12.5px] tabular', muted && 'text-muted', className)}>{children}</span>
}
