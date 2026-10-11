import { X } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface EmailChipsProps {
  id?: string
  value: string[]
  onChange: (value: string[]) => void
  invalid?: boolean
  max?: number
  placeholder?: string
}

/** Chip list of addresses: Enter, comma, space or blur adds; Backspace on empty removes the last. */
export function EmailChips({ id, value, onChange, invalid, max = 20, placeholder }: EmailChipsProps) {
  const { t } = useTranslation('invoicing')
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  const commit = () => {
    const parts = draft.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean)
    if (parts.length === 0) return
    const bad = parts.find((p) => !EMAIL_RE.test(p))
    if (bad) {
      setError(t('email.invalidAddress', { address: bad }))
      return
    }
    const next = [...value]
    for (const p of parts) if (!next.includes(p)) next.push(p)
    if (next.length > max) {
      setError(t('email.tooMany', { max }))
      return
    }
    onChange(next)
    setDraft('')
    setError(null)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ' || e.key === ';') {
      e.preventDefault()
      commit()
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div>
      <div
        className={cn(
          'flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border bg-panel px-2 py-1.5 focus-within:border-signal',
          invalid || error ? 'border-danger' : 'border-hairline-strong',
        )}
      >
        {value.map((email) => (
          <span key={email} className="inline-flex items-center gap-1 rounded bg-sunken px-1.5 py-0.5 font-mono text-xs text-ink">
            {email}
            <button
              type="button"
              className="rounded text-muted hover:text-danger"
              aria-label={t('email.removeAddress', { address: email })}
              onClick={() => onChange(value.filter((v) => v !== email))}
            >
              <X className="size-3 stroke-[1.75]" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            setError(null)
          }}
          onKeyDown={onKeyDown}
          onBlur={commit}
          placeholder={value.length === 0 ? placeholder : undefined}
          className="min-w-[10rem] flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-subtle"
          inputMode="email"
          autoComplete="off"
        />
      </div>
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
    </div>
  )
}
