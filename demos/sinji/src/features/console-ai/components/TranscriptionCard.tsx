/** Transcription defaults: the operator layer of language > diarisation > key terms > audio format. */
import { useEffect, useMemo, useState } from 'react'
import { Mic } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { errorMessage } from '@/api/client'
import { Button, Field, Panel, Select, Switch, Textarea, toast } from '@/components/ui'
import { formatDateTime, formatNumber } from '@/lib/format'
import type { AudioFormat, ContentLang, TranscriptionSettings } from '@/types'
import { useSaveTranscriptionDefault, useTranscriptionDefault } from '../api'
import { QueryState } from './bits'

const KEYTERM_MAX = 1000
const KEYTERM_CHARS = 50
const KEYTERM_WORDS = 5
const FORMATS: AudioFormat[] = ['original', 'flac_full', 'flac_16k', 'wav_16k', 'mp3_16k']
const AUTO = 'auto'

const parseTerms = (raw: string): string[] => [...new Set(raw.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean))]

export function TranscriptionCard() {
  const { t, i18n } = useTranslation('consoleAi')
  const lang = i18n.language
  const query = useTranscriptionDefault()
  const save = useSaveTranscriptionDefault()
  const [language, setLanguage] = useState<string>(AUTO)
  const [diarize, setDiarize] = useState(true)
  const [terms, setTerms] = useState('')
  const [format, setFormat] = useState<AudioFormat>('mp3_16k')
  const [error, setError] = useState<string | undefined>()

  const load = (s: TranscriptionSettings) => {
    setLanguage(s.language_code ?? AUTO)
    setDiarize(s.diarize)
    setTerms(s.keyterms.join('\n'))
    setFormat(s.audio_format)
    setError(undefined)
  }
  useEffect(() => {
    if (query.data) load(query.data.settings)
  }, [query.data])

  const parsed = useMemo(() => parseTerms(terms), [terms])
  const termError = useMemo(() => {
    if (parsed.length > KEYTERM_MAX) return t('transcription.errCount', { max: KEYTERM_MAX })
    for (const term of parsed) {
      if (/[<>{}[\]\\]/.test(term)) return t('transcription.errChars', { term })
      if (term.length > KEYTERM_CHARS || term.split(/\s+/).length > KEYTERM_WORDS) return t('transcription.errLong', { term, chars: KEYTERM_CHARS, words: KEYTERM_WORDS })
    }
    return undefined
  }, [parsed, t])

  const saved = query.data?.settings
  const dirty =
    !!saved &&
    ((saved.language_code ?? AUTO) !== language ||
      saved.diarize !== diarize ||
      saved.audio_format !== format ||
      saved.keyterms.join('\n') !== parsed.join('\n'))

  const submit = async () => {
    if (termError) return setError(termError)
    setError(undefined)
    try {
      await save.mutateAsync({
        language_code: language === AUTO ? null : (language as ContentLang),
        diarize,
        keyterms: parsed,
        audio_format: format,
      })
      toast.success(t('transcription.saved'))
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <Panel title={t('transcription.title')} description={t('transcription.description')} icon={<Mic />}>
      <QueryState loading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} rows={3}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t('transcription.language')} hint={t('transcription.languageHint')}>
            <Select
              value={language}
              onValueChange={setLanguage}
              options={[
                { value: AUTO, label: t('transcription.auto') },
                { value: 'ka', label: t('transcription.langs.ka') },
                { value: 'en', label: t('transcription.langs.en') },
                { value: 'ru', label: t('transcription.langs.ru') },
              ]}
            />
          </Field>
          <Field label={t('transcription.format')} hint={t('transcription.formatHint')}>
            <Select value={format} onValueChange={(v) => setFormat(v as AudioFormat)} options={FORMATS.map((f) => ({ value: f, label: t(`transcription.formats.${f}`) }))} />
          </Field>
          <div className="md:col-span-2">
            <Switch checked={diarize} onCheckedChange={setDiarize} label={t('transcription.diarize')} description={t('transcription.diarizeHint')} />
          </div>
          <Field className="md:col-span-2" label={t('transcription.keyterms')} error={error ?? termError} hint={t('transcription.keytermsHint')}>
            <Textarea mono rows={5} value={terms} onChange={(e) => setTerms(e.target.value)} placeholder={t('transcription.keytermsPh')} />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-muted">
            {t('transcription.count', { n: formatNumber(parsed.length, lang), max: formatNumber(KEYTERM_MAX, lang) })}
            {query.data?.updated_at ? ` · ${t('transcription.updated', { when: formatDateTime(query.data.updated_at, lang), by: query.data.updated_by ?? '-' })}` : ''}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" disabled={!dirty || save.isPending} onClick={() => saved && load(saved)}>
              {t('discard')}
            </Button>
            <Button variant="primary" disabled={!dirty || !!termError} loading={save.isPending} onClick={submit} className="min-w-24">
              {t('save')}
            </Button>
          </div>
        </div>
        <p className="mt-3 rounded-ctl bg-sunken px-3 py-2 text-xs text-muted">{t('transcription.layers')}</p>
      </QueryState>
    </Panel>
  )
}
