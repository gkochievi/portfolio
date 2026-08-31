import { forwardRef, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import { Check, ChevronDown, Search, Upload, X } from 'lucide-react'

import { cn } from '@/lib/cn'

const CONTROL = cn(
  'w-full rounded-control border border-hairline-strong bg-void/60 px-3 text-sm text-ink',
  'placeholder:text-ink-faint/70 transition-colors duration-150',
  'hover:border-white/20 focus:border-gold/70 focus:bg-void/80 focus:outline-none',
  'disabled:cursor-not-allowed disabled:opacity-50',
)

/* ------------------------------------------------------------------- Field */

export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  className,
  children,
}: {
  label?: string
  hint?: string
  error?: string
  required?: boolean
  htmlFor?: string
  className?: string
  children: ReactNode
}) {
  return (
    <label htmlFor={htmlFor} className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <span className="label-caps flex items-center gap-1">
          {label}
          {required && <span className="text-gold">*</span>}
        </span>
      )}
      {children}
      {error ? (
        <p className="text-xs font-medium text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-faint">{hint}</p>
      ) : null}
    </label>
  )
}

/* ------------------------------------------------------------------- Input */

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
  adornment?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, adornment, ...props },
  ref,
) {
  const field = (
    <input
      ref={ref}
      className={cn(CONTROL, 'h-10', invalid && 'border-danger/60 focus:border-danger', className)}
      {...props}
    />
  )

  if (!adornment) return field

  return (
    <div className="relative flex items-center">
      {field}
      <span className="pointer-events-none absolute right-3 text-ink-faint">{adornment}</span>
    </div>
  )
})

/* ------------------------------------------------------------------ Select */

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid, children, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          CONTROL,
          'h-10 cursor-pointer appearance-none pr-9',
          invalid && 'border-danger/60',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-faint"
        aria-hidden
      />
    </div>
  )
})

/* ------------------------------------------------------------- SearchInput */

export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <div className={cn('relative flex items-center', className)}>
      <Search className="pointer-events-none absolute left-3 size-4 text-ink-faint" aria-hidden />
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={cn(CONTROL, 'h-10 pr-8 pl-9 [&::-webkit-search-cancel-button]:hidden')}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2.5 text-ink-faint transition-colors hover:text-ink"
          aria-label="Clear search"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- Checkbox */

export function Checkbox({
  checked,
  onChange,
  label,
  hint,
  disabled,
  className,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: ReactNode
  hint?: string
  disabled?: boolean
  className?: string
}) {
  const id = useId()
  return (
    <div className={cn('flex items-start gap-2.5', className)}>
      <button
        id={id}
        type="button"
        role="checkbox"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-[5px] border transition-all duration-150',
          checked
            ? 'border-gold bg-gold text-void'
            : 'border-hairline-strong bg-void/60 hover:border-white/30',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        {checked && <Check className="size-3 stroke-[3]" />}
      </button>
      <label htmlFor={id} className={cn('cursor-pointer select-none', disabled && 'cursor-not-allowed')}>
        <span className="text-sm text-ink">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-ink-faint">{hint}</span>}
      </label>
    </div>
  )
}

/* ------------------------------------------------------------------ Switch */

export function Switch({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: ReactNode
  hint?: string
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm text-ink">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-ink-faint">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={typeof label === 'string' ? label : 'Toggle'}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-200',
          checked ? 'border-gold/60 bg-gold/85' : 'border-hairline-strong bg-white/8',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <span
          className={cn(
            'absolute top-[3px] size-4 rounded-full transition-transform duration-200',
            checked ? 'translate-x-[22px] bg-void' : 'translate-x-[3px] bg-ink-muted',
          )}
        />
      </button>
    </div>
  )
}

/* ------------------------------------------------------------- MultiSelect */

