import { DemoAccounts } from '@portfolio/demo-kit'
import { ArrowRight, CheckCircle2, LogIn } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'

import { BellCurve, Hallmark, LogoMark, Wordmark } from '@/components/brand'
import { homeFor, signInAs } from '@/components/shell/actions'
import { Button, Callout, Field, Input } from '@/components/ui'
import { accounts, DEMO_PASSWORD, session } from '@/demo'
import { ApiError, post } from '@/lib/api'
import { queryClient } from '@/lib/queryClient'
import { useAccount } from '@/lib/session'
import { router } from '@/router'
import type { Me } from '@/types'

const prefill = accounts.find((a) => a.id === 'acc_tamar') ?? accounts[0]

/** Sign in: brand panel + one-click demo accounts + email/password form (pre-filled). */
export default function LoginPage() {
  const { t, i18n } = useTranslation('shell')
  const [params] = useSearchParams()
  const next = params.get('next')
  const current = useAccount()
  const ka = i18n.language === 'ka'
  const [email, setEmail] = useState(prefill?.email ?? '')
  const [password, setPassword] = useState(prefill?.password ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const cards = useMemo(
    () => accounts.map((a) => (ka ? { ...a, name: a.name_ka, roleLabel: a.roleLabel_ka, description: a.description_ka } : a)),
    [ka],
  )

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const me = await post<Me>('/auth/login', { email, password })
      queryClient.clear()
      const id = me.account?.id ?? session.current()?.id ?? null
      const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : null
      void router.navigate(safeNext ?? homeFor(id))
    } catch (err) {
      setError(err instanceof ApiError && err.status === 400 ? t('login.invalid') : t('common:errors.generic'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto grid max-w-[1120px] gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10">
      {/* brand panel */}
      <aside className="relative hidden overflow-hidden rounded-card border border-line bg-sunken p-8 lg:flex lg:flex-col">
        <div className="flex items-center gap-2.5">
          <LogoMark size={40} />
          <Wordmark className="text-[30px]" />
        </div>
        <h2 className="mt-10 font-display text-[28px] font-semibold leading-tight">{t('login.brandTitle')}</h2>
        <p className="mt-3 font-display text-lg italic text-muted">{t('common:brand.tagline')}</p>
        <ul className="mt-8 flex flex-col gap-3 text-[14px]">
          {(['point1', 'point2', 'point3'] as const).map((k) => (
            <li key={k} className="flex items-start gap-2.5">
              <CheckCircle2 className="mt-0.5 size-[18px] shrink-0 text-primary" strokeWidth={1.75} aria-hidden />
              <span>{t(`login.${k}`)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-auto flex items-end justify-between gap-6 pt-12">
          <BellCurve className="w-56" bead={0.82} />
          <Hallmark value={92} suffix="/100" size="md" className="mb-4 shrink-0" />
        </div>
      </aside>

      {/* sign-in column */}
      <section className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-[32px] font-semibold">{t('login.title')}</h1>
          <p className="mt-1 text-[15px] text-muted">{t('login.subtitle')}</p>
        </div>

        <div>
          <h2 className="mb-2.5 font-sans text-[13px] font-semibold tracking-normal text-muted">{t('login.accounts')}</h2>
          <DemoAccounts
            accounts={cards}
            currentId={current?.id ?? null}
            label={t('login.accounts')}
            disabled={busy}
            onPick={(a) => signInAs(a.id, next)}
            className="grid gap-2.5 sm:grid-cols-2"
            classNames={{
              item: 'list-none',
              card:
                'group flex h-full w-full items-start gap-3 rounded-card border border-line bg-panel p-4 text-left transition-colors hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary data-[current=true]:border-primary data-[current=true]:bg-primary/8 disabled:opacity-60',
              avatar: 'grid size-10 shrink-0 place-items-center rounded-full bg-[var(--bdk-avatar,var(--color-primary))] text-sm font-semibold text-white',
              body: 'flex min-w-0 flex-col',
              name: 'truncate text-[14px] font-semibold text-ink',
              role: 'mt-0.5 text-[12.5px] font-medium text-accent',
              email: 'mt-0.5 truncate font-mono text-[11.5px] text-subtle',
              description: 'mt-1.5 text-[12.5px] leading-snug text-muted',
            }}
          />
        </div>

        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-line" />
          {t('login.or')}
          <span className="h-px flex-1 bg-line" />
        </div>

        <form onSubmit={(e) => void onSubmit(e)} className="rounded-card border border-line bg-panel p-5 sm:p-6" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('login.email')}>
              <Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Field>
            <Field label={t('login.password')} hint={t('login.passwordHint', { password: DEMO_PASSWORD })}>
              <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </Field>
          </div>
          {error ? (
            <Callout tone="danger" className="mt-4">
              {error}
            </Callout>
          ) : null}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <Link to="/" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline">
              {t('login.guest')}
              <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden />
            </Link>
            <Button type="submit" variant="primary" loading={busy} icon={<LogIn aria-hidden />} className="min-w-32">
              {t('login.submit')}
            </Button>
          </div>
        </form>
      </section>
    </div>
  )
}
