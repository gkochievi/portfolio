import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Lock, PhoneCall, Sparkles, Timer } from 'lucide-react'

import { errorMessage, fieldErrors, isAccessError } from '@/api/client'
import {
  Banner,
  Button,
  Card,
  CardBody,
  CardHeader,
  CopyButton,
  Dialog,
  ErrorState,
  Field,
  Input,
  Mono,
  Skeleton,
  toast,
} from '@/components/ui'
import { cn } from '@/lib/cn'
import type { Extension } from '@/types'
import {
  emailToName,
  formatCountdown,
  generateSecret,
  sendDisconnectBeacon,
  useCreateExtension,
  useExtensionLock,
  useNextExtension,
  useReleaseLock,
  useStartLock,
} from '../api'
import { translateError } from '../lib/errors'

interface FormErrors {
  email?: string
  secret?: string
  form?: string
}

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const handle = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(handle)
  }, [active])
  return now
}

function countdownTone(remainingMs: number): 'success' | 'warning' | 'danger' {
  if (remainingMs <= 60_000) return 'danger'
  if (remainingMs <= 180_000) return 'warning'
  return 'success'
}

const TONE_TEXT = { success: 'text-success', warning: 'text-warning', danger: 'text-danger' } as const
const TONE_FILL = { success: 'bg-success/12', warning: 'bg-warning/12', danger: 'bg-danger/12' } as const

