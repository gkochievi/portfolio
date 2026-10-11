/**
 * Small pieces shared by the settings panels: error translation, zod helpers
 * for tri-lingual text, Tbilisi time conversion and the theme picker.
 */
import { Check } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { errorMessage, isApiError } from '@/api/client'
import { cn } from '@/lib/cn'
import { pickText } from '@/lib/format'
import type { ContentLang, LocalizedText, ThemePreset } from '@/types'
import { THEME_PRESETS, themeStyle, themeSwatch } from '@/features/widget/themes'

/* ------------------------------------------------------------------- errors */

/** Translate the machine codes the handlers attach to their errors. */
export function useSettingsErrors() {
  const { t } = useTranslation('adminSettings')
  return {
    /** A message fit for a toast. */
    text(error: unknown): string {
      if (isApiError(error)) {
        const code = error.fieldErrors.code?.[0]
        if (code && t(`errors.${code}`, { defaultValue: '' })) return t(`errors.${code}`)
        if (error.status === 403) return t('errors.forbidden')
        const [field, messages] = Object.entries(error.fieldErrors).find(([key]) => key !== 'code') ?? []
        const first = messages?.[0]
        if (field && first && t(`errors.field.${first}`, { defaultValue: '' })) return t(`errors.field.${first}`)
      }
      return errorMessage(error, t('errors.generic'))
    },
  }
}

/* ---------------------------------------------------------------- zod bits */

type Translate = (key: string, options?: Record<string, unknown>) => string

const LANG_KEYS: ContentLang[] = ['ka', 'en', 'ru']

/** A ka/en/ru text where the listed languages must be filled and each is capped. */
export function localizedSchema(t: Translate, required: ('ka' | 'en')[], max: number) {
  return z
    .object({ ka: z.string(), en: z.string(), ru: z.string().optional() })
    .superRefine((value, ctx) => {
      for (const lang of required) {
        if (!value[lang].trim()) ctx.addIssue({ code: 'custom', path: [lang], message: t('validation.required') })
      }
      for (const lang of LANG_KEYS) {
        if ((value[lang] ?? '').length > max) ctx.addIssue({ code: 'custom', path: [lang], message: t('validation.tooLong', { max }) })
      }
    })
}

/** An integer entered in a number input (empty or NaN is a clear message, not a crash). */
export function intSchema(t: Translate, min: number, max: number) {
  return z
    .number({ invalid_type_error: t('validation.number') })
    .int(t('validation.number'))
    .min(min, t('validation.min', { min }))
    .max(max, t('validation.max', { max }))
}

interface MaybeLocalizedError {
  message?: string
  ka?: { message?: string }
  en?: { message?: string }
  ru?: { message?: string }
}

/** The first message of a LocalizedText field error (or the field's own). */
export function locError(error: unknown): string | undefined {
  const e = error as MaybeLocalizedError | undefined
  return e?.message ?? e?.ka?.message ?? e?.en?.message ?? e?.ru?.message
}

export function emptyText(): LocalizedText {
  return { ka: '', en: '' }
}

/** Copy a possibly shared LocalizedText into a plain editable object. */
export function textValue(value: LocalizedText | undefined): LocalizedText {
  return { ka: value?.ka ?? '', en: value?.en ?? '', ru: value?.ru ?? '' }
}

/** Drop an empty Russian text before sending. */
export function cleanText(value: LocalizedText): LocalizedText {
  const ru = (value.ru ?? '').trim()
  return { ka: value.ka.trim(), en: value.en.trim(), ...(ru ? { ru } : {}) }
}

/* ------------------------------------------------------------- Tbilisi time */

const TBILISI = 'Asia/Tbilisi'

const partsFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: TBILISI,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** ISO instant -> `yyyy-MM-ddTHH:mm` in Tbilisi time (for datetime-local inputs). */
export function isoToTbilisiLocal(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const parts: Record<string, string> = {}
  for (const part of partsFormat.formatToParts(date)) parts[part.type] = part.value
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

/** `yyyy-MM-ddTHH:mm` read as Tbilisi time -> ISO instant (null when empty or invalid). */
export function tbilisiLocalToIso(local: string): string | null {
  if (!local) return null
  const ms = Date.parse(`${local}:00+04:00`)
  return Number.isNaN(ms) ? null : new Date(ms).toISOString()
}

/** Today as `yyyy-MM-dd` (Tbilisi). */
export function todayTbilisi(offsetDays = 0): string {
  return isoToTbilisiLocal(new Date(Date.now() + offsetDays * 86_400_000).toISOString()).slice(0, 10)
}

/* ------------------------------------------------------------------ layout */

export function PanelSection({ title, description, children, className }: { title: ReactNode; description?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('flex flex-col gap-3', className)}>
      <div>
        <h3 className="font-display text-[15px] font-semibold text-ink">{title}</h3>
        {description ? <p className="mt-0.5 text-[13px] text-muted">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}

/** A hairline-bordered group of setting rows. */
export function RowGroup({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('divide-y divide-line rounded-ui border border-line bg-panel px-4 [&>*]:py-3', className)}>{children}</div>
}

/* ------------------------------------------------------------ theme picker */

function MiniWindow({ kind, theme, title }: { kind: 'client' | 'operator' | 'admin'; theme: ThemePreset; title?: string }) {
  const v = (name: string) => `var(--c-${name})`
  const line = (w: string, color = 'line-strong') => <span className="block h-1 rounded-full" style={{ width: w, background: v(color), opacity: 0.55 }} />
  return (
    <div aria-hidden className="relative h-[84px] w-full overflow-hidden rounded-ui border text-[8px] leading-none" style={{ ...themeStyle(theme), background: v('bg'), borderColor: v('line') }}>
      {kind === 'client' ? (
        <>
          <div className="flex h-5 items-center px-2 font-semibold" style={{ background: v('primary'), color: v('on-primary') }}>
            <span className="truncate">{title || 'Chat'}</span>
          </div>
          <div className="flex flex-col gap-1.5 p-2">
            <span className="block w-[62%] rounded-[6px] px-1.5 py-1" style={{ background: v('accent-soft') }}>{line('90%', 'accent')}</span>
            <span className="ml-auto block w-[48%] rounded-[6px] px-1.5 py-1" style={{ background: v('primary') }}>{line('80%', 'on-primary')}</span>
          </div>
          <span className="absolute bottom-1.5 right-1.5 size-4 rounded-full" style={{ background: v('primary'), boxShadow: `1px 1px 0 ${v('hard-shadow')}` }} />
        </>
      ) : null}
      {kind === 'operator' ? (
        <div className="flex h-full">
          <div className="flex w-[34%] flex-col gap-1.5 border-r p-1.5" style={{ background: v('sunken'), borderColor: v('line') }}>
            <span className="block rounded-[4px] p-1" style={{ background: v('panel') }}>{line('80%')}</span>
            <span className="block rounded-[4px] p-1" style={{ background: v('accent-soft') }}>{line('60%', 'accent')}</span>
            <span className="block rounded-[4px] p-1" style={{ background: v('panel') }}>{line('70%')}</span>
          </div>
          <div className="flex flex-1 flex-col justify-end gap-1.5 p-2">
            <span className="block w-[70%] rounded-[6px] px-1.5 py-1" style={{ background: v('panel'), border: `1px solid ${v('line')}` }}>{line('85%')}</span>
            <span className="ml-auto block w-[55%] rounded-[6px] px-1.5 py-1" style={{ background: v('primary') }}>{line('75%', 'on-primary')}</span>
          </div>
        </div>
      ) : null}
      {kind === 'admin' ? (
        <div className="flex h-full flex-col">
          <div className="flex h-4 items-center gap-1.5 border-b px-2" style={{ background: v('panel'), borderColor: v('line') }}>
            <span className="size-2 rounded-full" style={{ background: v('primary') }} />
            {line('26%')}
          </div>
          <div className="grid flex-1 grid-cols-3 gap-1.5 p-2">
            {[0, 1, 2].map((i) => (
              <span key={i} className="flex flex-col justify-between rounded-[5px] p-1.5" style={{ background: v('panel'), border: `1px solid ${v('line')}` }}>
                {line('60%')}
                <span className="block h-1.5 rounded-full" style={{ width: `${40 + i * 20}%`, background: i === 1 ? v('primary') : v('accent') }} />
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** Eight presets as swatches, with a small live preview of the chosen one. */
export function ThemePicker({ kind, label, description, value, onChange, previewTitle }: {
  kind: 'client' | 'operator' | 'admin'
  label: string
  description: string
  value: ThemePreset
  onChange: (theme: ThemePreset) => void
  previewTitle?: string
}) {
  const { t } = useTranslation()
  return (
    <div className="grid gap-4 rounded-ui border border-line bg-panel p-4 sm:grid-cols-[1fr_168px]">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-ink">{label}</p>
        <p className="mb-3 mt-0.5 text-[13px] text-muted">{description}</p>
        <div role="radiogroup" aria-label={label} className="grid grid-cols-4 gap-x-2 gap-y-3">
          {THEME_PRESETS.map((theme) => {
            const selected = theme === value
            return (
              <button
                key={theme}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange(theme)}
                className="group flex flex-col items-center gap-1.5 rounded-ui outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <span
                  className={cn('grid size-9 place-items-center rounded-full border-2 transition-transform group-hover:scale-105', selected ? 'border-ink' : 'border-line-strong')}
                  style={{ background: themeSwatch(theme) } as CSSProperties}
                >
                  {selected ? <Check className="size-4" strokeWidth={2.5} style={{ color: theme === 'canary' || theme === 'paper' ? '#1e1b12' : '#fffdf8' }} /> : null}
                </span>
                <span className={cn('text-[12px]', selected ? 'font-semibold text-ink' : 'text-muted')}>{t(`theme.${theme}`)}</span>
              </button>
            )
          })}
        </div>
      </div>
      <MiniWindow kind={kind} theme={value} title={previewTitle} />
    </div>
  )
}

/** Title of a text in the UI language, for hub summaries. */
export function textIn(value: LocalizedText | undefined, lang: string): string {
  return value ? pickText(value, lang.startsWith('ka') ? 'ka' : 'en') : ''
}
