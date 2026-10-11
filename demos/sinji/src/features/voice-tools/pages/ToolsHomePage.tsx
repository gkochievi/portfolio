import { ArrowRight, AudioLines, FileText, Gauge, LogIn, Repeat, Waves } from 'lucide-react'
import { useId, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'

import { BellCurve } from '@/components/brand'
import { Button } from '@/components/ui'
import { cn } from '@/lib/cn'
import { useAccount } from '@/lib/session'
import { useHealth } from '../api'
import { ConvertPanel } from '../components/ConvertPanel'
import { QuotaBanner } from '../components/QuotaBanner'
import { SentimentPanel } from '../components/SentimentPanel'
import { TranscribePanel } from '../components/TranscribePanel'
import { TtsPanel } from '../components/TtsPanel'

type Tool = 'tts' | 'transcribe' | 'sentiment' | 'convert'

const TOOLS: Array<{ id: Tool; icon: typeof AudioLines; needsAccount: boolean }> = [
  { id: 'tts', icon: AudioLines, needsAccount: false },
  { id: 'transcribe', icon: FileText, needsAccount: true },
  { id: 'sentiment', icon: Waves, needsAccount: true },
  { id: 'convert', icon: Repeat, needsAccount: false },
]

function ApiStatus() {
  const { t } = useTranslation('voiceTools')
  const health = useHealth()
  const state = health.isLoading ? 'checking' : health.data?.ok ? 'online' : 'offline'
  return (
    <span
      role="status"
      className="inline-flex items-center gap-2 rounded-pill border border-line bg-panel px-3 py-1 text-xs text-muted"
    >
      <span
        aria-hidden
        className={cn('size-2 rounded-full', state === 'online' ? 'bg-success' : state === 'offline' ? 'bg-danger' : 'animate-pulse bg-subtle')}
      />
      {t(`api.${state}`)}
      {state === 'online' && health.data ? <span className="font-mono text-subtle">{t('api.version', { version: health.data.version })}</span> : null}
    </span>
  )
}

export default function ToolsHomePage() {
  const { t } = useTranslation('voiceTools')
  const { t: tc } = useTranslation('common')
  const account = useAccount()
  const [params, setParams] = useSearchParams()
  const baseId = useId()

  const available = TOOLS.filter((tool) => !tool.needsAccount || account)
  const requested = params.get('tool') as Tool | null
  const active: Tool = available.some((tool) => tool.id === requested) ? (requested as Tool) : 'tts'

  const select = (id: Tool) => {
    const next = new URLSearchParams(params)
    if (id === 'tts') next.delete('tool')
    else next.set('tool', id)
    setParams(next, { replace: true })
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = available.findIndex((tool) => tool.id === active)
    const move = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!move) return
    event.preventDefault()
    const next = available[(index + move + available.length) % available.length]
    if (next) {
      select(next.id)
      document.getElementById(`${baseId}-tab-${next.id}`)?.focus()
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <header className="relative overflow-hidden rounded-card border border-line bg-panel px-5 py-8 sm:px-8 sm:py-10">
        <BellCurve className="pointer-events-none absolute -right-8 bottom-0 hidden h-40 w-[420px] text-primary/15 md:block" />
        <div className="relative flex max-w-2xl flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="caps text-xs text-accent">{t('hero.eyebrow')}</span>
            <ApiStatus />
          </div>
          <h1 className="font-display text-3xl leading-tight text-ink sm:text-4xl">{tc('brand.tagline')}</h1>
          <p className="text-[15px] leading-relaxed text-muted">{t('hero.lead')}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="secondary" iconRight={<ArrowRight />}>
              <Link to="/editor">{t('hero.editor')}</Link>
            </Button>
            {!account ? (
              <Button asChild variant="ghost" icon={<LogIn />}>
                <Link to="/login">{t('hero.signIn')}</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      <QuotaBanner />

      <div>
        <div role="tablist" aria-label={t('tabs.label')} onKeyDown={onKeyDown} className="scrollbar-thin flex gap-1 overflow-x-auto border-b border-line">
          {available.map((tool) => {
            const Icon = tool.icon
            const selected = tool.id === active
            return (
              <button
                key={tool.id}
                id={`${baseId}-tab-${tool.id}`}
                role="tab"
                type="button"
                aria-selected={selected}
                aria-controls={`${baseId}-panel-${tool.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => select(tool.id)}
                className={cn(
                  'relative inline-flex h-11 shrink-0 items-center gap-2 whitespace-nowrap px-3 text-sm font-medium transition-colors sm:px-4',
                  'after:absolute after:inset-x-3 after:bottom-[-1px] after:h-0.5 after:rounded-full after:transition-colors',
                  selected ? 'text-ink after:bg-primary' : 'text-muted after:bg-transparent hover:text-ink',
                )}
              >
                <Icon className="size-4" aria-hidden />
                {t(`tabs.${tool.id}`)}
              </button>
            )
          })}
          {!account ? (
            <Link to="/login" className="ml-auto hidden shrink-0 items-center gap-1.5 self-center px-3 text-xs text-muted hover:text-ink md:inline-flex">
              <Gauge className="size-3.5" aria-hidden /> {t('signInHint')}
            </Link>
          ) : null}
        </div>

        {/* Panels stay mounted so a half-finished job survives a tab switch. */}
        <div className="pt-6">
          {available.map((tool) => (
            <div
              key={tool.id}
              role="tabpanel"
              id={`${baseId}-panel-${tool.id}`}
              aria-labelledby={`${baseId}-tab-${tool.id}`}
              hidden={tool.id !== active}
            >
              {tool.id === 'tts' ? <TtsPanel /> : tool.id === 'transcribe' ? <TranscribePanel /> : tool.id === 'sentiment' ? <SentimentPanel /> : <ConvertPanel />}
            </div>
          ))}
        </div>
        {!account ? <p className="pt-6 text-center text-xs text-subtle md:hidden">{t('signInHint')}</p> : null}
      </div>
    </div>
  )
}
