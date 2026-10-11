/** Free-text chip list (billing emails, phone numbers). Enter, comma or blur adds. */
import { Plus, X } from 'lucide-react'
import { useId, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, Input } from '@/components/ui'

export interface ChipListInputProps {
  value: string[]
  onChange: (next: string[]) => void
  max: number
  validate: (value: string) => boolean
  invalidMessage: string
  placeholder?: string
  inputMode?: 'email' | 'tel' | 'text'
  /** Message from the form schema (e.g. too many items). */
  error?: string
  id?: string
}

export function ChipListInput({ value, onChange, max, validate, invalidMessage, placeholder, inputMode, error, id }: ChipListInputProps) {
  const { t } = useTranslation('partners')
  const [draft, setDraft] = useState('')
  const [local, setLocal] = useState<string | null>(null)
  const fallbackId = useId()
  const inputId = id ?? fallbackId
  const full = value.length >= max

  function commit(raw: string) {
    const next = raw.trim().replace(/[,;]+$/, '').trim()
    if (!next) {
      setLocal(null)
      return
    }
    if (full) return setLocal(t('form.chips.full'))
    if (!validate(next)) return setLocal(invalidMessage)
    if (value.some((v) => v.toLowerCase() === next.toLowerCase())) return setLocal(t('form.chips.duplicate'))
    onChange([...value, next])
    setDraft('')
    setLocal(null)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
      e.preventDefault()
      commit(draft)
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  const message = local ?? error
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          id={inputId}
          value={draft}
          inputMode={inputMode}
          placeholder={placeholder}
          disabled={full}
          invalid={Boolean(message)}
          onChange={(e) => {
            setDraft(e.target.value)
            if (local) setLocal(null)
          }}
          onKeyDown={onKeyDown}
          onBlur={() => draft.trim() && commit(draft)}
        />
        <Button type="button" variant="secondary" icon={<Plus />} onClick={() => commit(draft)} disabled={full || !draft.trim()}>
          {t('form.chips.add')}
        </Button>
      </div>
      {message ? <p className="text-[13px] text-danger" role="alert">{message}</p> : null}
      <div className="flex flex-wrap items-center gap-1.5">
        {value.map((item) => (
          <span key={item} className="inline-flex max-w-full items-center gap-1 rounded border border-hairline bg-sunken py-0.5 pl-2 pr-1 text-[13px]">
            <span className="truncate">{item}</span>
            <button
              type="button"
              aria-label={t('form.chips.remove', { value: item })}
              className="grid size-5 place-items-center rounded text-muted hover:bg-row-hover hover:text-ink"
              onClick={() => onChange(value.filter((v) => v !== item))}
            >
              <X className="size-3.5 stroke-[1.75]" aria-hidden />
            </button>
          </span>
        ))}
        <span className="num ml-auto text-xs text-muted">{t('form.chips.count', { count: value.length, max })}</span>
      </div>
    </div>
  )
}