export interface MultiOption {
  value: number
  label: string
  meta?: string
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  emptyLabel = 'Nothing to choose from',
  searchable = true,
}: {
  options: MultiOption[]
  value: number[]
  onChange: (value: number[]) => void
  placeholder?: string
  emptyLabel?: string
  searchable?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const filtered = useMemo(() => {
    const needle = term.trim().toLowerCase()
    if (!needle) return options
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(needle) || option.meta?.toLowerCase().includes(needle),
    )
  }, [options, term])

  const selected = useMemo(
    () => options.filter((option) => value.includes(option.value)),
    [options, value],
  )

  const toggle = (id: number) => {
    onChange(value.includes(id) ? value.filter((item) => item !== id) : [...value, id])
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        aria-expanded={open}
        className={cn(
          CONTROL,
          'flex min-h-10 cursor-pointer items-center justify-between gap-2 py-1.5 text-left',
          open && 'border-gold/70',
        )}
      >
        <span className="flex flex-wrap items-center gap-1.5">
          {selected.length === 0 && <span className="text-ink-faint/70">{placeholder}</span>}
          {selected.slice(0, 4).map((option) => (
            <span
              key={option.value}
              className="inline-flex items-center gap-1 rounded-md border border-gold/25 bg-gold/10 px-1.5 py-0.5 text-[11px] font-medium text-gold"
            >
              {option.label}
              <X
                className="size-3 cursor-pointer opacity-60 hover:opacity-100"
                onClick={(event) => {
                  event.stopPropagation()
                  toggle(option.value)
                }}
              />
            </span>
          ))}
          {selected.length > 4 && (
            <span className="text-[11px] font-medium text-ink-faint">+{selected.length - 4}</span>
          )}
        </span>
        <ChevronDown className={cn('size-4 shrink-0 text-ink-faint transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="animate-fade absolute z-50 mt-1.5 w-full overflow-hidden rounded-control border border-hairline-strong bg-surface-2 shadow-raised">
          {searchable && options.length > 6 && (
            <div className="border-b border-hairline p-2">
              <input
                autoFocus
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Filter…"
                className="h-8 w-full rounded-md bg-void/70 px-2.5 text-sm text-ink placeholder:text-ink-faint/70 focus:outline-none"
              />
            </div>
          )}
          <div className="max-h-56 overflow-y-auto p-1">
            {filtered.length === 0 && (
              <p className="px-3 py-4 text-center text-xs text-ink-faint">{emptyLabel}</p>
            )}
            {filtered.map((option) => {
              const isSelected = value.includes(option.value)
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggle(option.value)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors',
                    isSelected ? 'bg-gold/10 text-ink' : 'text-ink-muted hover:bg-white/5 hover:text-ink',
                  )}
                >
                  <span
                    className={cn(
                      'grid size-4 shrink-0 place-items-center rounded-[4px] border',
                      isSelected ? 'border-gold bg-gold text-void' : 'border-hairline-strong',
                    )}
                  >
                    {isSelected && <Check className="size-2.5 stroke-[3]" />}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  {option.meta && (
                    <span className="numeral shrink-0 text-[11px] text-ink-faint">{option.meta}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/* --------------------------------------------------------------- FileField */

export function FileField({
  name,
  currentUrl,
  accept = 'image/*',
  onPick,
}: {
  name: string
  currentUrl?: string | null
  accept?: string
  onPick?: (file: File | null) => void
}) {
  const [preview, setPreview] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview)
  }, [preview])

  const shown = preview ?? currentUrl ?? null

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          'grid size-14 shrink-0 place-items-center overflow-hidden rounded-control border border-dashed',
          'border-hairline-strong bg-void/50 transition-colors hover:border-gold/50',
        )}
      >
        {shown ? (
          <img src={shown} alt="" className="size-full object-contain p-1" />
        ) : (
          <Upload className="size-4 text-ink-faint" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-sm font-medium text-gold transition-colors hover:text-gold-bright"
        >
          {shown ? 'Replace' : 'Choose file'}
        </button>
        <p className="mt-0.5 truncate text-xs text-ink-faint">
          {fileName ?? (currentUrl ? currentUrl.split('/').pop() : 'No file selected')}
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        name={name}
        accept={accept}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null
          if (preview) URL.revokeObjectURL(preview)
          setPreview(file ? URL.createObjectURL(file) : null)
          setFileName(file?.name ?? null)
          onPick?.(file)
        }}
      />
    </div>
  )
}
