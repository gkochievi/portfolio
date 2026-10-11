import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { DemoAccounts } from '@portfolio/demo-kit'
import { ArrowRight, Eye, EyeOff, MessageCircle, MonitorSmartphone } from 'lucide-react'

import type { ChitiAccount } from '@/types'
import { ApiError, request } from '@/lib/api'
import { signInAs, useAccount } from '@/lib/account'
import { headlineAccounts } from '@/demo/session'
import { ChitiMark, FlightPaths, Wordmark } from '@/components/brand'
import { Button, Field, Input, LanguageSwitch, ThemeToggle, toast } from '@/components/ui'
import { accountName, surfaceOf } from '../session'

const schema = z.object({ login: z.string().trim().min(1), password: z.string().min(1) })
type FormValues = z.infer<typeof schema>

const ROLE_ORDER = ['operator', 'admin', 'supervisor', 'superadmin', 'customer']

/** Staff sign-in: brand panel, one-click role cards, and a pre-filled form. */
export default function LoginPage() {
  const { t, i18n } = useTranslation('shell')
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const qc = useQueryClient()
  const current = useAccount()
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { login: 'luka@chiti.example', password: 'chiti-demo' },
  })

  const land = (account: ChitiAccount) => {
    const next = params.get('next')
    const target = next && next.startsWith('/') && !next.startsWith('/login') && account.role !== 'customer' && next.startsWith(surfaceOf(account.role)) ? next : account.homeRoute
    qc.clear()
    toast.success(t('toast.welcome', { name: accountName(account, i18n.language) }), { id: 'welcome' })
    navigate(target, { replace: true })
  }

  const login = useMutation({
    mutationFn: async (values: FormValues) => {
      const account = await request<ChitiAccount>('POST', '/auth/login', { body: { login: values.login.trim(), password: values.password } })
      return signInAs(account.id)
    },
    onMutate: () => setFormError(null),
    onSuccess: land,
    onError: (err) => {
      const status = err instanceof ApiError ? err.status : 0
      setFormError(status === 400 || status === 401 || status === 403 || status === 404 ? t('login.invalid') : t('login.error'))
    },
  })

  const quick = useMutation({
    mutationFn: async (account: ChitiAccount) => {
      if (account.role === 'customer') return signInAs(account.id)
      try {
        const signed = await request<ChitiAccount>('POST', '/auth/login', { body: { login: account.email, password: account.password } })
        return signInAs(signed.id)
      } catch {
        return signInAs(account.id)
      }
    },
    onSuccess: land,
  })

  const accounts = useMemo(
    () =>
      [...headlineAccounts]
        .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role))
        .map((a) => ({
          ...a,
          name: accountName(a, i18n.language),
          roleLabel: t(`common:role.${a.role}`),
          description: a.role === 'customer' ? t('login.customerNote') : a.description,
        })),
    [i18n.language, t],
  )

  return (
    <div className="grid min-h-dvh bg-bg lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* Brand panel: always ink, the bird lands in the nest. */}
      <section className="relative hidden overflow-hidden bg-[#1E1B12] px-10 pb-24 pt-10 text-[#F3EDDC] lg:flex lg:flex-col">
        <div className="flex items-center gap-3">
          <ChitiMark size={36} stroke="none" />
          <span className="font-display text-2xl font-bold tracking-[-0.02em] [&_*]:!text-[#F3EDDC]">
            <Wordmark lang="both" size={24} />
          </span>
        </div>
        <FlightPaths className="mx-auto my-8 w-full max-w-md flex-1" />
        <div className="max-w-md">
          <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight text-[#F2C12E]">{t('login.heroTitle')}</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-[#A9A28C]">{t('login.heroBody')}</p>
          <div className="mt-6 flex flex-col gap-2 text-[13px]">
            <Link to="/" className="inline-flex items-center gap-2 text-[#C3D06E] hover:underline">
              <MessageCircle size={16} strokeWidth={1.75} />
              {t('login.heroWidget')}
            </Link>
            <Link to="/live" className="inline-flex items-center gap-2 text-[#C3D06E] hover:underline">
              <MonitorSmartphone size={16} strokeWidth={1.75} />
              {t('login.heroLive')}
            </Link>
          </div>
        </div>
      </section>

      {/* Form side */}
      <section className="flex min-w-0 flex-col px-4 pb-24 pt-4 sm:px-8">
        <div className="flex items-center justify-between">
          <span className="lg:hidden">
            <span className="inline-flex items-center gap-2">
              <ChitiMark size={30} />
              <Wordmark size={21} />
            </span>
          </span>
          <span className="hidden lg:block" />
          <div className="flex items-center gap-2">
            <LanguageSwitch />
            <ThemeToggle />
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center py-10">
          <h1 className="font-display text-[28px] font-semibold tracking-tight text-ink">{t('login.title')}</h1>
          <p className="mt-1 text-sm text-muted">{t('login.subtitle')}</p>

          <div className="mt-8">
            <h2 className="text-sm font-semibold text-ink">{t('login.accounts')}</h2>
            <p className="mb-3 mt-0.5 text-[13px] text-muted">{t('login.accountsHint')}</p>
            <DemoAccounts
              accounts={accounts}
              currentId={current?.id ?? null}
              disabled={quick.isPending || login.isPending}
              label={t('login.accounts')}
              onPick={(a) => quick.mutate(headlineAccounts.find((h) => h.id === a.id) ?? a)}
              className="grid gap-2 sm:grid-cols-2"
              classNames={{
                item: 'list-none',
                card: 'group flex w-full items-center gap-3 rounded-ui border border-line bg-panel p-3 text-left transition-[border-color,transform] hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:translate-y-px disabled:opacity-60 data-[current]:border-accent data-[current]:bg-accent-soft',
                avatar: 'grid size-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-on-primary',
                body: 'flex min-w-0 flex-1 flex-col',
                name: 'truncate text-sm font-semibold text-ink',
                role: 'text-xs font-medium text-accent',
                email: 'truncate font-mono text-[11px] text-muted',
                description: 'mt-0.5 line-clamp-2 text-xs text-muted',
              }}
            />
          </div>

          <div className="my-7 flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-line" />
            {t('login.or')}
            <span className="h-px flex-1 bg-line" />
          </div>

          <form noValidate onSubmit={handleSubmit((v) => login.mutate(v))} className="flex flex-col gap-4 rounded-ui border border-line bg-panel p-5">
            <Field label={t('login.login')} htmlFor="login" error={errors.login ? t('login.required') : undefined}>
              <Input id="login" autoComplete="username" invalid={!!errors.login} {...register('login')} />
            </Field>
            <Field label={t('login.password')} htmlFor="password" error={errors.password ? t('login.required') : undefined}>
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                invalid={!!errors.password}
                {...register('password')}
                rightSlot={
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? t('login.hide') : t('login.show')}
                    className="grid size-7 place-items-center rounded-md hover:bg-hover hover:text-ink"
                  >
                    {showPassword ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
                  </button>
                }
              />
            </Field>
            {formError ? (
              <p role="alert" className="rounded-ui border border-danger/40 bg-danger-soft px-3 py-2 text-[13px] text-danger">
                {formError}
              </p>
            ) : null}
            <Button type="submit" variant="primary" size="lg" block loading={login.isPending} rightIcon={<ArrowRight />}>
              {t('login.submit')}
            </Button>
          </form>
        </div>
      </section>
    </div>
  )
}
