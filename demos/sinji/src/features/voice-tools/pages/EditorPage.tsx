import {
  ArrowLeftRight,
  Crop,
  Download,
  FlipHorizontal2,
  FolderOpen,
  Layers,
  Maximize2,
  Merge,
  Music,
  Pause,
  Phone,
  Play,
  Plus,
  Redo2,
  Scissors,
  SkipBack,
  TrendingDown,
  TrendingUp,
  Trash2,
  Undo2,
  Volume2,
  VolumeX,
  Waves,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge, Button, Callout, Dialog, Field, IconButton, PageHeader, Panel, Select, Slider, toast } from '@/components/ui'
import { cn } from '@/lib/cn'
import { useConvertFormats, useLimits } from '../api'
import demoClipUrl from '../assets/demo-clip.wav?inline'
import { BatchView, FormatSelect, useConvertRun } from '../components/ConvertParts'
import { ErrorNote } from '../components/ErrorNote'
import {
  channelOp,
  cutRange,
  encodeWav,
  fadeRange,
  gainRange,
  isAudible,
  layerDuration,
  layerLength,
  mixdown,
  normaliseRange,
  projectDuration,
  rangeFor,
  reverseRange,
  silenceRange,
  trimRange,
  type ChannelOp,
  type Layer,
} from '../editor/dsp'
import { EditorCanvas, type Selection } from '../editor/EditorCanvas'
import { dataUrlToArrayBuffer, Player } from '../editor/player'

interface Snapshot {
  layers: Layer[]
  activeId: string | null
}

const HISTORY = 30
const FADE_DEFAULT_S = 0.5

function clock(t: number): string {
  const safe = Math.max(0, t)
  const m = Math.floor(safe / 60)
  const s = safe - m * 60
  return `${m}:${s.toFixed(2).padStart(5, '0')}`
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-1.5">
      <span className="caps text-[11px] text-subtle">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  )
}

