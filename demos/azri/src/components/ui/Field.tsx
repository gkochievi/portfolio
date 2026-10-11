/**
 * Form controls: Field (label + hint + error wrapper), Label, Input, Textarea
 * (with counter), Checkbox, Switch, SearchInput. All inputs forward refs so
 * react-hook-form `register()` works. Inside a <Field>, controls pick up the
 * field's id, aria-describedby and invalid state automatically.
 * Owner: design-system agent.
 */
import * as SwitchPrimitive from '@radix-ui/react-switch'
import { Check, Search, X } from 'lucide-react'
import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ Field */

interface FieldCtx {
  id: string
  describedBy: string | undefined
  invalid: boolean
}
const FieldContext = createContext<FieldCtx | null>(null)

/** Inside a <Field>: the id/aria wiring for a custom control. */
export function useFieldControl(): FieldCtx | null {
  return useContext(FieldContext)
}

export function Label({ htmlFor, children, className, optional }: { htmlFor?: string; children: ReactNode; className?: string; optional?: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className={cn('flex items-baseline gap-1.5 text-[13px] font-semibold text-ink', className)}>
      {children}
      {optional && <span className="text-xs font-normal text-muted">{optional}</span>}
    </label>
  )
}

export interface FieldProps {
  label?: ReactNode
  /** Small muted text under the control. */
  hint?: ReactNode
  /** Error message (string from zod / RHF). Marks the control invalid. */
  error?: ReactNode
  /** e.g. t('common:form.optional'). */
  optional?: ReactNode
  /** Right side of the label row (e.g. a counter or a link). */
  aside?: ReactNode
  /** Explicit control id; generated otherwise. */
  id?: string
  className?: string
  children: ReactNode
}

