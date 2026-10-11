/**
 * Sign in (/login): brand panel + one-click demo account cards + the
 * email/password form (POST /api/auth/login). Honours ?next= for console
 * paths the chosen account may open. Owner: shell agent.
 */
import { zodResolver } from '@hookform/resolvers/zod'
import { DemoAccounts, useSession } from '@portfolio/demo-kit'
import { ArrowLeft, BarChart3, MessageSquareText, Star } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { z } from 'zod'

import { AzriLogo } from '@/components/brand/Logo'
import { Button, Field, Input, LangSwitch, ThemeToggle } from '@/components/ui'
import { session } from '@/demo/core'
import { useLang } from '@/hooks/useLang'
import { ApiError, request } from '@/lib/api'
import type { AzriAccount } from '@/types'

const DEMO_PASSWORD = 'azri-demo'

/** May this account open `next`? (Mirrors the route guards.) */
function canOpen(account: Pick<AzriAccount, 'role'>, next: string): boolean {
  if (!next.startsWith('/console')) return true
  if (account.role === 'respondent') return false
  const path = next.split('?')[0] ?? next
  if (path === '/console/send') return true
  if (account.role === 'agent') return path === '/console/me'
  return path !== '/console/me'
}

function safeNext(raw: string | null): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/login')) return null
  return raw
}

export default function LoginPage() {
  const { t } = useTranslation('shell')
  const lang = useLang()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const me = useSession(session)
  const next = safeNext(params.get('next'))
  const [formError, setFormError] = useState<string | null>(null)

  const go = (account: Pick<AzriAccount, 'role' | 'home'>) => {
    navigate(next && canOpen(account, next) ? next : account.home, { replace: true })
  }

  // Prefill with the first account, or the first console account when `next` points into the console.
  const prefill = useMemo(() => {
    const wanted = next?.startsWith('/console') ? session.accounts.find((a) => canOpen(a, next)) : undefined
    return wanted ?? session.accounts[0]
  }, [next])

  const schema = useMemo(
    () =>
      z.object({
        email: z.string().trim().min(1, t('common:errors.required')).email(t('common:errors.email')),
        password: z.string().min(1, t('common:errors.required')),
      }),
    [t],
  )
  type Values = z.infer<typeof schema>

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: prefill?.email ?? '', password: DEMO_PASSWORD },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      const account = await request<Omit<AzriAccount, 'password'>>('POST', '/auth/login', { body: values })
      go(account)
    } catch (error) {
      setFormError(error instanceof ApiError && error.status === 400 ? t('login.invalid') : t('common:errors.generic'))
    }
  })

  const cards = useMemo(
    () =>
      session.accounts.map((account) => ({
        ...account,
        name: lang === 'ka' ? account.nameKa : account.name,
        roleLabel: t(`roles.${account.role}`),
        description: t(`login.accountDesc.${account.role}`),
      })),
    [lang, t],
  )

  const steps = [
    { icon: MessageSquareText, text: t('login.steps.text') },
    { icon: Star, text: t('login.steps.rate') },
    { icon: BarChart3, text: t('login.steps.console') },
  ]

  return (
    <div className="grid min-h-dvh bg-surface text-ink lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* Brand panel */}
      <section className="relative overflow-hidden bg-mulberry px-6 py-8 text-mist sm:px-10 lg:flex lg:flex-col lg:px-14 lg:py-12">
        <AzriLogo size={30} variant="inverse" />
        <div className="mt-8 max-w-lg lg:mt-auto">
          <h1 className="font-display text-[28px] font-semibold leading-tight sm:text-[36px]">{t('login.brandTitle')}</h1>
          <p className="mt-3 hidden text-[15px] leading-relaxed text-mist/80 sm:block">{t('login.brandBody')}</p>
          <ol className="mt-8 hidden flex-col gap-3 sm:flex">
            {steps.map((step, index) => {
              const Icon = step.icon
              return (
                <li key={index} className="flex items-center gap-3 text-[15px]">
                  <span className="grid size-9 shrink-0 place-items-center rounded-bubble-sm bg-mint text-plum">
                    <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  {step.text}
                </li>
              )
            })}
          </ol>
        </div>
        <p className="mt-10 hidden font-display text-lg text-mint lg:mt-auto lg:block">{t('common:tagline')}</p>
        {/* signal-bar motif */}
        <svg aria-hidden="true" viewBox="0 0 120 100" className="pointer-events-none absolute -bottom-6 -right-6 w-56 opacity-15 sm:w-72">
          {[30, 45, 60, 75, 90].map((h, i) => (
            <rect key={h} x={8 + i * 22} y={100 - h} width="14" height={h} rx="7" className="fill-mint" />
          ))}
        </svg>
      </section>

      {/* Sign-in column */}
      <section className="flex flex-col px-5 py-6 sm:px-10 lg:px-14 lg:py-10">
        <div className="flex items-center justify-between gap-3">
          <Link to="/" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink">
            <ArrowLeft className="size-4" strokeWidth={1.75} />
            {t('login.back')}
          </Link>
          <div className="flex items-center gap-1.5">
            <ThemeToggle size="sm" />
            <LangSwitch />
          </div>
        </div>

        <div className="mx-auto my-auto w-full max-w-md py-10">
          <h2 className="font-display text-[28px] font-semibold leading-tight">{t('login.title')}</h2>
          <p className="mt-2 text-sm text-muted">{t('login.subtitle')}</p>

          <p className="mb-2.5 mt-7 text-xs font-semibold text-muted">{t('login.oneClick')}</p>
          <DemoAccounts
            accounts={cards}
            currentId={me?.id ?? null}
            label={t('login.accounts')}
            onPick={(account) => {
              const signedIn = session.signIn(account.id)
              go(signedIn)
            }}
            className="flex flex-col gap-2.5"
            classNames={{
              item: 'list-none',
              card: 'group flex w-full items-center gap-3.5 rounded-bubble border border-border bg-panel p-4 text-left transition-[border-color,transform] duration-200 ease-azri hover:border-primary active:scale-[.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60 data-[current=true]:border-primary',
              avatar:
                'grid size-11 shrink-0 place-items-center rounded-full bg-[var(--bdk-avatar,var(--primary))] text-base font-semibold text-white group-data-[role=respondent]:text-plum',
              body: 'flex min-w-0 flex-1 flex-col',
              name: 'truncate text-[15px] font-semibold text-ink',
              role: 'mt-0.5 w-fit rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-on-primary-soft',
              email: 'mt-1 truncate font-mono text-xs text-muted',
              description: 'mt-0.5 text-[13px] text-muted',
            }}
          />

          <div className="my-7 flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-border" />
            {t('login.or')}
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
            <Field label={t('login.email')} error={errors.email?.message}>
              <Input type="email" autoComplete="username" {...register('email')} />
            </Field>
            <Field label={t('login.password')} error={errors.password?.message} hint={t('login.passwordHint', { password: DEMO_PASSWORD })}>
              <Input type="password" autoComplete="current-password" {...register('password')} />
            </Field>
            {formError && (
              <p role="alert" className="rounded-xl bg-danger/10 px-3.5 py-2.5 text-[13px] font-medium text-danger">
                {formError}
              </p>
            )}
            <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
              {t('login.submit')}
            </Button>
          </form>
        </div>
      </section>
    </div>
  )
}
