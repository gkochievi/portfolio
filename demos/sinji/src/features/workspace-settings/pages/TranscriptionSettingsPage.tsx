import { Undo2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge, Button, Callout, ConfirmDialog, Field, Panel, ReadOnlyNote, Select, Skeleton, Switch, Textarea, toast } from '@/components/ui'
import { useFormat } from '@/lib/format'
import { useCanEdit } from '@/lib/session'
import type { AudioFormat, ContentLang, TranscriptionConfigView, TranscriptionSettings } from '@/types'
import { errorMessage, useRevertTranscription, useSaveTranscription, useTranscription } from '../api'
import { checkKeytermsText, KEYTERM_MAX_CHARS, KEYTERM_MAX_ITEMS, KEYTERM_MAX_WORDS } from '../lib/keyterms'

const FORMATS: AudioFormat[] = ['original', 'flac_full', 'flac_16k', 'wav_16k', 'mp3_16k']
type LangChoice = 'auto' | ContentLang
const SHOWN_LINE_ERRORS = 5

type FieldKey = keyof TranscriptionSettings
const FIELD_KEYS: FieldKey[] = ['language_code', 'diarize', 'keyterms', 'audio_format']

function TranscriptionForm({ view, canEdit }: { view: TranscriptionConfigView; canEdit: boolean }) {
  const { t } = useTranslation('settings')
  const f = useFormat()
  const save = useSaveTranscription()
  const revert = useRevertTranscription()
  const [language, setLanguage] = useState<LangChoice>(view.effective.language_code ?? 'auto')
  const [diarize, setDiarize] = useState(view.effective.diarize)
  const [keyterms, setKeyterms] = useState(view.effective.keyterms.join('\n'))
  const [format, setFormat] = useState<AudioFormat>(view.effective.audio_format)
  const [error, setError] = useState<string | null>(null)
  const [revertOpen, setRevertOpen] = useState(false)

  const check = useMemo(() => checkKeytermsText(keyterms), [keyterms])
  const dirty =
    (language === 'auto' ? null : language) !== view.effective.language_code ||
    diarize !== view.effective.diarize ||
    format !== view.effective.audio_format ||
    JSON.stringify(check.terms) !== JSON.stringify(view.effective.keyterms)

  const langLabel = (code: ContentLang | null) => t(`transcription.languages.${code ?? 'auto'}`)
  const display = (key: FieldKey, s: TranscriptionSettings): string => {
    switch (key) {
      case 'language_code':
        return langLabel(s.language_code)
      case 'diarize':
        return s.diarize ? t('transcription.on') : t('transcription.off')
      case 'keyterms':
        return s.keyterms.length ? t('transcription.termsCount', { n: s.keyterms.length }) : t('transcription.noTerms')
      case 'audio_format':
        return t(`transcription.formats.${s.audio_format}`)
    }
  }
  const inheritedSource = t(`transcription.source.${view.inherited.source}`)

  const submit = async () => {
    setError(null)
    if (!check.valid) return
    // Only what differs from the inherited layers is stored, so the rest keeps inheriting.
    const body: Partial<TranscriptionSettings> = {}
    const lang = language === 'auto' ? null : language
    if (lang !== view.inherited.language_code) body.language_code = lang
    if (diarize !== view.inherited.diarize) body.diarize = diarize
    if (format !== view.inherited.audio_format) body.audio_format = format
    if (JSON.stringify(check.terms) !== JSON.stringify(view.inherited.keyterms)) body.keyterms = check.terms
    try {
      await save.mutateAsync(body)
      toast.success(t('transcription.saved'))
    } catch (e) {
      setError(errorMessage(e, t('transcription.failed')))
    }
  }

  const doRevert = async () => {
    try {
      await revert.mutateAsync()
      setRevertOpen(false)
      toast.success(t('transcription.reverted'))
    } catch (e) {
      setRevertOpen(false)
      setError(errorMessage(e, t('transcription.failed')))
    }
  }

  const keytermError = check.tooMany ? t('transcription.errors.tooMany', { max: KEYTERM_MAX_ITEMS }) : null

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <Panel title={t('transcription.title')} description={t('transcription.description')}>
        <div className="space-y-5">
          {canEdit ? null : <ReadOnlyNote />}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('transcription.language')} hint={t('transcription.languageHint')}>
              <Select
                value={language}
                disabled={!canEdit}
                onValueChange={(v) => setLanguage(v as LangChoice)}
                options={(['auto', 'ka', 'en', 'ru'] as const).map((v) => ({ value: v, label: t(`transcription.languages.${v}`) }))}
              />
            </Field>
            <Field label={t('transcription.format')} hint={t('transcription.formatHint')}>
              <Select
                value={format}
                disabled={!canEdit}
                onValueChange={(v) => setFormat(v as AudioFormat)}
                options={FORMATS.map((v) => ({ value: v, label: t(`transcription.formats.${v}`) }))}
              />
            </Field>
          </div>
          <Switch checked={diarize} onCheckedChange={setDiarize} disabled={!canEdit} label={t('transcription.diarize')} description={t('transcription.diarizeHint')} />
          <div className="space-y-2">
            <Field
              label={t('transcription.keyterms')}
              hint={t('transcription.keytermsHint', { max: KEYTERM_MAX_ITEMS, chars: KEYTERM_MAX_CHARS, words: KEYTERM_MAX_WORDS })}
              error={keytermError}
            >
              <Textarea mono rows={9} value={keyterms} disabled={!canEdit} spellCheck={false} placeholder={t('transcription.keytermsPlaceholder')} onChange={(e) => setKeyterms(e.target.value)} />
            </Field>
            <p className="tabular text-xs text-muted">{t('transcription.termCount', { n: check.terms.length, max: KEYTERM_MAX_ITEMS })}</p>
            {check.lineErrors.length > 0 ? (
              <ul className="space-y-1 rounded-ctl border border-danger/30 bg-danger/8 px-3 py-2 text-xs text-danger" role="alert">
                {check.lineErrors.slice(0, SHOWN_LINE_ERRORS).map((e) => (
                  <li key={e.line}>
                    {t(`transcription.errors.${e.issue}`, { line: e.line, term: e.term.length > 40 ? `${e.term.slice(0, 40)}…` : e.term, chars: KEYTERM_MAX_CHARS, words: KEYTERM_MAX_WORDS })}
                  </li>
                ))}
                {check.lineErrors.length > SHOWN_LINE_ERRORS ? <li>{t('transcription.errors.more', { n: check.lineErrors.length - SHOWN_LINE_ERRORS })}</li> : null}
              </ul>
            ) : null}
          </div>
          {error ? <Callout tone="danger">{error}</Callout> : null}
          {canEdit ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" loading={save.isPending} disabled={!dirty || !check.valid} onClick={() => void submit()}>
                {t('transcription.save')}
              </Button>
              {view.override ? (
                <Button variant="ghost" icon={<Undo2 />} onClick={() => setRevertOpen(true)}>
                  {t('transcription.revert')}
                </Button>
              ) : null}
            </div>
          ) : null}
          {view.updated_by ? <p className="text-xs text-muted">{t('rubric.lastSaved', { when: f.relative(view.updated_at), who: view.updated_by })}</p> : null}
        </div>
      </Panel>

      <Panel title={t('transcription.effective.title')} description={t('transcription.effective.description')}>
        <ul className="divide-y divide-line">
          {FIELD_KEYS.map((key) => {
            const own = view.override != null && key in view.override
            return (
              <li key={key} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[13px] font-medium">{t(`transcription.fields.${key}`)}</span>
                  <Badge tone={own ? 'accent' : 'neutral'} size="sm">
                    {own ? t('transcription.origin.workspace') : t('transcription.origin.inherited')}
                  </Badge>
                </div>
                <p className="mt-1 break-words text-sm">{display(key, view.effective)}</p>
                <p className="mt-0.5 break-words text-xs text-muted">{t('transcription.inheritedValue', { value: display(key, view.inherited), source: inheritedSource })}</p>
              </li>
            )
          })}
        </ul>
        <p className="mt-4 text-xs text-muted">{t('transcription.chain')}</p>
      </Panel>

      <ConfirmDialog
        open={revertOpen}
        onOpenChange={setRevertOpen}
        title={t('transcription.revertTitle')}
        body={t('transcription.revertBody')}
        confirmLabel={t('transcription.revertConfirm')}
        onConfirm={doRevert}
      />
    </div>
  )
}

/** Transcription settings. OWNED BY: workspace-settings. */
export default function TranscriptionSettingsPage() {
  const { t } = useTranslation('settings')
  const canEdit = useCanEdit()
  const query = useTranscription()

  if (query.isLoading) return <Skeleton className="h-96 w-full" />
  if (query.isError || !query.data) {
    return (
      <Callout tone="danger" action={<Button size="sm" onClick={() => void query.refetch()}>{t('retry')}</Button>}>
        {t('loadError')}
      </Callout>
    )
  }
  return <TranscriptionForm key={`${query.data.updated_at ?? 'inherited'}`} view={query.data} canEdit={canEdit} />
}