export function Field({ label, hint, error, optional, aside, id, className, children }: FieldProps) {
  const auto = useId()
  const controlId = id ?? `f${auto}`
  const hintId = hint ? `${controlId}-hint` : undefined
  const errorId = error ? `${controlId}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined
  return (
    <FieldContext.Provider value={{ id: controlId, describedBy, invalid: Boolean(error) }}>
      <div className={cn('flex flex-col gap-1.5', className)}>
        {(label || aside) && (
          <div className="flex items-baseline justify-between gap-3">
            {label ? (
              <Label htmlFor={controlId} optional={optional}>
                {label}
              </Label>
            ) : (
              <span />
            )}
            {aside && <span className="text-xs text-muted">{aside}</span>}
          </div>
        )}
        {children}
        {hint && !error && (
          <p id={hintId} className="text-xs text-muted">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} role="alert" className="text-xs font-medium text-danger">
            {error}
          </p>
        )}
      </div>
    </FieldContext.Provider>
  )
}

/* ------------------------------------------------------------------ Input */

export const controlClass =
  'w-full rounded-[14px] border border-border-strong bg-panel text-ink transition-[border-color,box-shadow] duration-200 ease-azri placeholder:text-subtle hover:border-ink/35 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:ring-danger/20'

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Icon inside the left edge. */
  leftIcon?: ReactNode
  /** Element inside the right edge (unit, button). */
  rightSlot?: ReactNode
  invalid?: boolean
  size?: 'sm' | 'md' | 'lg'
  /** Monospace text (tokens, phone numbers, JSON). */
  mono?: boolean
}

const inputSizes = { sm: 'h-9 text-[13px]', md: 'h-10 text-sm', lg: 'h-12 text-base' } as const

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { leftIcon, rightSlot, invalid, size = 'md', mono, className, id, ...props },
  ref,
) {
  const field = useFieldControl()
  return (
    <div className={cn('relative flex items-center', className)}>
      {leftIcon && (
        <span className="pointer-events-none absolute left-3 text-muted [&_svg]:size-[18px]" aria-hidden="true">
          {leftIcon}
        </span>
      )}
      <input
        ref={ref}
        id={id ?? field?.id}
        aria-invalid={invalid || field?.invalid || undefined}
        aria-describedby={field?.describedBy}
        className={cn(controlClass, inputSizes[size], 'px-3.5', leftIcon && 'pl-10', rightSlot && 'pr-10', mono && 'font-mono tracking-tight')}
        {...props}
      />
      {rightSlot && <span className="absolute right-2 flex items-center text-muted">{rightSlot}</span>}
    </div>
  )
})

/* --------------------------------------------------------------- Textarea */

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
  /** Show "123 / 500" under the box (needs maxLength). */
  showCount?: boolean
  mono?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid, showCount, mono, className, id, onChange, maxLength, value, defaultValue, rows = 4, ...props },
  ref,
) {
  const field = useFieldControl()
  const initial = String(value ?? defaultValue ?? '').length
  const [count, setCount] = useState(initial)
  useEffect(() => {
    if (value !== undefined) setCount(String(value).length)
  }, [value])
  const near = maxLength ? count >= maxLength * 0.9 : false
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <textarea
        ref={ref}
        id={id ?? field?.id}
        rows={rows}
        maxLength={maxLength}
        value={value}
        defaultValue={defaultValue}
        aria-invalid={invalid || field?.invalid || undefined}
        aria-describedby={field?.describedBy}
        onChange={(event) => {
          setCount(event.target.value.length)
          onChange?.(event)
        }}
        className={cn(controlClass, 'min-h-24 resize-y px-3.5 py-3 text-[15px] leading-relaxed', mono && 'font-mono text-[13px]')}
        {...props}
      />
      {showCount && maxLength && (
        <span className={cn('self-end text-xs tabular text-muted', near && 'text-warning')} aria-live="polite">
          {count} / {maxLength}
        </span>
      )}
    </div>
  )
})

/* --------------------------------------------------------------- Checkbox */

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode
  description?: ReactNode
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, description, className, id, ...props },
  ref,
) {
  const auto = useId()
  const inputId = id ?? `cb${auto}`
  return (
    <label htmlFor={inputId} className={cn('inline-flex cursor-pointer select-none items-start gap-2.5 text-sm', props.disabled && 'cursor-not-allowed opacity-60', className)}>
      <span className="relative mt-px grid size-[18px] shrink-0 place-items-center">
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          className="peer absolute inset-0 m-0 cursor-pointer appearance-none rounded-[6px] border-[1.5px] border-border-strong bg-panel transition-colors checked:border-primary checked:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          {...props}
        />
        <Check className="pointer-events-none relative size-3.5 text-on-primary opacity-0 peer-checked:opacity-100" strokeWidth={3} />
      </span>
      {(label || description) && (
        <span className="flex flex-col">
          {label && <span className="font-medium text-ink">{label}</span>}
          {description && <span className="text-xs text-muted">{description}</span>}
        </span>
      )}
    </label>
  )
})

/* ----------------------------------------------------------------- Switch */

export interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label?: ReactNode
  disabled?: boolean
  id?: string
  className?: string
}

export function Switch({ checked, onCheckedChange, label, disabled, id, className }: SwitchProps) {
  const auto = useId()
  const switchId = id ?? `sw${auto}`
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <SwitchPrimitive.Root
        id={switchId}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className="relative inline-flex h-6 w-10 shrink-0 items-center rounded-full bg-ink/15 transition-colors duration-200 ease-azri data-[state=checked]:bg-primary disabled:opacity-50"
      >
        <SwitchPrimitive.Thumb className="block size-5 translate-x-0.5 rounded-full bg-panel shadow-sm transition-transform duration-200 ease-azri data-[state=checked]:translate-x-[18px] dark:data-[state=checked]:bg-plum" />
      </SwitchPrimitive.Root>
      {label && (
        <label htmlFor={switchId} className="cursor-pointer select-none text-sm text-ink">
          {label}
        </label>
      )}
    </span>
  )
}

/* ------------------------------------------------------------ SearchInput */

export interface SearchInputProps {
  value: string
  /** Called with the new text (after `debounce` ms when set). */
  onChange: (value: string) => void
  placeholder?: string
  /** Debounce in ms (default 200). 0 = immediate. */
  debounce?: number
  size?: 'sm' | 'md'
  className?: string
  'aria-label'?: string
  autoFocus?: boolean
}

export function SearchInput({ value, onChange, placeholder, debounce = 200, size = 'md', className, autoFocus, ...rest }: SearchInputProps) {
  const { t } = useTranslation('common')
  const [text, setText] = useState(value)
  const timer = useRef<number | undefined>(undefined)
  const latest = useRef(onChange)
  latest.current = onChange

  useEffect(() => setText(value), [value])
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const push = (next: string) => {
    setText(next)
    window.clearTimeout(timer.current)
    if (!debounce) latest.current(next)
    else timer.current = window.setTimeout(() => latest.current(next), debounce)
  }

  return (
    <Input
      type="search"
      size={size}
      value={text}
      autoFocus={autoFocus}
      onChange={(event) => push(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && text) {
          event.preventDefault()
          push('')
        }
      }}
      placeholder={placeholder ?? t('actions.search')}
      aria-label={rest['aria-label'] ?? placeholder ?? t('actions.search')}
      leftIcon={<Search strokeWidth={1.75} />}
      className={cn('min-w-0 [&_input::-webkit-search-cancel-button]:appearance-none', className)}
      rightSlot={
        text ? (
          <button
            type="button"
            onClick={() => push('')}
            aria-label={t('actions.clear')}
            className="grid size-7 place-items-center rounded-full text-muted hover:bg-ink/6 hover:text-ink"
          >
            <X className="size-4" strokeWidth={1.75} />
          </button>
        ) : undefined
      }
    />
  )
}
