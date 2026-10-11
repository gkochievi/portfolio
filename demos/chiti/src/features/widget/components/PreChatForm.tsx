/** The pre-chat form, built from the tenant's enabled custom fields. */
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowLeft, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button, Field, Input, Select } from '@/components/ui'
import { pickText } from '@/lib/format'
import type { CustomField, Lang } from '@/types'

import type { WidgetController, WidgetState } from '../controller'

/** The customer persona (Ana) pre-fills the form on the storefront. */
export function personaValues(fields: CustomField[], lang: Lang): Record<string, string> {
  const values: Record<string, string> = {}
  for (const field of fields) {
    if (field.type === 'phone') values[field.id] = '+995 555 00 12 34'
    else if (field.type === 'email') values[field.id] = 'ana@chiti.example'
    else if (field.type === 'text' && /name$/i.test(field.id)) values[field.id] = lang === 'ka' ? 'ანა ჯაფარიძე' : 'Ana Japaridze'
  }
  return values
}

function fieldProblem(field: CustomField, value: string): 'required' | 'invalid' | null {
  const trimmed = value.trim()
  if (!trimmed) return field.required ? 'required' : null
  if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return 'invalid'
  if (field.type === 'phone' && trimmed.replace(/\D/g, '').length < 7) return 'invalid'
  if (field.type === 'number' && Number.isNaN(Number(trimmed))) return 'invalid'
  return null
}

export interface PreChatFormProps {
  state: WidgetState
  controller: WidgetController
  fields: CustomField[]
  lang: Lang
  faqEnabled: boolean
  /** Re-check the working hours before a retry. */
  onRetry: () => void
}

export function PreChatForm({ state, controller, fields, lang, faqEnabled, onRetry }: PreChatFormProps) {
  const { t } = useTranslation('widget')
  const [attempted, setAttempted] = useState(false)

  const requiredFilled = useMemo(
    () => fields.every((field) => !field.required || (state.values[field.id] ?? '').trim().length > 0),
    [fields, state.values],
  )

  useEffect(() => {
    if (state.failure?.code === 'MISSING_FIELDS') setAttempted(true)
  }, [state.failure])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setAttempted(true)
    if (fields.some((field) => fieldProblem(field, state.values[field.id] ?? ''))) return
    void controller.startChat()
  }

  const failure = state.failure
  const showAlert = failure && (failure.code === 'OFFLINE' || failure.code === 'MISSING_FIELDS' || failure.code === 'GENERIC')

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {faqEnabled && (
          <button
            type="button"
            className="mb-3 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[13px] text-muted hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
            onClick={() => controller.backFromForm()}
          >
            <ArrowLeft size={15} strokeWidth={1.75} aria-hidden />
            {t('form.back')}
          </button>
        )}
        <h2 className="m-0 font-display text-[19px] font-semibold leading-tight">{t('form.title')}</h2>
        <p className="m-0 mb-4 mt-1 text-[13.5px] leading-snug text-muted">{t('form.subtitle')}</p>

        <div className="flex flex-col gap-3.5">
          {fields.map((field) => {
            const value = state.values[field.id] ?? ''
            const problem = attempted ? fieldProblem(field, value) : null
            const error = problem ? t(`form.${problem}`) : state.failure?.fieldErrors[field.id] ? t('form.invalid') : undefined
            const label = pickText(field.label, lang)
            const placeholder = pickText(field.placeholder, lang)
            return (
              <Field key={field.id} label={label} required={field.required} error={error} htmlFor={`pc-${field.id}`}>
                {field.type === 'select' ? (
                  <Select
                    id={`pc-${field.id}`}
                    value={value || undefined}
                    onValueChange={(next) => controller.setValue(field.id, next)}
                    placeholder={placeholder || t('form.select')}
                    invalid={!!error}
                    options={field.options.map((option) => ({ value: option.value, label: pickText(option.label, lang) }))}
                  />
                ) : (
                  <Input
                    id={`pc-${field.id}`}
                    type={field.type === 'phone' ? 'tel' : field.type === 'email' ? 'email' : field.type === 'number' ? 'text' : 'text'}
                    inputMode={field.type === 'number' ? 'numeric' : field.type === 'phone' ? 'tel' : undefined}
                    autoComplete={field.type === 'phone' ? 'tel' : field.type === 'email' ? 'email' : 'off'}
                    value={value}
                    invalid={!!error}
                    placeholder={placeholder}
                    onChange={(event) => controller.setValue(field.id, event.target.value)}
                  />
                )}
              </Field>
            )
          })}
        </div>

        {showAlert && (
          <div role="alert" className="mt-4 flex items-start gap-2.5 rounded-ui border border-danger/40 bg-danger-soft px-3 py-2.5 text-[13px] leading-snug text-danger">
            <TriangleAlert size={17} strokeWidth={1.75} className="mt-px shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="m-0 font-medium">{t(`errors.${failure.code}`)}</p>
              {failure.code === 'OFFLINE' && failure.message && failure.message !== 'We are offline right now.' && <p className="m-0 mt-0.5 text-ink">{failure.message}</p>}
              {failure.code !== 'MISSING_FIELDS' && (
                <button
                  type="button"
                  className="mt-1.5 rounded-full border border-danger/50 px-2.5 py-0.5 text-[12.5px] font-medium hover:bg-panel focus-visible:outline-2 focus-visible:outline-accent"
                  onClick={() => {
                    controller.clearFailure()
                    onRetry()
                    void controller.startChat()
                  }}
                >
                  {t('errors.retry')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-line bg-panel px-4 py-3">
        <Button type="submit" variant="primary" block loading={state.submitting} disabled={!requiredFilled || state.submitting}>
          {state.submitting ? t('form.starting') : t('form.start')}
        </Button>
      </div>
    </form>
  )
}
