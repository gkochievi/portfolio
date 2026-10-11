import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, Checkbox, Dialog, Field, Select, Switch, Textarea } from '@/components/ui'
import type { AudioFormat, ContentLang, TranscriptionSettings } from '@/types'

const FORMATS: AudioFormat[] = ['original', 'flac_full', 'flac_16k', 'wav_16k', 'mp3_16k']

export function validateKeyterms(text: string): { terms: string[]; error: string | null } {
  const terms = text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
  if (terms.length > 1000) return { terms, error: 'count' }
  if (terms.some((k) => k.length >= 50)) return { terms, error: 'length' }
  if (terms.some((k) => k.split(/\s+/).length > 5)) return { terms, error: 'words' }
  return { terms, error: null }
}

/** Per-file transcription override. Starts from the workspace's effective settings. */
export function OverrideDialog({
  open,
  onOpenChange,
  fileName,
  defaults,
  value,
  multiple,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  fileName: string
  defaults: TranscriptionSettings
  value: Partial<TranscriptionSettings> | null
  multiple: boolean
  onSave: (override: Partial<TranscriptionSettings> | null, applyToAll: boolean) => void
}) {
  const { t } = useTranslation('workbench')
  const [language, setLanguage] = useState<string>('auto')
  const [diarize, setDiarize] = useState(true)
  const [keyterms, setKeyterms] = useState('')
  const [format, setFormat] = useState<AudioFormat>('original')
  const [all, setAll] = useState(false)

  useEffect(() => {
    if (!open) return
    const merged = { ...defaults, ...(value ?? {}) }
    setLanguage(merged.language_code ?? 'auto')
    setDiarize(merged.diarize)
    setKeyterms(merged.keyterms.join('\n'))
    setFormat(merged.audio_format)
    setAll(false)
  }, [open, defaults, value])

  const check = validateKeyterms(keyterms)

  const save = () => {
    if (check.error) return
    const code = language === 'auto' ? null : (language as ContentLang)
    const next: Partial<TranscriptionSettings> = {}
    if (code !== defaults.language_code) next.language_code = code
    if (diarize !== defaults.diarize) next.diarize = diarize
    if (check.terms.join('\n') !== defaults.keyterms.join('\n')) next.keyterms = check.terms
    if (format !== defaults.audio_format) next.audio_format = format
    onSave(Object.keys(next).length > 0 ? next : null, all)
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('override.title')}
      description={t('override.description', { name: fileName })}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={() => {
              onSave(null, all)
              onOpenChange(false)
            }}>
            {t('override.useDefaults')}
          </Button>
          <Button variant="primary" onClick={save} disabled={Boolean(check.error)}>
            {t('override.apply')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={t('override.language')} hint={t('override.languageHint')}>
          <Select
            value={language}
            onValueChange={setLanguage}
            options={[
              { value: 'auto', label: t('override.auto') },
              { value: 'ka', label: t('lang.ka') },
              { value: 'en', label: t('lang.en') },
              { value: 'ru', label: t('lang.ru') },
            ]}
          />
        </Field>
        <Switch checked={diarize} onCheckedChange={setDiarize} label={t('override.diarize')} description={t('override.diarizeHint')} />
        <Field
          label={t('override.keyterms')}
          hint={t('override.keytermsHint')}
          error={check.error ? t(`override.keytermsError.${check.error}`) : undefined}
        >
          <Textarea rows={4} value={keyterms} onChange={(e) => setKeyterms(e.target.value)} />
        </Field>
        <Field label={t('override.format')}>
          <Select
            value={format}
            onValueChange={(v) => setFormat(v as AudioFormat)}
            options={FORMATS.map((f) => ({ value: f, label: t(`audioFormat.${f}`) }))}
          />
        </Field>
        {multiple ? <Checkbox checked={all} onCheckedChange={setAll} label={t('override.applyAll')} /> : null}
      </div>
    </Dialog>
  )
}
