/**
 * Building blocks of the API playground (/playground). Owner: launcher.
 */
import { ChevronDown, Clock3, FastForward, Lock, Play, RotateCcw, Unlock } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Badge,
  BarsLoader,
  Button,
  Card,
  CardHeader,
  CopyButton,
  ErrorState,
  Input,
  Skeleton,
  StatusBadge,
  Textarea,
  toast,
} from '@/components/ui'
import { isApiError } from '@/api/client'
import { MS_DAY } from '@/demo/analytics'
import { useLang } from '@/hooks/useLang'
import { request } from '@/lib/api'
import { formatDateTime, formatMs } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ApiEnvelope, QuestionsData } from '@/types'

import { useDemoClock, usePlaygroundRoutes, useSetDemoClock } from '../api'
import type { InboxLinkStatus } from '../types'

const ICON = { size: 20, strokeWidth: 1.75 } as const

/* -------------------------------------------------------- token combobox */

export interface TokenOption {
  token: string
  status: InboxLinkStatus
  label: string
}

export function TokenCombobox({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (value: string, picked: boolean) => void
  options: TokenOption[]
}) {
  const { t } = useTranslation('launcher')
  const id = useId()
  const listId = `${id}-list`
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  const query = value.trim().toUpperCase()
  const exact = options.some((option) => option.token === query)
  const visible = !query || exact ? options : options.filter((option) => option.token.includes(query))

  const pick = (option: TokenOption) => {
    onChange(option.token, true)
    setOpen(false)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setActive((index) => Math.min(index + 1, Math.max(visible.length - 1, 0)))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Enter' && open && visible[active]) {
      event.preventDefault()
      pick(visible[active])
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      <label htmlFor={id} className="mb-1.5 block font-mono text-xs font-semibold text-muted">
        {t('playground.surveyId')}
      </label>
      <Input
        id={id}
        mono
        size="sm"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        spellCheck={false}
        placeholder={t('playground.surveyIdPlaceholder')}
        value={value}
        onChange={(event) => {
          onChange(event.target.value, false)
          setOpen(true)
          setActive(0)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
        rightSlot={
          <button
            type="button"
            tabIndex={-1}
            aria-label={t('playground.knownTokens')}
            className="grid size-7 place-items-center rounded-full text-muted hover:bg-panel-2"
            onMouseDown={(event) => {
              event.preventDefault()
              setOpen((state) => !state)
            }}
          >
            <ChevronDown {...ICON} className="size-4" />
          </button>
        }
      />
      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label={t('playground.knownTokens')}
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-border bg-panel p-1 shadow-float"
        >
          {visible.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted">{t('playground.noMatch')}</p>
          ) : (
            visible.map((option, index) => (
              <div
                key={option.token}
                role="option"
                aria-selected={option.token === query}
                onMouseDown={(event) => {
                  event.preventDefault()
                  pick(option)
                }}
                onMouseEnter={() => setActive(index)}
                className={cn(
                  'flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-1.5',
                  index === active && 'bg-panel-2',
                )}
              >
                <span className="min-w-0">
                  <span className="block font-mono text-sm font-semibold text-ink">{option.token}</span>
                  <span className="block truncate text-xs text-muted">{option.label}</span>
                </span>
                <StatusBadge status={option.status} size="sm" />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------ JSON panel */

function JsonLine({ line }: { line: string }) {
  const match = /^(\s*)("(?:[^"\\]|\\.)*")(:\s?)(.*)$/.exec(line)
  if (!match) return <>{line || ' '}</>
  return (
    <>
      {match[1]}
      <span className="text-mint">{match[2]}</span>
      {match[3]}
      <span className="text-[#F3D9EC]">{match[4]}</span>
    </>
  )
}

export function JsonPanel({ value }: { value: unknown }) {
  const lines = useMemo(() => JSON.stringify(value, null, 2).split('\n'), [value])
  return (
    <pre className="max-h-[420px] overflow-auto rounded-xl bg-plum py-3 font-mono text-[12.5px] leading-[1.6] text-mist">
      {lines.map((line, index) => (
        <div key={index} className="flex rounded px-3 hover:bg-white/10">
          <span aria-hidden="true" className="mr-3 w-6 shrink-0 text-right text-mist/35 select-none tabular">
            {index + 1}
          </span>
          <span className="whitespace-pre-wrap break-all">
            <JsonLine line={line} />
          </span>
        </div>
      ))}
    </pre>
  )
}

/* ---------------------------------------------------------- request card */

export type RequestKind = 'validate' | 'questions' | 'submit'

const PATHS: Record<RequestKind, string> = {
  validate: '/surveys/validate',
  questions: '/surveys/questions',
  submit: '/surveys/responses',
}

const RATE_PATTERN = [5, 4, 5, 4, 5]

interface RunResult {
  status: number
  ms: number
  body: unknown
}

function initialBody(kind: RequestKind, token: string, lang: string): string {
  if (kind !== 'submit') return JSON.stringify({ survey_id: token, lang }, null, 2)
  return JSON.stringify(
    {
      survey_id: token,
      responses: [1101, 1102, 1103, 1104].map((id, index) => ({ id, question_rate: RATE_PATTERN[index] })),
      comment: 'Quick, friendly and the loan terms were explained clearly.',
    },
    null,
    2,
  )
}

export function RequestCard({
  kind,
  options,
  defaultToken,
  icon,
}: {
  kind: RequestKind
  options: TokenOption[]
  defaultToken: string
  icon: React.ReactNode
}) {
  const { t } = useTranslation('launcher')
  const lang = useLang()
  const [surveyId, setSurveyId] = useState(defaultToken)
  const [bodyText, setBodyText] = useState(() => initialBody(kind, defaultToken, lang))
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<RunResult | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const prefillRun = useRef(0)

  const path = PATHS[kind]

  /** Writes survey_id into the JSON (when it parses) and, for Submit, rebuilds responses[]. */
  const changeToken = (token: string, picked: boolean) => {
    setSurveyId(token)
    setNote(null)
    let parsed: Record<string, unknown> | null = null
    try {
      const value: unknown = JSON.parse(bodyText)
      if (value && typeof value === 'object' && !Array.isArray(value)) parsed = value as Record<string, unknown>
    } catch {
      parsed = null
    }
    if (parsed) {
      parsed.survey_id = token
      setBodyText(JSON.stringify(parsed, null, 2))
      setError(null)
    }
    if (kind === 'submit' && (picked || token.trim().length === 6)) void prefillResponses(token.trim())
  }

  const prefillResponses = async (token: string) => {
    const run = ++prefillRun.current
    try {
      const envelope = await request<ApiEnvelope<QuestionsData>>('POST', '/surveys/questions', {
        body: { survey_id: token, lang },
      })
      if (run !== prefillRun.current || !envelope.success) return
      const questions = envelope.data.questions
      setBodyText((current) => {
        try {
          const value = JSON.parse(current) as Record<string, unknown>
          value.responses = questions.map((question, index) => ({
            id: question.id,
            question_rate: RATE_PATTERN[index % RATE_PATTERN.length],
          }))
          return JSON.stringify(value, null, 2)
        } catch {
          return current
        }
      })
      setNote(t('playground.prefilled', { count: questions.length }))
    } catch {
      // A token the API rejects keeps the current responses[]; Run shows why.
    }
  }

  const changeBody = (text: string) => {
    setBodyText(text)
    setError(null)
    try {
      const value = JSON.parse(text) as { survey_id?: unknown }
      if (value && typeof value.survey_id === 'string') setSurveyId(value.survey_id)
    } catch {
      // Validated on Run.
    }
  }

  const run = async () => {
    let body: unknown
    try {
      body = JSON.parse(bodyText)
    } catch (parseError) {
      setError(t('playground.invalidJson', { error: (parseError as Error).message }))
      return
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      setError(t('playground.needObject'))
      return
    }
    setError(null)
    setRunning(true)
    const started = performance.now()
    let outcome: RunResult
    try {
      const data = await request<unknown>('POST', path, { body })
      outcome = { status: 200, ms: performance.now() - started, body: data }
    } catch (failure) {
      const ms = performance.now() - started
      outcome = isApiError(failure)
        ? {
            status: failure.status,
            ms,
            body:
              Object.keys(failure.fieldErrors).length > 0
                ? { detail: failure.message, errors: failure.fieldErrors }
                : { detail: failure.message },
          }
        : { status: 500, ms, body: { detail: failure instanceof Error ? failure.message : String(failure) } }
    }
    setResult(outcome)
    setRunning(false)
  }

  const envelope =
    result && result.body && typeof result.body === 'object' && 'success' in result.body
      ? (result.body as { success: boolean })
      : null
  const responseText = result ? JSON.stringify(result.body, null, 2) : ''

  return (
    <Card padding="lg">
      <CardHeader
        icon={icon}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {t(`playground.cards.${kind}.title`)}
            <Badge size="sm" tone="info" mono>
              POST /api{path}
            </Badge>
          </span>
        }
        description={t(`playground.cards.${kind}.description`)}
      />

      <div className="grid gap-4">
        <div className="min-w-0 space-y-3">
          <TokenCombobox value={surveyId} onChange={changeToken} options={options} />
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted">{t('playground.requestJson')}</span>
              <CopyButton value={bodyText} label={t('playground.copyRequest')} />
            </div>
            <Textarea
              mono
              rows={kind === 'submit' ? 14 : 5}
              spellCheck={false}
              value={bodyText}
              invalid={Boolean(error)}
              aria-label={t('playground.requestJson')}
              aria-invalid={Boolean(error)}
              onChange={(event) => changeBody(event.target.value)}
              className="text-[12.5px]"
            />
            {error && (
              <p role="alert" className="mt-1.5 text-xs text-danger">
                {error}
              </p>
            )}
            {note && !error && <p className="mt-1.5 text-xs text-muted">{note}</p>}
            {kind === 'submit' && <p className="mt-1.5 text-xs text-muted">{t('playground.submitWarning')}</p>}
          </div>
          <Button leftIcon={<Play {...ICON} />} onClick={() => void run()} loading={running} disabled={running}>
            {running ? t('playground.running') : t('playground.run')}
          </Button>
        </div>

        <div className="min-w-0">
          <div className="mb-1.5 flex min-h-8 flex-wrap items-center justify-between gap-2">
            <span className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted">
              {t('playground.response')}
              {result && !running && (
                <>
                  <Badge size="sm" tone={result.status < 300 ? 'success' : 'danger'} mono>
                    {t('playground.httpStatus', { status: result.status })}
                  </Badge>
                  <Badge size="sm" tone="neutral" mono icon={<Clock3 {...ICON} />}>
                    {formatMs(result.ms)}
                  </Badge>
                  {envelope && (
                    <Badge size="sm" tone={envelope.success ? 'success' : 'warning'} mono>
                      {envelope.success ? t('playground.envelopeOk') : t('playground.envelopeFail')}
                    </Badge>
                  )}
                </>
              )}
            </span>
            {result && !running && <CopyButton value={responseText} label={t('playground.copyResponse')} />}
          </div>
          {running ? (
            <div className="grid h-40 place-items-center rounded-xl bg-plum text-mint">
              <BarsLoader size="md" label={t('playground.running')} className="text-mint" />
            </div>
          ) : result ? (
            <JsonPanel value={result.body} />
          ) : (
            <div className="grid h-40 place-items-center rounded-xl border border-dashed border-border-strong px-4 text-center text-sm text-muted">
              {t('playground.idle')}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------ demo clock */

const MAX_DAYS = 60

export function ClockCard() {
  const { t } = useTranslation('launcher')
  const lang = useLang()
  const clockQuery = useDemoClock()
  const setClock = useSetDemoClock()
  const [, setTick] = useState(0)

  // Keep "demo now" ticking; skip while the tab is hidden.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!document.hidden) setTick((value) => value + 1)
    }, 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const offsetMs = clockQuery.data?.offsetMs ?? 0
  const offsetDays = Math.round(offsetMs / MS_DAY)
  const demoNow = new Date(Date.now() + offsetMs)

  const travel = (days: number) => {
    setClock.mutate(days, {
      onSuccess: (state) => {
        if (days === 0) toast.success(t('playground.clock.resetDone'))
        else toast.success(t('playground.clock.moved', { date: formatDateTime(state.now, lang) }))
      },
      onError: (failure) => toast.error(failure instanceof Error ? failure.message : String(failure)),
    })
  }

  return (
    <Card padding="lg">
      <CardHeader
        icon={<Clock3 {...ICON} />}
        title={t('playground.clock.title')}
        description={t('playground.clock.description')}
      />
      {clockQuery.isError ? (
        <ErrorState compact onRetry={() => void clockQuery.refetch()} />
      ) : clockQuery.isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : (
        <div className="rounded-xl bg-panel-2 p-3">
          <p className="text-xs font-medium text-muted">{t('playground.clock.now')}</p>
          <p className="mt-0.5 font-display text-xl font-semibold text-ink tabular">{formatDateTime(demoNow, lang)}</p>
          <div className="mt-2">
            {offsetDays > 0 ? (
              <Badge tone="warning" icon={<FastForward {...ICON} />}>
                {t('playground.clock.offset', { count: offsetDays })}
              </Badge>
            ) : (
              <Badge tone="success">{t('playground.clock.real')}</Badge>
            )}
          </div>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={setClock.isPending || offsetDays + 1 > MAX_DAYS}
          onClick={() => travel(offsetDays + 1)}
        >
          {t('playground.clock.plusOne')}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={setClock.isPending || offsetDays + 7 > MAX_DAYS}
          onClick={() => travel(offsetDays + 7)}
        >
          {t('playground.clock.plusSeven')}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          leftIcon={<RotateCcw {...ICON} />}
          disabled={setClock.isPending || offsetMs === 0}
          onClick={() => travel(0)}
        >
          {t('playground.clock.reset')}
        </Button>
        {setClock.isPending && <BarsLoader size="xs" />}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted">
        {offsetDays + 1 > MAX_DAYS ? t('playground.clock.limit') : t('playground.clock.hint')}
      </p>
    </Card>
  )
}

/* -------------------------------------------------------------- routes */

const METHOD_TONE = { GET: 'info', POST: 'primary', PUT: 'warning', PATCH: 'warning', DELETE: 'danger' } as const

export function RoutesCard() {
  const { t } = useTranslation('launcher')
  const routes = usePlaygroundRoutes()
  return (
    <Card padding="lg">
      <CardHeader
        title={t('playground.routes.title')}
        description={t('playground.routes.description')}
        actions={
          routes.data ? (
            <span className="text-xs text-muted tabular">{t('playground.routes.count', { count: routes.data.length })}</span>
          ) : undefined
        }
      />
      {routes.isError ? (
        <ErrorState compact description={t('playground.routes.error')} onRetry={() => void routes.refetch()} />
      ) : routes.isLoading || !routes.data ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-7 w-full" />
          ))}
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {routes.data.map((route) => (
            <li key={`${route.method} ${route.path}`} className="flex items-center gap-2 py-1.5">
              <Badge
                size="sm"
                mono
                tone={METHOD_TONE[route.method as keyof typeof METHOD_TONE] ?? 'neutral'}
                className="w-14 shrink-0 justify-center"
              >
                {route.method}
              </Badge>
              <span className="min-w-0 flex-1 font-mono text-xs break-all text-ink">{route.path}</span>
              {route.requiresAuth ? (
                <Badge size="sm" tone="warning" variant="outline" icon={<Lock {...ICON} />}>
                  {t('playground.routes.auth')}
                </Badge>
              ) : (
                <Badge size="sm" tone="success" variant="outline" icon={<Unlock {...ICON} />}>
                  {t('playground.routes.public')}
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