function Tool({ icon: Icon, label, onClick, disabled, hint }: { icon: LucideIcon; label: string; onClick: () => void; disabled?: boolean; hint?: string }) {
  return (
    <Button size="sm" variant="secondary" icon={<Icon />} onClick={onClick} disabled={disabled} title={hint}>
      {label}
    </Button>
  )
}

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export default function EditorPage() {
  const { t } = useTranslation('voiceTools')
  const limits = useLimits()
  const run = useConvertRun()
  const player = useRef<Player | null>(null)
  if (!player.current) player.current = new Player()
  const engine = player.current

  const [snap, setSnap] = useState<Snapshot>({ layers: [], activeId: null })
  const snapRef = useRef(snap)
  snapRef.current = snap
  const past = useRef<Snapshot[]>([])
  const future = useRef<Snapshot[]>([])
  const coalesce = useRef<{ key: string; at: number } | null>(null)
  const [, bump] = useState(0)
  const ids = useRef(0)

  const [selection, setSelection] = useState<Selection | null>(null)
  const [playhead, setPlayhead] = useState(0)
  const [playing, setPlaying] = useState(false)
  const stopAt = useRef<number | null>(null)
  const [viewW, setViewW] = useState(900)
  const [fit, setFit] = useState(true)
  const [manualPps, setManualPps] = useState(80)
  const [gainDb, setGainDb] = useState(3)
  const [chOp, setChOp] = useState<ChannelOp>('swap')
  const [busy, setBusy] = useState(false)
  const [phone, setPhone] = useState(false)
  const [mixFile, setMixFile] = useState<File | null>(null)
  const [phoneFormat, setPhoneFormat] = useState('')
  const [over, setOver] = useState(false)
  const openInput = useRef<HTMLInputElement>(null)
  const addInput = useRef<HTMLInputElement>(null)

  const { layers, activeId } = snap
  const active = layers.find((l) => l.id === activeId) ?? null
  const duration = projectDuration(layers)
  const hasSel = !!selection && selection.b - selection.a > 0.001
  const maxMb = limits.data?.max_audio_mb ?? 25
  const fitPps = Math.min(4000, Math.max(4, (viewW - 48) / Math.max(duration, 0.5)))
  const pps = fit ? fitPps : Math.min(4000, Math.max(fitPps, manualPps))

  useEffect(() => () => engine.dispose(), [engine])

  /* ----------------------------------------------------------- history */

  const commit = useCallback((next: Snapshot, key?: string) => {
    const now = Date.now()
    const last = coalesce.current
    if (!(key && last && last.key === key && now - last.at < 900)) {
      past.current.push(snapRef.current)
      if (past.current.length > HISTORY) past.current.shift()
    }
    coalesce.current = key ? { key, at: now } : null
    future.current = []
    snapRef.current = next
    setSnap(next)
    bump((n) => n + 1)
  }, [])

  const stopPlayback = useCallback(() => {
    if (!engine.playing) return
    setPlayhead(engine.stop())
    setPlaying(false)
  }, [engine])

  const undo = useCallback(() => {
    const previous = past.current.pop()
    if (!previous) return
    stopPlayback()
    future.current.push(snapRef.current)
    coalesce.current = null
    snapRef.current = previous
    setSnap(previous)
    bump((n) => n + 1)
  }, [stopPlayback])

  const redo = useCallback(() => {
    const next = future.current.pop()
    if (!next) return
    stopPlayback()
    past.current.push(snapRef.current)
    coalesce.current = null
    snapRef.current = next
    setSnap(next)
    bump((n) => n + 1)
  }, [stopPlayback])

  /* ----------------------------------------------------------- loading */

  const newLayer = (name: string, channels: Float32Array[], sampleRate: number): Layer => {
    ids.current += 1
    return { id: `layer-${ids.current}`, name, channels, sampleRate, offset: 0, gain: 0, muted: false, solo: false }
  }

  const importBuffer = async (name: string, read: () => Promise<ArrayBuffer>, mode: 'replace' | 'add') => {
    setBusy(true)
    try {
      const { channels, sampleRate } = await engine.decode(await read())
      const layer = newLayer(name, channels, sampleRate)
      stopPlayback()
      if (mode === 'replace' || !snapRef.current.layers.length) {
        commit({ layers: [layer], activeId: layer.id })
        setSelection(null)
        setPlayhead(0)
      } else {
        commit({ layers: [...snapRef.current.layers, layer], activeId: layer.id })
      }
    } catch {
      toast.error(t('editor.decodeFailed'))
    } finally {
      setBusy(false)
    }
  }

  const loadFile = (file: File | undefined, mode: 'replace' | 'add') => {
    if (!file) return
    if (file.size > maxMb * 1024 * 1024) return void toast.error(t('editor.tooLarge', { mb: maxMb }))
    void importBuffer(file.name, () => file.arrayBuffer(), mode)
  }

  const loadDemo = (mode: 'replace' | 'add') => void importBuffer(t('editor.demoClipName'), async () => dataUrlToArrayBuffer(demoClipUrl), mode)

  /* ---------------------------------------------------------- playback */

  const play = useCallback(
    async (from: number, until: number | null) => {
      const current = snapRef.current.layers
      if (!current.length) return
      const total = projectDuration(current)
      const begin = until === null && from >= total - 0.02 ? 0 : from
      stopAt.current = until
      try {
        await engine.play(current, begin, until)
        setPlayhead(begin)
        setPlaying(true)
      } catch {
        toast.error(t('editor.playFailed'))
      }
    },
    [engine, t],
  )

  const toggle = useCallback(() => {
    if (engine.playing) stopPlayback()
    else void play(playhead, null)
  }, [engine, play, playhead, stopPlayback])

  useEffect(() => {
    if (!playing) return
    let raf = 0
    const tick = () => {
      const pos = engine.position()
      const end = stopAt.current ?? projectDuration(snapRef.current.layers)
      if (pos >= end) {
        engine.stop()
        setPlaying(false)
        setPlayhead(end)
        return
      }
      setPlayhead(pos)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, engine])

  useEffect(() => {
    if (engine.playing) engine.setLive(layers)
  }, [layers, engine])

  const seek = useCallback(
    (time: number) => {
      const t0 = Math.max(0, Math.min(projectDuration(snapRef.current.layers), time))
      if (engine.playing) void play(t0, stopAt.current)
      else setPlayhead(t0)
    },
    [engine, play],
  )

  const markIn = useCallback(() => setSelection((s) => ({ a: playhead, b: Math.max(playhead, s?.b ?? playhead) })), [playhead])
  const markOut = useCallback(() => setSelection((s) => ({ a: Math.min(s?.a ?? playhead, playhead), b: playhead })), [playhead])

  const keys = useRef({ toggle, undo, redo, markIn, markOut })
  keys.current = { toggle, undo, redo, markIn, markOut }
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null
      if (target?.closest('input:not([type=range]), textarea, select, [contenteditable=true], [role=combobox], [role=dialog]')) return
      const mod = event.metaKey || event.ctrlKey
      if (event.code === 'Space') {
        event.preventDefault()
        keys.current.toggle()
      } else if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) keys.current.redo()
        else keys.current.undo()
      } else if (mod && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        keys.current.redo()
      } else if (!mod && event.key.toLowerCase() === 'i') keys.current.markIn()
      else if (!mod && event.key.toLowerCase() === 'o') keys.current.markOut()
      else if (event.key === 'Escape') setSelection(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /* ------------------------------------------------------------- edits */

  const edit = (
    fn: (layer: Layer, range: [number, number]) => Layer | null,
    opts: { needsSelection?: boolean; fallback?: (layer: Layer) => [number, number] | null; after?: () => void } = {},
  ) => {
    const { layers: current, activeId: id } = snapRef.current
    const layer = current.find((l) => l.id === id)
    if (!layer) return
    if (opts.needsSelection && !hasSel) return void toast.info(t('editor.needSelection'))
    const range = hasSel ? rangeFor(layer, selection) : (opts.fallback ?? (() => rangeFor(layer, null)))(layer)
    if (!range) return void toast.info(t('editor.needSelection'))
    const out = fn(layer, range)
    if (!out) return void toast.info(t('editor.nothingToDo'))
    stopPlayback()
    const next = layerLength(out) === 0 ? current.filter((l) => l.id !== layer.id) : current.map((l) => (l.id === layer.id ? out : l))
    commit({ layers: next, activeId: next.find((l) => l.id === id)?.id ?? next[0]?.id ?? null })
    opts.after?.()
  }

  const doCut = () =>
    edit((l, [a, b]) => ({ ...l, channels: cutRange(l.channels, a, b) }), {
      needsSelection: true,
      after: () => {
        setPlayhead(selection?.a ?? 0)
        setSelection(null)
      },
    })
  const doTrim = () =>
    edit((l, [a, b]) => ({ ...l, channels: trimRange(l.channels, a, b), offset: l.offset + a / l.sampleRate }), {
      needsSelection: true,
      after: () => setSelection(null),
    })
  const doSilence = () => edit((l, [a, b]) => ({ ...l, channels: silenceRange(l.channels, a, b) }))
  const doReverse = () => edit((l, [a, b]) => ({ ...l, channels: reverseRange(l.channels, a, b) }))
  const doFade = (direction: 'in' | 'out') =>
    edit((l, [a, b]) => ({ ...l, channels: fadeRange(l.channels, a, b, direction) }), {
      fallback: (l) => {
        const n = Math.min(layerLength(l), Math.round(FADE_DEFAULT_S * l.sampleRate))
        return n > 0 ? (direction === 'in' ? [0, n] : [layerLength(l) - n, layerLength(l)]) : null
      },
    })
  const doGain = () => edit((l, [a, b]) => ({ ...l, channels: gainRange(l.channels, a, b, gainDb) }))
  const doNormalise = () =>
    edit((l, [a, b]) => {
      const out = normaliseRange(l.channels, a, b)
      return out ? { ...l, channels: out } : null
    })
  const doChannels = () =>
    edit((l, [a, b]) => {
      const out = channelOp(l.channels, chOp, a, b)
      return out ? { ...l, channels: out } : null
    })

  const patchLayer = (id: string, patch: Partial<Layer>, key?: string) => {
    if ('offset' in patch) stopPlayback()
    const { layers: current, activeId: act } = snapRef.current
    commit({ layers: current.map((l) => (l.id === id ? { ...l, ...patch } : l)), activeId: act }, key)
  }
  const removeLayer = (id: string) => {
    stopPlayback()
    const rest = layers.filter((l) => l.id !== id)
    commit({ layers: rest, activeId: id === activeId ? (rest[0]?.id ?? null) : activeId })
  }
  const flatten = () => {
    stopPlayback()
    const mix = mixdown(layers, layers[0]?.sampleRate ?? engine.sampleRate)
    const merged = newLayer(t('editor.flattened'), mix.channels, mix.sampleRate)
    commit({ layers: [merged], activeId: merged.id })
    setSelection(null)
    toast.success(t('editor.flattenedToast'))
  }

  const exportWav = () => {
    if (!layers.length) return
    const mix = mixdown(layers, layers[0]?.sampleRate ?? engine.sampleRate)
    download(encodeWav(mix.channels, mix.sampleRate), 'sinji-mix.wav')
    toast.success(t('editor.exported'))
  }

  const openPhone = () => {
    if (!layers.length) return
    const mix = mixdown(layers, layers[0]?.sampleRate ?? engine.sampleRate)
    setMixFile(new File([encodeWav(mix.channels, mix.sampleRate)], 'sinji-mix.wav', { type: 'audio/wav' }))
    setPhone(true)
  }

  const zoom = (factor: number) => {
    const next = pps * factor
    if (next <= fitPps * 1.001) setFit(true)
    else {
      setFit(false)
      setManualPps(Math.min(4000, next))
    }
  }

  const canUndo = past.current.length > 0
  const canRedo = future.current.length > 0
  const anyAudible = layers.some((l) => isAudible(l, layers))
  const summary = useMemo(() => t('editor.canvasLabel', { layers: layers.length, duration: duration.toFixed(1) }), [t, layers.length, duration])

  /* ------------------------------------------------------------- render */

  if (!layers.length) {
    return (
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <PageHeader title={t('editor.title')} description={t('editor.lead')} />
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setOver(true)
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setOver(false)
            loadFile(e.dataTransfer.files[0], 'replace')
          }}
          className={cn(
            'flex flex-col items-center gap-4 rounded-card border border-dashed px-4 py-16 text-center transition-colors',
            over ? 'border-primary bg-primary/6' : 'border-line-strong bg-sunken',
          )}
        >
          <Waves className="size-8 text-accent" aria-hidden />
          <div>
            <p className="font-display text-xl text-ink">{t('editor.emptyTitle')}</p>
            <p className="mt-1 text-sm text-muted">{t('editor.emptyBody', { mb: maxMb })}</p>
          </div>
          <input ref={openInput} type="file" accept="audio/*,.wav,.mp3,.m4a,.ogg,.opus,.flac,.webm" className="sr-only" tabIndex={-1} aria-label={t('editor.open')} onChange={(e) => { loadFile(e.target.files?.[0], 'replace'); e.target.value = '' }} />
          <div className="flex flex-wrap justify-center gap-2">
            <Button icon={<FolderOpen />} loading={busy} onClick={() => openInput.current?.click()}>
              {t('editor.open')}
            </Button>
            <Button variant="secondary" icon={<Music />} loading={busy} onClick={() => loadDemo('replace')}>
              {t('editor.loadDemo')}
            </Button>
          </div>
        </div>
        <ul className="grid gap-3 text-sm text-muted sm:grid-cols-3">
          {(['local', 'layers', 'export'] as const).map((k) => (
            <li key={k} className="rounded-card border border-line bg-panel p-4">
              <p className="mb-1 font-medium text-ink">{t(`editor.points.${k}.title`)}</p>
              {t(`editor.points.${k}.body`)}
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader
        title={t('editor.title')}
        description={t('editor.lead')}
        actions={
          <>
            <input ref={openInput} type="file" accept="audio/*,.wav,.mp3,.m4a,.ogg,.opus,.flac,.webm" className="sr-only" tabIndex={-1} aria-label={t('editor.open')} onChange={(e) => { loadFile(e.target.files?.[0], 'replace'); e.target.value = '' }} />
            <Button size="sm" variant="secondary" icon={<FolderOpen />} loading={busy} onClick={() => openInput.current?.click()}>
              {t('editor.open')}
            </Button>
            <Button size="sm" variant="secondary" icon={<Download />} onClick={exportWav}>
              {t('editor.exportWav')}
            </Button>
            <Button size="sm" icon={<Phone />} onClick={openPhone}>
              {t('editor.exportPhone')}
            </Button>
          </>
        }
      />

      {/* Transport */}
      <div className="flex flex-wrap items-center gap-2 rounded-card border border-line bg-panel p-2.5">
        <IconButton label={t('editor.toStart')} icon={<SkipBack />} onClick={() => seek(0)} />
        <Button size="sm" icon={playing ? <Pause /> : <Play />} onClick={toggle} disabled={!anyAudible} aria-keyshortcuts="Space">
          {playing ? t('editor.pause') : t('editor.play')}
          <kbd className="ml-1 hidden rounded border border-line px-1 font-mono text-[10px] text-subtle sm:inline">{t('editor.space')}</kbd>
        </Button>
        <Button size="sm" variant="secondary" disabled={!hasSel || !anyAudible} onClick={() => selection && void play(selection.a, selection.b)}>
          {t('editor.playSelection')}
        </Button>
        <span className="tabular font-mono text-sm text-ink" aria-label={t('editor.position')}>{clock(playhead)}</span>
        <span className="text-xs text-subtle">/ {clock(duration)}</span>
        <div className="mx-1 hidden h-6 w-px bg-line sm:block" />
        <Button size="sm" variant="ghost" onClick={markIn} aria-keyshortcuts="I">{t('editor.markIn')}</Button>
        <Button size="sm" variant="ghost" onClick={markOut} aria-keyshortcuts="O">{t('editor.markOut')}</Button>
        {hasSel && selection ? (
          <Badge tone="accent">{t('editor.selection', { start: clock(selection.a), end: clock(selection.b), length: (selection.b - selection.a).toFixed(2) })}</Badge>
        ) : (
          <span className="text-xs text-subtle">{t('editor.noSelection')}</span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <IconButton label={t('editor.zoomOut')} icon={<ZoomOut />} onClick={() => zoom(1 / 1.5)} disabled={fit} />
          <IconButton label={t('editor.zoomFit')} icon={<Maximize2 />} onClick={() => setFit(true)} disabled={fit} />
          <IconButton label={t('editor.zoomIn')} icon={<ZoomIn />} onClick={() => zoom(1.5)} />
        </div>
      </div>

      <EditorCanvas
        layers={layers}
        activeId={activeId}
        pps={pps}
        playhead={playhead}
        selection={selection}
        following={playing}
        label={summary}
        onSeek={seek}
        onSelect={setSelection}
        onPickLayer={(id) => commit({ layers: snapRef.current.layers, activeId: id }, 'pick')}
        onViewWidth={setViewW}
      />
      <p className="-mt-3 text-xs text-subtle">{t('editor.canvasHint')}</p>

      {/* Edit tools */}
      <Panel title={t('editor.tools')} description={active ? t('editor.activeLayer', { name: active.name }) : undefined}>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <Group label={t('editor.groups.history')}>
            <Button size="sm" variant="secondary" icon={<Undo2 />} onClick={undo} disabled={!canUndo} aria-keyshortcuts="Control+Z">{t('editor.undo')}</Button>
            <Button size="sm" variant="secondary" icon={<Redo2 />} onClick={redo} disabled={!canRedo} aria-keyshortcuts="Control+Shift+Z">{t('editor.redo')}</Button>
            <span className="tabular text-xs text-subtle">{t('editor.steps', { n: past.current.length, max: HISTORY })}</span>
          </Group>
          <Group label={t('editor.groups.cut')}>
            <Tool icon={Scissors} label={t('editor.cut')} onClick={doCut} disabled={!hasSel} hint={t('editor.cutHint')} />
            <Tool icon={Crop} label={t('editor.trim')} onClick={doTrim} disabled={!hasSel} hint={t('editor.trimHint')} />
            <Tool icon={VolumeX} label={t('editor.silence')} onClick={doSilence} hint={t('editor.scopeHint')} />
            <Tool icon={FlipHorizontal2} label={t('editor.reverse')} onClick={doReverse} hint={t('editor.scopeHint')} />
          </Group>
          <Group label={t('editor.groups.fades')}>
            <Tool icon={TrendingUp} label={t('editor.fadeIn')} onClick={() => doFade('in')} hint={t('editor.fadeHint')} />
            <Tool icon={TrendingDown} label={t('editor.fadeOut')} onClick={() => doFade('out')} hint={t('editor.fadeHint')} />
          </Group>
          <Group label={t('editor.groups.levels')}>
            <div className="flex w-full max-w-[260px] items-center gap-3">
              <Slider value={gainDb} min={-24} max={24} step={0.5} onValueChange={setGainDb} format={(v) => `${v > 0 ? '+' : ''}${v} dB`} aria-label={t('editor.gain')} />
            </div>
            <Tool icon={Volume2} label={t('editor.applyGain')} onClick={doGain} hint={t('editor.scopeHint')} />
            <Tool icon={Waves} label={t('editor.normalise')} onClick={doNormalise} hint={t('editor.normaliseHint')} />
          </Group>
          <Group label={t('editor.groups.channels')}>
            <div className="w-44">
              <Select
                size="sm"
                value={chOp}
                onValueChange={(v) => setChOp(v as ChannelOp)}
                aria-label={t('editor.channelOp')}
                options={(['swap', 'mono', 'left', 'right', 'invert', 'stereo'] as ChannelOp[]).map((o) => ({ value: o, label: t(`editor.channelOps.${o}`) }))}
              />
            </div>
            <Tool icon={ArrowLeftRight} label={t('editor.applyChannels')} onClick={doChannels} />
          </Group>
        </div>
        <p className="mt-4 text-xs text-subtle">{t('editor.scopeNote')}</p>
      </Panel>

      {/* Layers */}
      <Panel
        title={t('editor.layers')}
        icon={<Layers />}
        description={t('editor.layersHint')}
        actions={
          <>
            <input ref={addInput} type="file" accept="audio/*,.wav,.mp3,.m4a,.ogg,.opus,.flac,.webm" className="sr-only" tabIndex={-1} aria-label={t('editor.addLayer')} onChange={(e) => { loadFile(e.target.files?.[0], 'add'); e.target.value = '' }} />
            <Button size="sm" variant="secondary" icon={<Plus />} loading={busy} disabled={layers.length >= 8} onClick={() => addInput.current?.click()}>
              {t('editor.addLayer')}
            </Button>
            <Button size="sm" variant="ghost" icon={<Music />} disabled={layers.length >= 8 || busy} onClick={() => loadDemo('add')}>
              {t('editor.addDemo')}
            </Button>
            <Button size="sm" variant="secondary" icon={<Merge />} disabled={layers.length < 2} onClick={flatten}>
              {t('editor.flatten')}
            </Button>
          </>
        }
      >
        <ul className="flex flex-col gap-2">
          {layers.map((layer) => {
            const isActive = layer.id === activeId
            return (
              <li
                key={layer.id}
                className={cn('grid items-center gap-x-4 gap-y-2 rounded-card border p-3 lg:grid-cols-[minmax(0,1.2fr)_150px_minmax(0,1fr)_auto]', isActive ? 'border-primary/50 bg-primary/5' : 'border-line')}
              >
                <button type="button" onClick={() => commit({ layers, activeId: layer.id }, 'pick')} className="min-w-0 text-left" aria-pressed={isActive}>
                  <span className="block truncate text-sm font-medium text-ink">{layer.name}</span>
                  <span className="block text-xs text-muted">
                    {t('editor.layerMeta', { duration: layerDuration(layer).toFixed(2), channels: layer.channels.length === 1 ? t('editor.mono') : t('editor.stereo'), rate: Math.round(layer.sampleRate / 100) / 10 })}
                  </span>
                </button>
                <Field label={t('editor.offset')} inline>
                  <input
                    type="number"
                    min={0}
                    step={0.05}
                    value={Number(layer.offset.toFixed(2))}
                    onChange={(e) => patchLayer(layer.id, { offset: Math.max(0, Number(e.target.value) || 0) }, `offset-${layer.id}`)}
                    className="h-8 w-20 rounded-ctl border border-line-strong bg-panel px-2 text-right font-mono text-sm text-ink"
                  />
                </Field>
                <div className="flex items-center gap-3">
                  <span className="shrink-0 text-xs text-muted">{t('editor.layerGain')}</span>
                  <Slider value={layer.gain} min={-24} max={12} step={0.5} onValueChange={(v) => patchLayer(layer.id, { gain: v }, `gain-${layer.id}`)} format={(v) => `${v > 0 ? '+' : ''}${v} dB`} aria-label={t('editor.layerGain')} />
                </div>
                <div className="flex items-center gap-1">
                  <Button size="xs" variant={layer.muted ? 'primary' : 'secondary'} aria-pressed={layer.muted} onClick={() => patchLayer(layer.id, { muted: !layer.muted })}>
                    {t('editor.mute')}
                  </Button>
                  <Button size="xs" variant={layer.solo ? 'accent' : 'secondary'} aria-pressed={layer.solo} onClick={() => patchLayer(layer.id, { solo: !layer.solo })}>
                    {t('editor.solo')}
                  </Button>
                  <IconButton label={t('editor.removeLayer', { name: layer.name })} icon={<Trash2 />} variant="ghost" onClick={() => removeLayer(layer.id)} />
                </div>
              </li>
            )
          })}
        </ul>
      </Panel>

      <Callout tone="info">{t('editor.privacy')}</Callout>

      <Dialog
        open={phone}
        onOpenChange={(open) => {
          setPhone(open)
          if (!open) run.reset()
        }}
        title={t('editor.phoneTitle')}
        description={t('editor.phoneBody')}
        size="lg"
      >
        <PhoneExport file={mixFile} format={phoneFormat} onFormat={setPhoneFormat} runner={run} />
      </Dialog>
    </div>
  )
}

function PhoneExport({
  file,
  format,
  onFormat,
  runner,
}: {
  file: File | null
  format: string
  onFormat: (id: string) => void
  runner: ReturnType<typeof useConvertRun>
}) {
  const { t } = useTranslation('voiceTools')
  const formats = useConvertFormats()
  const limits = useLimits()
  if (!formats.data) return <p className="text-sm text-muted">{t('editor.phoneLoading')}</p>
  const list = formats.data.formats
  const chosen = format || list.find((f) => f.id === 'ulaw_8k')?.id || list[0]?.id || ''
  const remaining = limits.data?.remaining.conversions ?? 1
  const blocked = limits.data ? !limits.data.enabled || !limits.data.features.convert || remaining <= 0 : false

  if (runner.active && runner.batch) {
    return <BatchView batch={runner.batch} files={runner.files} formats={list} onReset={runner.reset} />
  }
  return (
    <div className="flex flex-col gap-4">
      <Field label={t('convert.format')}>
        <FormatSelect formats={list} value={chosen} onChange={onFormat} />
      </Field>
      <p className="text-xs text-muted">{t('editor.phoneUses', { remaining })}</p>
      <Button loading={runner.pending} disabled={!file || blocked} onClick={() => file && runner.start([file], chosen)}>
        {runner.pending ? t('convert.starting') : t('editor.phoneRun')}
      </Button>
      {blocked && limits.data?.enabled && remaining <= 0 ? <p className="text-sm text-danger">{t('quota.exhausted.conversions')}</p> : null}
      <ErrorNote error={runner.error} />
    </div>
  )
}
