import { Pause, Play } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge, Button, Callout, Card, IconButton, Checkbox, SegmentedControl, Skeleton, toast } from '@/components/ui'
import { mediaUrl } from '@/lib/media'
import type { Voice } from '@/types'
import { useErrorText, useSaveVoices, useVoices } from '../api'
import type { VoicesPayload } from '../types'

/** Console > Voices: offer every voice or an allowlist, grouped by language, with a preview for each. */
export default function VoicesPage() {
  const { t } = useTranslation('consolePlatform')
  const query = useVoices()
  if (query.isError)
    return (
      <Callout
        tone="danger"
        title={t('voices.loadFailed')}
        action={
          <Button size="sm" onClick={() => void query.refetch()}>
            {t('actions.retry')}
          </Button>
        }
      />
    )
  if (!query.data) return <Skeleton className="h-96 w-full" />
  return <VoicesForm key={`${query.data.mode}:${query.data.voice_ids.join(',')}`} saved={query.data} />
}

function VoicesForm({ saved }: { saved: VoicesPayload }) {
  const { t } = useTranslation('consolePlatform')
  const errorText = useErrorText()
  const save = useSaveVoices()
  const [mode, setMode] = useState(saved.mode)
  const [picked, setPicked] = useState<Set<string>>(() => new Set(saved.voice_ids.length ? saved.voice_ids : saved.voices.map((v) => v.voice_id)))
  const [error, setError] = useState<string>()
  const [playing, setPlaying] = useState<string | null>(null)
  const audio = useRef<HTMLAudioElement | null>(null)

  useEffect(
    () => () => {
      audio.current?.pause()
      audio.current = null
    },
    [],
  )

  const groups = useMemo(
    () =>
      saved.languages
        .map((lang) => ({ lang, voices: saved.voices.filter((v) => v.language === lang.code) }))
        .filter((g) => g.voices.length),
    [saved],
  )
  const allowlist = mode === 'allowlist'
  const dirty = mode !== saved.mode || (allowlist && [...picked].sort().join() !== [...saved.voice_ids].sort().join())

  const toggle = (id: string, on: boolean) => {
    setError(undefined)
    setPicked((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const setMany = (ids: string[], on: boolean) => {
    setError(undefined)
    setPicked((prev) => {
      const next = new Set(prev)
      for (const id of ids) {
        if (on) next.add(id)
        else next.delete(id)
      }
      return next
    })
  }

  const play = (voice: Voice) => {
    if (playing === voice.voice_id) {
      audio.current?.pause()
      setPlaying(null)
      return
    }
    audio.current?.pause()
    const el = new Audio(mediaUrl(voice.preview_url))
    audio.current = el
    el.onended = () => setPlaying((cur) => (cur === voice.voice_id ? null : cur))
    el.onerror = () => {
      setPlaying(null)
      toast.error(t('voices.previewFailed'))
    }
    setPlaying(voice.voice_id)
    el.play().catch(() => {
      setPlaying(null)
      toast.error(t('voices.previewFailed'))
    })
  }

  const submit = async () => {
    if (allowlist && picked.size === 0) {
      setError(t('errors.at_least_one_voice'))
      return
    }
    try {
      await save.mutateAsync({ mode, voice_ids: allowlist ? [...picked] : [] })
      setError(undefined)
      toast.success(t('voices.toast'))
    } catch (e) {
      setError(errorText.fields(e).voice_ids ?? errorText.text(e))
    }
  }

  return (
    <form
      className="animate-panel-in space-y-5"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <div>
        <h2 className="font-display text-xl font-semibold text-ink">{t('voices.title')}</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">{t('voices.description')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-ink" id="voices-mode">
          {t('voices.mode')}
        </span>
        <SegmentedControl
          aria-label={t('voices.mode')}
          value={mode}
          onValueChange={(next) => {
            setMode(next)
            setError(undefined)
          }}
          options={[
            { value: 'all', label: t('voices.modeAll') },
            { value: 'allowlist', label: t('voices.modeAllowlist') },
          ]}
        />
        {allowlist ? (
          <Badge tone="primary" className="tabular">
            {t('voices.selected', { count: picked.size, total: saved.voices.length })}
          </Badge>
        ) : null}
      </div>

      {!allowlist ? <p className="text-sm text-muted">{t('voices.allBody')}</p> : null}
      {error ? (
        <Callout tone="danger" title={error} />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {groups.map(({ lang, voices }) => {
          const ids = voices.map((v) => v.voice_id)
          return (
            <Card key={lang.code} padded={false}>
              <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
                <div className="min-w-0">
                  <h3 className="font-display text-base font-semibold text-ink">{t(`voices.language.${lang.code}`, { defaultValue: lang.name })}</h3>
                  <p className="tabular text-xs text-muted">
                    {allowlist ? t('voices.selected', { count: ids.filter((id) => picked.has(id)).length, total: ids.length }) : ids.length}
                  </p>
                </div>
                {allowlist ? (
                  <div className="flex shrink-0 gap-1">
                    <Button type="button" size="xs" variant="ghost" onClick={() => setMany(ids, true)}>
                      {t('voices.selectAll')}
                    </Button>
                    <Button type="button" size="xs" variant="ghost" onClick={() => setMany(ids, false)}>
                      {t('voices.selectNone')}
                    </Button>
                  </div>
                ) : null}
              </div>
              <ul className="divide-y divide-line">
                {voices.map((v) => {
                  const on = playing === v.voice_id
                  return (
                    <li key={v.voice_id} className="flex items-center gap-3 px-4 py-2.5">
                      {allowlist ? (
                        <Checkbox checked={picked.has(v.voice_id)} onCheckedChange={(c) => toggle(v.voice_id, c)} aria-label={v.name} />
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-ink">{v.name}</span>
                          {v.is_default ? (
                            <Badge size="sm" tone="accent">
                              {t('voices.default')}
                            </Badge>
                          ) : null}
                        </div>
                        <div className="truncate text-xs text-muted">
                          {t(`voices.gender.${v.gender}`)} · {t(`voices.category.${v.category}`)}
                        </div>
                      </div>
                      <IconButton
                        label={t(on ? 'voices.stop' : 'voices.play', { name: v.name })}
                        icon={on ? <Pause /> : <Play />}
                        size="sm"
                        variant={on ? 'subtle' : 'ghost'}
                        type="button"
                        onClick={() => play(v)}
                      />
                    </li>
                  )
                })}
              </ul>
            </Card>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" loading={save.isPending} disabled={!dirty}>
          {t('actions.save')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={!dirty || save.isPending}
          onClick={() => {
            setMode(saved.mode)
            setPicked(new Set(saved.voice_ids.length ? saved.voice_ids : saved.voices.map((v) => v.voice_id)))
            setError(undefined)
          }}
        >
          {t('actions.discard')}
        </Button>
      </div>
    </form>
  )
}
