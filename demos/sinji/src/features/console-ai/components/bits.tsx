/** Small shared pieces for the console-ai screens. */
import type { ReactNode } from 'react'
import { AudioLines, MessageSquareText, Volume2, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'

import { Button, Callout, Skeleton } from '@/components/ui'
import { errorMessage } from '@/api/client'
import { formatRelative } from '@/lib/format'
import type { AiCapability, AiConnection } from '@/types'

export const capabilityIcon: Record<AiCapability, LucideIcon> = {
  llm: MessageSquareText,
  stt: AudioLines,
  tts: Volume2,
}

export function CapabilityLabel({ capability, short }: { capability: AiCapability; short?: boolean }) {
  const { t } = useTranslation('consoleAi')
  const Icon = capabilityIcon[capability]
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="size-4 shrink-0 text-muted" strokeWidth={1.75} aria-hidden />
      {short ? t(`capability.${capability}`) : t(`capabilityLong.${capability}`)}
    </span>
  )
}

const num = '([\\d\\s\\u00a0\\u202f,]+)'
const DETAIL_PATTERNS: Array<[RegExp, string]> = [
  [new RegExp(`^Responded in ${num} ms$`), 'detail.responded'],
  [new RegExp(`^Transcribed the 4 s probe in ${num} ms$`), 'detail.transcribed'],
  [new RegExp(`^Synthesised 18 characters in ${num} ms$`), 'detail.synthesised'],
  [new RegExp(`^Classified the probe clip in ${num} ms$`), 'detail.classified'],
  [new RegExp(`^Wrote and read back a test object in ${num} ms$`), 'detail.storage'],
  [new RegExp(`^Completed a 24-token round trip in ${num} ms$`), 'detail.roundTrip'],
  [/^Returned a (\d+)-dimension vector in ([\d\s,]+) ms$/, 'detail.vector'],
  [/^Expected (\d+) dimensions, got (\d+)$/, 'detail.dimMismatch'],
  [/^(\d+) chunks indexed$/, 'detail.indexed'],
  [/^(\d+) credentials accepted$/, 'detail.credentials'],
  [/^Queue idle, 0 waiting$/, 'detail.queueIdle'],
  [/^no key stored$/, 'detail.noKey'],
  [/^No default connection$/, 'detail.noDefault'],
  [/^No active credential$/, 'detail.noCredential'],
  [/^No base URL$/, 'detail.noBaseUrl'],
  [/^Connection refused$/, 'detail.refused'],
  [/^Connection is inactive$/, 'detail.inactive'],
]

/** Handlers and seed rows write English probe details; show them in the UI language. */
export function translateDetail(t: TFunction<'consoleAi'>, detail: string): string {
  for (const [re, key] of DETAIL_PATTERNS) {
    const m = re.exec(detail)
    if (m) return t(key, { a: m[1]?.trim(), b: m[2]?.trim(), defaultValue: detail })
  }
  return detail
}

/** The outcome of the last test of a connection, as a chip plus a line of detail. */
export function LastTest({ test, lang }: { test: AiConnection['last_test']; lang: string }) {
  const { t } = useTranslation('consoleAi')
  if (!test) return <span className="text-[13px] text-muted">{t('providers.neverTested')}</span>
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px]">
      <span className={test.ok ? 'font-medium text-success' : 'font-medium text-danger'}>
        {test.ok ? t('providers.testOk') : t('providers.testFailed')}
      </span>
      <span className="text-muted">{formatRelative(test.at, lang)}</span>
      <span className="min-w-0 truncate text-muted">{translateDetail(t, test.detail)}</span>
    </div>
  )
}

/** Loading / error shell for a query-backed block. */
export function QueryState({
  loading,
  error,
  onRetry,
  rows = 3,
  children,
}: {
  loading: boolean
  error: unknown
  onRetry: () => void
  rows?: number
  children: ReactNode
}) {
  const { t } = useTranslation()
  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  }
  if (error) {
    return (
      <Callout
        tone="danger"
        title={t('errors.load', { ns: 'common' })}
        action={
          <Button size="sm" variant="secondary" onClick={onRetry}>
            {t('actions.retry', { ns: 'common' })}
          </Button>
        }
      >
        {errorMessage(error)}
      </Callout>
    )
  }
  return <>{children}</>
}

export const hostOf = (url: string | null): string => {
  if (!url) return ''
  try {
    return new URL(url).host
  } catch {
    return url
  }
}
