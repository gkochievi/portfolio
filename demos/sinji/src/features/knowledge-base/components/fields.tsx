import { Plus, X } from 'lucide-react'
import { useId, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge, Button, IconButton, Input, Spinner, StatusChip } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { KbDocType, KbStatus } from '@/types'

/* ------------------------------------------------------------- badges */

const typeTone: Record<KbDocType, 'primary' | 'accent' | 'info' | 'success' | 'warning' | 'neutral'> = {
  product: 'primary',
  policy: 'accent',
  faq: 'info',
  procedure: 'success',
  script: 'warning',
  glossary: 'neutral',
  other: 'neutral',
}

export function DocTypeBadge({ type }: { type: KbDocType }) {
  const { t } = useTranslation('kb')
  return (
    <Badge tone={typeTone[type]} shape="tag" size="sm">
      {t(`docTypes.${type}`)}
    </Badge>
  )
}

export function StatusCell({ status, error, restructuring }: { status: KbStatus; error?: string | null; restructuring?: boolean }) {
  const { t } = useTranslation('kb')
  if (status === 'pending' || status === 'processing') {
    return (
      <span className="inline-flex items-center gap-2 text-[13px] text-info">
        <Spinner size={14} label={t(`status.${status}`)} className="text-info" />
        {restructuring ? t('status.restructuring') : t(`status.${status}`)}
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span title={error ?? undefined}>
        <StatusChip tone="danger" size="sm">
          {t('status.error')}
        </StatusChip>
      </span>
    )
  }
  return (
    <StatusChip tone="success" size="sm">
      {t('status.ready')}
    </StatusChip>
  )
}

/* ---------------------------------------------------------- tags input */

export function TagsInput({
  value,
  onChange,
  suggestions = [],
  placeholder,
  id,
  disabled,
  ...aria
}: {
  value: string[]
  onChange: (next: string[]) => void
  suggestions?: string[]
  placeholder?: string
  id?: string
  disabled?: boolean
  'aria-describedby'?: string
  'aria-invalid'?: boolean
}) {
  const { t } = useTranslation('kb')
  const [draft, setDraft] = useState('')
  const listId = useId()

  const add = (raw: string) => {
    const parts = raw
      .split(/[,;\n]/)
      .map((p) => p.trim())
      .filter(Boolean)
    if (parts.length === 0) return
    const next = [...value]
    for (const part of parts) if (!next.some((v) => v.toLowerCase() === part.toLowerCase()) && next.length < 20) next.push(part.slice(0, 40))
    onChange(next)
    setDraft('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      add(draft)
    } else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1))
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          id={id}
          value={draft}
          disabled={disabled}
          list={listId}
          placeholder={placeholder ?? t('fields.tagsPlaceholder')}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => add(draft)}
          {...aria}
        />
        <Button variant="secondary" icon={<Plus />} onClick={() => add(draft)} disabled={disabled || !draft.trim()} aria-label={t('fields.addTag')}>
          <span className="sr-only sm:not-sr-only">{t('fields.addTag')}</span>
        </Button>
      </div>
      <datalist id={listId}>
        {suggestions
          .filter((s) => !value.includes(s))
          .map((s) => (
            <option key={s} value={s} />
          ))}
      </datalist>
      {value.length ? (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <li key={tag}>
              <span className="inline-flex items-center gap-1 rounded-pill border border-line bg-sunken py-0.5 pl-2.5 pr-1 text-[13px]">
                {tag}
                {disabled ? null : (
                  <button
                    type="button"
                    onClick={() => onChange(value.filter((v) => v !== tag))}
                    className="grid size-5 place-items-center rounded-full text-muted hover:bg-ink/8 hover:text-ink"
                    aria-label={t('fields.removeTag', { tag })}
                  >
                    <X className="size-3" strokeWidth={2} />
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

/* ----------------------------------------------------- metadata editor */

export interface MetaRow {
  key: string
  value: string
}

export const metaToRows = (meta: Record<string, string> | undefined): MetaRow[] => Object.entries(meta ?? {}).map(([key, value]) => ({ key, value }))

/** Rows -> record; returns a duplicate-key / empty-key message key when invalid. */
export function rowsToMeta(rows: MetaRow[]): { value: Record<string, string>; error: 'empty_key' | 'duplicate_key' | null } {
  const out: Record<string, string> = {}
  for (const row of rows) {
    const key = row.key.trim()
    if (!key && !row.value.trim()) continue
    if (!key) return { value: out, error: 'empty_key' }
    if (key in out) return { value: out, error: 'duplicate_key' }
    out[key] = row.value.trim()
  }
  return { value: out, error: null }
}

export function MetadataEditor({ rows, onChange, disabled, className }: { rows: MetaRow[]; onChange: (rows: MetaRow[]) => void; disabled?: boolean; className?: string }) {
  const { t } = useTranslation('kb')
  const set = (index: number, patch: Partial<MetaRow>) => onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {rows.length === 0 ? <p className="text-[13px] text-muted">{t('fields.metadataEmpty')}</p> : null}
      {rows.map((row, index) => (
        <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
          <Input value={row.key} disabled={disabled} mono placeholder={t('fields.metadataKey')} aria-label={t('fields.metadataKey')} onChange={(e) => set(index, { key: e.target.value })} />
          <Input value={row.value} disabled={disabled} placeholder={t('fields.metadataValue')} aria-label={t('fields.metadataValue')} onChange={(e) => set(index, { value: e.target.value })} />
          <IconButton label={t('fields.removeRow')} icon={<X />} disabled={disabled} onClick={() => onChange(rows.filter((_, i) => i !== index))} />
        </div>
      ))}
      {disabled ? null : (
        <div>
          <Button variant="subtle" size="sm" icon={<Plus />} onClick={() => onChange([...rows, { key: '', value: '' }])}>
            {t('fields.addMetadata')}
          </Button>
        </div>
      )}
    </div>
  )
}
