import { Play, SlidersHorizontal, Volume2, Wand2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge, Button, Callout, Drawer, EmptyState, Field, Select, Skeleton, Slider, SegmentedControl, Switch, Textarea, toast } from '@/components/ui'
import { cn } from '@/lib/cn'
import { mediaUrl } from '@/lib/media'
import type { ContentLang, TtsClip, Voice } from '@/types'
import { useLimits, useSynthesize, useTtsCatalog } from '../api'
import { AudioPlayer, type PlayerSource } from './AudioPlayer'
import { ErrorNote } from './ErrorNote'

const MAX_CHARS = 2500
const V3 = 'sinji-voice-v3'

type Preset = 'creative' | 'natural' | 'robust'
interface Advanced {
  preset: Preset
  stability: number
  similarity: number
  style: number
  speed: number
  boost: boolean
}
const DEFAULT_ADVANCED: Advanced = { preset: 'natural', stability: 0.5, similarity: 0.75, style: 0, speed: 1, boost: true }

export function TtsPanel() {
  const { t } = useTranslation('voiceTools')
  const catalog = useTtsCatalog()
  const limits = useLimits()
  const synth = useSynthesize()
  const [language, setLanguage] = useState<ContentLang>('ka')
  const [text, setText] = useState(() => t('tts.samples.ka'))
  const [dirty, setDirty] = useState(false)
  const [voiceId, setVoiceId] = useState<string | null>(null)
  const [modelId, setModelId] = useState<string | null>(null)
  const [adv, setAdv] = useState<Advanced>(DEFAULT_ADVANCED)
  const [drawer, setDrawer] = useState(false)
  const [source, setSource] = useState<PlayerSource | null>(null)
  const [clip, setClip] = useState<TtsClip | null>(null)
  const counter = useRef(0)

  const voices = useMemo(() => (catalog.data?.voices ?? []).filter((v) => v.language === language), [catalog.data, language])
  const models = useMemo(() => (catalog.data?.models ?? []).filter((m) => m.supports.includes(language)), [catalog.data, language])
  const voice = voices.find((v) => v.voice_id === voiceId) ?? voices.find((v) => v.is_default) ?? voices[0] ?? null
  const model = models.find((m) => m.model_id === modelId) ?? models.find((m) => m.model_id === catalog.data?.languages.find((l) => l.code === language)?.model) ?? models[0] ?? null
  const isV3 = model?.model_id === V3

  // Switching language swaps the sample sentence unless the visitor has typed their own text.
  useEffect(() => {
    if (!dirty) setText(t(`tts.samples.${language}`))
  }, [language, dirty, t])

  const remaining = limits.data?.remaining.tts ?? 1
  const blocked = limits.data ? !limits.data.enabled || !limits.data.features.tts || remaining <= 0 : false
  const trimmed = text.trim()
  const tooLong = text.length > MAX_CHARS

  const preview = (v: Voice) => {
    counter.current += 1
    setSource({
      id: `preview-${v.voice_id}-${counter.current}`,
      url: mediaUrl(v.preview_url),
      title: t('tts.previewOf', { name: v.name }),
      subtitle: t('tts.previewNote'),
      autoplay: true,
    })
  }

  const run = () => {
    if (!voice || !model || !trimmed || tooLong) return
    synth.mutate(
      {
        text: trimmed,
        language_code: language,
        voice_id: voice.voice_id,
        model_id: model.model_id,
        settings: isV3 ? { preset: adv.preset } : { stability: adv.stability, similarity: adv.similarity, style: adv.style, speed: adv.speed, speaker_boost: adv.boost },
      },
      {
        onSuccess: (result) => {
          setClip(result)
          const ext = result.audio_url.split('.').pop() || 'm4a'
          setSource({
            id: result.id,
            url: mediaUrl(result.audio_url),
            title: t('tts.clipBy', { name: voice.name }),
            subtitle: t('tts.clipMeta', { language: t(`languages.${result.language_code}`), model: model.name }),
            downloadName: `sinji-${voice.name.toLowerCase()}-${language}.${ext}`,
            autoplay: true,
            duration: result.duration_s,
          })
          toast.success(t('tts.ready'))
        },
      },
    )
  }

  if (catalog.isLoading) return <Skeleton className="h-96 w-full rounded-card" />
  if (catalog.isError || !catalog.data) {
    return (
      <Callout tone="danger" title={t('errors.catalog')}>
        <Button size="sm" variant="secondary" onClick={() => void catalog.refetch()}>
          {t('quota.retry')}
        </Button>
      </Callout>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-5">
        <Field label={t('tts.language')}>
          <SegmentedControl
            value={language}
            onValueChange={(v) => {
              setLanguage(v as ContentLang)
              setVoiceId(null)
              setModelId(null)
            }}
            options={catalog.data.languages.map((l) => ({ value: l.code, label: l.name }))}
          />
        </Field>
        <p className="-mt-3 text-xs text-muted">{t(`tts.languageNote.${language}`)}</p>

        <Field
          label={t('tts.text')}
          hint={
            <span className={cn('tabular', tooLong && 'text-danger')}>{t('tts.chars', { n: text.length, max: MAX_CHARS })}</span>
          }
          error={tooLong ? t('tts.tooLong', { max: MAX_CHARS }) : undefined}
        >
          <Textarea
            rows={5}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setDirty(true)
            }}
            placeholder={t('tts.textPlaceholder')}
            lang={language}
          />
        </Field>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-[13px] font-medium text-ink">{t('tts.voice')}</legend>
          {voices.length === 0 ? (
            <EmptyState compact title={t('tts.noVoices')} body={t('tts.noVoicesBody')} />
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {voices.map((v) => {
                const active = v.voice_id === voice?.voice_id
                return (
                  <li key={v.voice_id}>
                    <div
                      className={cn(
                        'flex items-center gap-2 rounded-card border p-2 transition-colors',
                        active ? 'border-primary bg-primary/6' : 'border-line bg-panel hover:border-line-strong',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setVoiceId(v.voice_id)}
                        aria-pressed={active}
                        className="min-w-0 flex-1 rounded-ctl px-1.5 py-1 text-left"
                      >
                        <span className="block truncate text-sm font-medium text-ink">{v.name}</span>
                        <span className="block truncate text-xs text-muted">
                          {t(`tts.gender.${v.gender}`)} · {t(`tts.category.${v.category}`)}
                        </span>
                      </button>
                      <Button size="xs" variant="ghost" icon={<Play />} onClick={() => preview(v)} aria-label={t('tts.previewVoice', { name: v.name })}>
                        {t('tts.preview')}
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field label={t('tts.model')}>
            <Select
              value={model?.model_id ?? ''}
              onValueChange={setModelId}
              options={models.map((m) => ({ value: m.model_id, label: m.name }))}
              placeholder={t('tts.model')}
            />
          </Field>
          <Button variant="secondary" icon={<SlidersHorizontal />} onClick={() => setDrawer(true)}>
            {t('tts.advanced')}
          </Button>
        </div>

        <div className="flex flex-col gap-3">
          <Button size="lg" icon={<Wand2 />} loading={synth.isPending} disabled={!trimmed || tooLong || !voice || !model || blocked} onClick={run}>
            {synth.isPending ? t('tts.working') : t('tts.synthesize')}
          </Button>
          {blocked && limits.data?.enabled && remaining <= 0 ? <p className="text-sm text-danger">{t('quota.exhausted.tts')}</p> : null}
          <ErrorNote error={synth.error} />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <h3 className="flex items-center gap-2 font-display text-lg text-ink">
          <Volume2 className="size-5 text-accent" aria-hidden /> {t('tts.result')}
        </h3>
        <AudioPlayer source={source} />
        {clip ? (
          <div className="rounded-card border border-line bg-sunken p-4 text-sm">
            <div className="mb-2 flex flex-wrap gap-1.5">
              <Badge tone="primary">{t(`languages.${clip.language_code}`)}</Badge>
              <Badge>{voices.find((v) => v.voice_id === clip.voice_id)?.name ?? clip.voice_id}</Badge>
              <Badge tone="accent">{t('tts.seconds', { n: clip.duration_s.toFixed(1) })}</Badge>
            </div>
            <p lang={clip.language_code} className="line-clamp-4 text-muted">
              {clip.text}
            </p>
          </div>
        ) : null}
        <Callout tone="info">{t('tts.demoNote')}</Callout>
      </div>

      <Drawer
        open={drawer}
        onOpenChange={setDrawer}
        title={t('tts.advanced')}
        description={t('tts.advancedHint')}
        footer={
          <Button variant="ghost" onClick={() => setAdv(DEFAULT_ADVANCED)}>
            {t('tts.resetAdvanced')}
          </Button>
        }
      >
        {isV3 ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted">{t('tts.presetHint')}</p>
            <SegmentedControl
              value={adv.preset}
              onValueChange={(v) => setAdv({ ...adv, preset: v as Preset })}
              options={(['creative', 'natural', 'robust'] as Preset[]).map((p) => ({ value: p, label: t(`tts.presets.${p}`) }))}
            />
            <p className="rounded-ctl bg-sunken p-3 text-sm text-muted">{t(`tts.presetNote.${adv.preset}`)}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <Field label={t('tts.stability')} hint={t('tts.stabilityHint')}>
              <Slider value={adv.stability} min={0} max={1} step={0.01} onValueChange={(v) => setAdv({ ...adv, stability: v })} format={(v) => v.toFixed(2)} />
            </Field>
            <Field label={t('tts.similarity')} hint={t('tts.similarityHint')}>
              <Slider value={adv.similarity} min={0} max={1} step={0.01} onValueChange={(v) => setAdv({ ...adv, similarity: v })} format={(v) => v.toFixed(2)} />
            </Field>
            <Field label={t('tts.style')} hint={t('tts.styleHint')}>
              <Slider value={adv.style} min={0} max={1} step={0.01} onValueChange={(v) => setAdv({ ...adv, style: v })} format={(v) => v.toFixed(2)} />
            </Field>
            <Field label={t('tts.speed')} hint={t('tts.speedHint')}>
              <Slider value={adv.speed} min={0.7} max={1.2} step={0.01} onValueChange={(v) => setAdv({ ...adv, speed: v })} format={(v) => `${v.toFixed(2)}x`} />
            </Field>
            <Switch checked={adv.boost} onCheckedChange={(v) => setAdv({ ...adv, boost: v })} label={t('tts.boost')} description={t('tts.boostHint')} />
          </div>
        )}
      </Drawer>
    </div>
  )
}
