/**
 * Form controls. Errors are i18n keys (e.g. `auth:errors.emailTaken`) and are
 * translated here. All inputs forward refs, so react-hook-form's
 * `register()` works directly.
 */
import { Check, Search, X } from 'lucide-react'
import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'

export const controlBase = cn(
  'w-full rounded-chip border-[1.5px] border-line bg-panel text-[15px] text-ink',
  'placeholder:text-muted/70 transition-colors hover:border-line-strong',
  'focus:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
  'aria-[invalid=true]:border-danger disabled:cursor-not-allowed disabled:bg-sunken disabled:opacity-70',
)

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-sm font-semibold text-ink', className)} {...props} />
}

export interface FieldProps {
  label?: ReactNode
  /** Must match the control's id so the label is wired. Generated if omitted (pass `children` as a function then). */
  htmlFor?: string
  hint?: ReactNode
  /** i18n key(s) with namespace, or already-translated text. */
  error?: string | string[] | null | undefined
  required?: boolean
  /** Small right-aligned text beside the label (counter, "optional"). */
  aside?: ReactNode
  className?: string
  children: ReactNode | ((id: string) => ReactNode)
}

/** Label + control + hint/error. */
export function Field({ label, htmlFor, hint, error, required, aside, className, children }: FieldProps) {
  const { t } = useTranslation()
  const generated = useId()
  const id = htmlFor ?? generated
  const errorKey = Array.isArray(error) ? error[0] : error
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {(label || aside) && (
        <div className="flex items-baseline justify-between gap-2">
          {label && (
            <Label htmlFor={id}>
              {label}
              {required && (
                <span className="ml-0.5 text-accent-ink" aria-hidden>
                  *
                </span>
              )}
            </Label>
          )}
          {aside && <span className="text-xs text-muted">{aside}</span>}
        </div>
      )}
      {typeof children === 'function' ? children(id) : children}
      {errorKey ? (
        <p role="alert" id={`${id}-error`} className="text-sm font-medium text-danger">
          {t(errorKey)}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
  /** Icon or text inside the left edge. */
  leading?: ReactNode
  /** Icon, unit or button inside the right edge. */
  trailing?: ReactNode
  inputSize?: 'sm' | 'md' | 'lg'
}

const INPUT_H = { sm: 'h-9', md: 'h-11', lg: 'h-14 text-base' } as const

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, leading, trailing, inputSize = 'md', ...props },
  ref,
) {
  const input = (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(controlBase, INPUT_H[inputSize], 'px-3', leading && 'pl-10', trailing && 'pr-10', !leading && !trailing && className)}
      {...props}
    />
  )
  if (!leading && !trailing) return input
  return (
    <div className={cn('relative', className)}>
      {leading && (
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted [&_svg]:size-[18px]">
          {leading}
        </span>
      )}
      {input}
      {trailing && <span className="absolute inset-y-0 right-2 flex items-center text-muted [&_svg]:size-[18px]">{trailing}</span>}
    </div>
  )
})

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, rows = 3, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(controlBase, 'min-h-[88px] px-3 py-2.5 leading-normal', className)}
      {...props}
    />
  )
})

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode
  description?: ReactNode
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, description, className, id, ...props },
  ref,
) {
  const generated = useId()
  const inputId = id ?? generated
  return (
    <label htmlFor={inputId} className={cn('inline-flex cursor-pointer items-start gap-2.5', props.disabled && 'cursor-not-allowed opacity-60', className)}>
      <span className="relative mt-0.5 grid size-5 shrink-0 place-items-center">
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          className="peer size-5 cursor-[inherit] appearance-none rounded-[5px] border-[1.5px] border-line-strong bg-panel transition-colors checked:border-primary checked:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          {...props}
        />
        <Check
          aria-hidden
          strokeWidth={3}
          className="pointer-events-none absolute size-3.5 text-on-primary opacity-0 peer-checked:opacity-100"
        />
      </span>
      {(label || description) && (
        <span className="min-w-0">
          {label && <span className="block text-[15px] leading-snug text-ink">{label}</span>}
          {description && <span className="block text-sm text-muted">{description}</span>}
        </span>
      )}
    </label>
  )
})

export interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: string
  onChange: (value: string) => void
  inputSize?: 'sm' | 'md'
}

/** Search box with a magnifier and a clear button. */
export function SearchInput({ value, onChange, placeholder, className, inputSize = 'md', ...props }: SearchInputProps) {
  const { t } = useTranslation()
  return (
    <Input
      type="search"
      inputSize={inputSize}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && value) {
          event.preventDefault()
          onChange('')
        }
      }}
      placeholder={placeholder ?? t('common:actions.search')}
      aria-label={props['aria-label'] ?? placeholder ?? t('common:actions.search')}
      leading={<Search />}
      trailing={
        value ? (
          <button
            type="button"
            onClick={() => onChange('')}
            className="grid size-7 place-items-center rounded-chip text-muted hover:bg-sunken hover:text-ink"
            aria-label={t('common:actions.clear')}
          >
            <X className="size-4" />
          </button>
        ) : undefined
      }
      className={cn('w-full sm:w-72 [&_input::-webkit-search-cancel-button]:hidden', className)}
      {...props}
    />
  )
}
