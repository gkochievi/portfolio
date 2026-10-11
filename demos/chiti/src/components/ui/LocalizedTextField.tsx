import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { ContentLang, LocalizedText } from '@/types'
import { cn } from '@/lib/cn'
import { Input, Textarea } from './Input'

export interface LocalizedTextFieldProps {
  value: LocalizedText
  onChange: (value: LocalizedText) => void
  multiline?: boolean
  rows?: number
  /** Show the optional Russian tab (default true). */
  withRu?: boolean
  /** Languages that must be filled (marked with a dot when empty). Default ['ka', 'en']. */
  required?: ContentLang[]
  placeholder?: string
  maxLength?: number
  id?: string
  invalid?: boolean
  className?: string
}

/** Tenant content editor: ka / en / ru tabs over one input. */
export function LocalizedTextField({ value, onChange, multiline, rows = 3, withRu = true, required = ['ka', 'en'], placeholder, maxLength, id, invalid, className }: LocalizedTextFieldProps) {
  const { t } = useTranslation()
  const langs: ContentLang[] = withRu ? ['ka', 'en', 'ru'] : ['ka', 'en']
  const [lang, setLang] = useState<ContentLang>('ka')
  const current = value[lang] ?? ''
  const set = (text: string) => onChange({ ...value, [lang]: text })
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div role="tablist" className="flex items-center gap-1">
        {langs.map((l) => {
          const missing = required.includes(l) && !(value[l] ?? '').trim()
          return (
            <button
              key={l}
              type="button"
              role="tab"
              aria-selected={lang === l}
              onClick={() => setLang(l)}
              className={cn(
                'inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-medium transition-colors',
                lang === l ? 'bg-ink text-bg' : 'text-muted hover:bg-hover hover:text-ink',
              )}
            >
              {t(`lang.${l}`)}
              {missing ? <span aria-label={t('states.missing')} className="size-1.5 rounded-full bg-warning" /> : null}
            </button>
          )
        })}
        {maxLength ? <span className="ml-auto text-xs text-muted tabular">{current.length}/{maxLength}</span> : null}
      </div>
      {multiline ? (
        <Textarea id={id} lang={lang} rows={rows} value={current} maxLength={maxLength} placeholder={placeholder} invalid={invalid} onChange={(e) => set(e.target.value)} />
      ) : (
        <Input id={id} lang={lang} value={current} maxLength={maxLength} placeholder={placeholder} invalid={invalid} onChange={(e) => set(e.target.value)} />
      )}
    </div>
  )
}
