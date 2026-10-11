import { forwardRef, useEffect, useId, useRef, useState, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { Search, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'

export const fieldBase =
  'w-full rounded-ui border border-line-strong bg-panel text-ink transition-colors duration-150 placeholder:text-muted hover:border-ink/60 focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent/40 disabled:cursor-not-allowed disabled:opacity-55 aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:outline-danger/30'

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  invalid?: boolean
  leftIcon?: ReactNode
  /** Content inside the right edge (unit, button, kbd). */
  rightSlot?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** Monospace text (ids, keys, snippets). */
  mono?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, leftIcon, rightSlot, size = 'md', mono, className, ...props },
  ref,
) {
  const h = size === 'sm' ? 'h-8 text-[13px]' : size === 'lg' ? 'h-11 text-[15px]' : 'h-9 text-sm'
  const input = (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(fieldBase, h, 'px-3', leftIcon && 'pl-9', rightSlot && 'pr-10', mono && 'font-mono text-[13px]', !leftIcon && !rightSlot && className)}
      {...props}
    />
  )
  if (!leftIcon && !rightSlot) return input
  return (
    <div className={cn('relative flex items-center', className)}>
      {leftIcon ? <span className="pointer-events-none absolute left-3 flex text-muted [&_svg]:size-4">{leftIcon}</span> : null}
      {input}
      {rightSlot ? <span className="absolute right-1.5 flex items-center text-muted">{rightSlot}</span> : null}
    </div>
  )
})

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
  /** Grow with content up to maxRows (default off). */
  autoGrow?: boolean
  maxRows?: number
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid, autoGrow, maxRows = 8, className, rows = 3, onInput, ...props },
  ref,
) {
  const resize = (el: HTMLTextAreaElement) => {
    if (!autoGrow) return
    el.style.height = 'auto'
    const line = parseFloat(getComputedStyle(el).lineHeight) || 21
    el.style.height = `${Math.min(el.scrollHeight, line * maxRows + 18)}px`
  }
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(fieldBase, 'min-h-9 px-3 py-2 text-sm leading-relaxed', autoGrow ? 'resize-none' : 'resize-y', className)}
      onInput={(e) => {
        resize(e.currentTarget)
        onInput?.(e)
      }}
      {...props}
    />
  )
})

export interface FieldProps {
  label?: ReactNode
  /** Helper line under the control. */
  hint?: ReactNode
  /** Error message (replaces hint, turns red). */
  error?: ReactNode
  required?: boolean
  /** Pass to label htmlFor; when omitted, children get wrapped in a <label>. */
  htmlFor?: string
  /** Right-aligned content on the label row (counter, link). */
  aside?: ReactNode
  className?: string
  children: ReactNode
}

/** Label + control + hint/error, 16px rhythm in forms. */
export function Field({ label, hint, error, required, htmlFor, aside, className, children }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label || aside ? (
        <div className="flex items-baseline justify-between gap-2">
          {label ? (
            <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink">
              {label}
              {required ? <span className="ml-0.5 text-danger">*</span> : null}
            </label>
          ) : (
            <span />
          )}
          {aside ? <span className="text-xs text-muted">{aside}</span> : null}
        </div>
      ) : null}
      {children}
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  )
}

/** useId helper so feature forms can wire Field htmlFor + control id in one line. */
export function useFieldId(prefix = 'f'): string {
  return `${prefix}-${useId().replace(/:/g, '')}`
}

export interface SearchInputProps extends Omit<InputProps, 'onChange' | 'value' | 'leftIcon' | 'rightSlot'> {
  value: string
  /** Called with the (debounced when debounceMs > 0) value. */
  onChange: (value: string) => void
  debounceMs?: number
}

/** Search box with magnifier, clear button and optional debounce. */
export function SearchInput({ value, onChange, debounceMs = 0, placeholder, className, ...props }: SearchInputProps) {
  const { t } = useTranslation()
  const [local, setLocal] = useState(value)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => setLocal(value), [value])
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const emit = (next: string) => {
    setLocal(next)
    if (debounceMs <= 0) return onChange(next)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => onChange(next), debounceMs)
  }
  return (
    <Input
      type="search"
      role="searchbox"
      value={local}
      placeholder={placeholder ?? t('actions.search')}
      onChange={(e) => emit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && local) {
          e.stopPropagation()
          emit('')
        }
      }}
      leftIcon={<Search strokeWidth={1.75} />}
      rightSlot={
        local ? (
          <button
            type="button"
            aria-label={t('actions.clear')}
            onClick={() => emit('')}
            className="grid size-6 place-items-center rounded-md text-muted hover:bg-hover hover:text-ink"
          >
            <X size={14} strokeWidth={1.75} />
          </button>
        ) : undefined
      }
      className={cn('[&_input::-webkit-search-cancel-button]:hidden', className)}
      {...props}
    />
  )
}