export function ProvisionCard({ onCreated }: { onCreated?: (extension: Extension) => void }) {
  const { t } = useTranslation('extensions')
  const lockQuery = useExtensionLock()
  const nextQuery = useNextExtension()
  const start = useStartLock()
  const release = useReleaseLock()
  const create = useCreateExtension()

  const lock = lockQuery.data ?? null
  const now = useNow(lock !== null)
  const remaining = lock ? Date.parse(lock.expiresAt) - now : 0
  const tone = countdownTone(remaining)

  const [email, setEmail] = useState('')
  const [secret, setSecret] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [timeUp, setTimeUp] = useState<string | null>(null)
  const [created, setCreated] = useState<Extension | null>(null)

  const prevLock = useRef(lock)
  const endedByUs = useRef(false)
  const expiring = useRef(false)

  const resetForm = useCallback(() => {
    setEmail('')
    setSecret('')
    setErrors({})
  }, [])

  // A lock that vanishes without us ending it (swept on expiry, or released from another tab).
  useEffect(() => {
    const prev = prevLock.current
    prevLock.current = lock
    if (lock && !prev) {
      endedByUs.current = false
      expiring.current = false
    }
    if (prev && !lock && !endedByUs.current) {
      if (Date.parse(prev.expiresAt) <= Date.now() + 2000) setTimeUp(prev.extension)
      resetForm()
    }
  }, [lock, resetForm])

  // Countdown reached zero: release (the server logs the expiry) and say so.
  useEffect(() => {
    if (!lock || remaining > 0 || expiring.current) return
    expiring.current = true
    endedByUs.current = true
    const number = lock.extension
    release.mutate(undefined, {
      onSettled: () => {
        setTimeUp(number)
        resetForm()
      },
    })
  }, [lock, remaining, release, resetForm])

  // Tab hidden while a number is reserved: tell the audit log.
  const lockId = lock?.id
  useEffect(() => {
    if (!lockId) return
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') sendDisconnectBeacon()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [lockId])

  const onStart = () => {
    setTimeUp(null)
    start.mutate(undefined, {
      onError: (error) => toast.error(errorMessage(error, t('provision.loadError'))),
    })
  }

  const onCancel = () => {
    endedByUs.current = true
    release.mutate(undefined, {
      onSuccess: () => {
        resetForm()
        toast(t('provision.released'))
      },
      onError: (error) => {
        endedByUs.current = false
        toast.error(errorMessage(error))
      },
    })
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!lock || create.isPending) return
    setErrors({})
    create.mutate(
      { email, secret },
      {
        onSuccess: (extension) => {
          endedByUs.current = true
          resetForm()
          setCreated(extension)
          onCreated?.(extension)
        },
        onError: (error) => {
          const fe = fieldErrors(error)
          if (fe.email || fe.secret) {
            setErrors({
              ...(fe.email ? { email: translateError(fe.email, t) } : {}),
              ...(fe.secret ? { secret: translateError(fe.secret, t) } : {}),
            })
          } else {
            setErrors({ form: translateError(errorMessage(error, t('errors.generic')), t) })
          }
        },
      },
    )
  }

  const derivedName = emailToName(email)
  const next = nextQuery.data
  const loading = lockQuery.isLoading || (!lock && nextQuery.isLoading)

  return (
    <>
      <Card>
        <CardHeader title={t('provision.title')} subtitle={t('provision.subtitle')} icon={PhoneCall} />
        <CardBody>
          {timeUp && (
            <Banner tone="danger" title={t('provision.timeUpTitle')} onDismiss={() => setTimeUp(null)} className="mb-4">
              {t('provision.timeUpBody', { number: timeUp })}
            </Banner>
          )}

          {loading ? (
            <div className="flex flex-col gap-3" aria-busy="true">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-12 w-48" />
              <Skeleton className="h-9 w-28" />
            </div>
          ) : lockQuery.isError && isAccessError(lockQuery.error) ? (
            <ErrorState error={lockQuery.error} />
          ) : lock ? (
            <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-[10px] border border-line bg-sunken px-4 py-3">
                <div className="min-w-0">
                  <div className="eyebrow flex items-center gap-1.5 text-muted">
                    <Lock size={14} strokeWidth={1.75} aria-hidden />
                    {t('provision.reservedTitle')}
                  </div>
                  <div className="font-mono text-4xl font-semibold tabular text-ink" data-testid="reserved-number">
                    {lock.extension}
                  </div>
                </div>
                <div
                  className={cn('flex items-center gap-2 rounded-full px-3.5 py-2', TONE_FILL[tone], TONE_TEXT[tone])}
                  role="timer"
                  aria-label={t('provision.timeLeft')}
                >
                  <Timer size={18} strokeWidth={1.75} aria-hidden />
                  <span className="font-mono text-xl font-semibold tabular">{formatCountdown(remaining)}</span>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('provision.email')} htmlFor="ext-email" error={errors.email} required>
                  <Input
                    id="ext-email"
                    type="email"
                    inputMode="email"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={email}
                    invalid={!!errors.email}
                    placeholder={t('provision.emailPlaceholder')}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }))
                    }}
                  />
                </Field>
                <Field label={t('provision.displayName')} hint={t('provision.displayNameHint')}>
                  <div
                    className="flex h-9 items-center rounded-[8px] border border-line bg-sunken px-3 text-sm"
                    aria-live="polite"
                  >
                    {derivedName ? <Mono>{derivedName}</Mono> : <span className="text-faint">{t('provision.displayNameEmpty')}</span>}
                  </div>
                </Field>
                <Field
                  label={t('provision.secret')}
                  htmlFor="ext-secret"
                  hint={t('provision.secretHint')}
                  error={errors.secret}
                  required
                >
                  <div className="flex gap-2">
                    <Input
                      id="ext-secret"
                      mono
                      autoComplete="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      value={secret}
                      invalid={!!errors.secret}
                      placeholder={t('provision.secretPlaceholder')}
                      onChange={(e) => {
                        setSecret(e.target.value)
                        if (errors.secret) setErrors((prev) => ({ ...prev, secret: undefined }))
                      }}
                    />
                    <Button
                      variant="secondary"
                      icon={Sparkles}
                      className="shrink-0"
                      onClick={() => {
                        setSecret(generateSecret())
                        setErrors((prev) => ({ ...prev, secret: undefined }))
                      }}
                    >
                      {t('provision.generate')}
                    </Button>
                  </div>
                </Field>
              </div>

              {errors.form && <Banner tone="danger">{errors.form}</Banner>}

              <div className="flex flex-wrap gap-2">
                <Button type="submit" variant="primary" loading={create.isPending}>
                  {t('provision.create')}
                </Button>
                <Button variant="ghost" onClick={onCancel} disabled={create.isPending || release.isPending}>
                  {t('provision.cancel')}
                </Button>
              </div>
            </form>
          ) : nextQuery.isError ? (
            nextQuery.error && (nextQuery.error as { status?: number }).status === 409 ? (
              <Banner tone="warning">{t('provision.noneFree')}</Banner>
            ) : (
              <ErrorState error={nextQuery.error} onRetry={() => void nextQuery.refetch()} />
            )
          ) : (
            <div className="flex flex-wrap items-end justify-between gap-5">
              <div className="min-w-0">
                <div className="eyebrow text-muted">{t('provision.nextFree')}</div>
                <div className="font-mono text-5xl font-semibold tabular text-primary" data-testid="next-number">
                  {next?.next ?? '-'}
                </div>
                <p className="mt-2 text-sm text-muted">{t('provision.idleHint')}</p>
                {next && (
                  <p className="mt-0.5 text-xs text-faint">
                    {t('provision.range', { from: next.range.from, to: next.range.to })}
                    {next.reserved.length > 0 && <> &middot; {t('provision.skipped', { count: next.reserved.length })}</>}
                  </p>
                )}
              </div>
              <Button variant="primary" size="md" icon={PhoneCall} loading={start.isPending} onClick={onStart} disabled={!next}>
                {t('provision.start')}
              </Button>
            </div>
          )}
        </CardBody>
      </Card>

      <Dialog
        open={created !== null}
        onOpenChange={(open) => {
          if (!open) setCreated(null)
        }}
        title={t('success.title', { number: created?.number ?? '' })}
        description={t('success.description')}
        size="md"
        footer={
          <Button variant="primary" onClick={() => setCreated(null)}>
            {t('success.done')}
          </Button>
        }
      >
        {created && (
          <dl className="flex flex-col divide-y divide-line">
            {(
              [
                ['number', created.number],
                ['name', created.name],
                ['email', created.email],
                ['secret', created.secret],
              ] as const
            ).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between gap-3 py-2.5">
                <dt className="w-24 shrink-0 text-sm text-muted">{t(`success.${key}`)}</dt>
                <dd className="min-w-0 flex-1 break-all font-mono text-sm tabular text-ink">{value}</dd>
                <CopyButton value={value} />
              </div>
            ))}
          </dl>
        )}
      </Dialog>
    </>
  )
}
