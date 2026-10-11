import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SearchInput } from '@/components/ui'
import { cn } from '@/lib/cn'

import { ROW_FIELDS, TOKEN_CATALOGUE, tokenSnippet } from '../engine/view'

interface Props {
  /** Receives the text to insert and the bare token name. */
  onInsert: (snippet: string, token: string) => void
  /** Offer `{{#section}}` blocks and the fields available inside them (raw HTML only). */
  withSections?: boolean
  className?: string
}

function Chip({ label, onClick, title }: { label: string; onClick: () => void; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? label}
      className="rounded border border-hairline bg-panel px-1.5 py-0.5 font-mono text-[11px] leading-5 text-ink transition-colors hover:border-signal hover:bg-row-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal"
    >
      {label}
    </button>
  )
}

/** The token catalogue as click-to-insert chips. */
export function TokenPicker({ onInsert, withSections = false, className }: Props) {
  const { t } = useTranslation('invoice-templates')
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()

  const groups = useMemo(
    () =>
      TOKEN_CATALOGUE.map((group) => ({
        ...group,
        tokens: group.tokens.filter((tok) => (withSections || !tok.section) && (!q || tok.token.toLowerCase().includes(q))),
      })).filter((group) => group.tokens.length > 0),
    [q, withSections],
  )

  const rows = useMemo(
    () =>
      withSections
        ? (['lineItems', 'tasks'] as const).map((key) => ({
            key,
            fields: ROW_FIELDS[key].filter((f) => !q || f.toLowerCase().includes(q)),
          })).filter((r) => r.fields.length > 0)
        : [],
    [q, withSections],
  )

  return (
    <div className={cn('flex min-h-0 flex-col gap-3', className)}>
      <SearchInput value={query} onChange={setQuery} placeholder={t('tokens.search')} />
      <div className="min-h-0 space-y-3 overflow-y-auto pr-1">
        {groups.map((group) => (
          <div key={group.id}>
            <div className="eyebrow mb-1.5">{t(`tokens.groups.${group.id}`)}</div>
            <div className="flex flex-wrap gap-1.5">
              {group.tokens.map((tok) => (
                <Chip
                  key={tok.token}
                  label={tok.section ? `#${tok.token}` : tok.token}
                  title={tok.section ? t('tokens.sectionHint') : `{{${tok.token}}}`}
                  onClick={() => onInsert(tokenSnippet(tok.token, tok.section), tok.token)}
                />
              ))}
            </div>
          </div>
        ))}
        {rows.map((row) => (
          <div key={row.key}>
            <div className="eyebrow mb-1.5">{row.key === 'lineItems' ? t('tokens.rowsLineItems') : t('tokens.rowsTasks')}</div>
            <div className="flex flex-wrap gap-1.5">
              {row.fields.map((field) => (
                <Chip key={field} label={field} title={`{{${field}}}`} onClick={() => onInsert(`{{${field}}}`, field)} />
              ))}
            </div>
          </div>
        ))}
        {groups.length === 0 && rows.length === 0 ? <p className="text-sm text-muted">{t('tokens.noMatches')}</p> : null}
      </div>
    </div>
  )
}
