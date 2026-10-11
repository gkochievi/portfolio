/**
 * /login: brand panel, email + password form prefilled with the
 * first demo account, and one-click role tiles (DemoAccounts) that fill and submit.
 */
import { DemoAccounts, useSession } from '@portfolio/demo-kit'
import { ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'

import { DialMotif, Logo, Mark } from '@/components/brand'
import { Alert, Button, Field, Input } from '@/components/ui'
import { accountNameKa } from '@/demo/accounts'
import { session } from '@/demo/store'
import { ApiError, post } from '@/lib/api'
import type { DarekeAccount, User } from '@/types'
import { LanguageToggle, ThemeToggle } from '../controls'

export default function LoginPage() {
  const { t } = useTranslation('shell')
  const { t: tc, i18n } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const me = useSession(session)
  const first = session.accounts[0]
  const [email, setEmail] = useState(first?.email ?? '')
  const [password, setPassword] = useState(first?.password ?? '')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const accounts = useMemo(
    () =>
      session.accounts.map((a) => ({
        ...a,
        name: i18n.language === 'ka' ? (accountNameKa[a.id] ?? a.name) : a.name,
        roleLabel: tc(`roles.${a.role}`),
        description: t(`login.accountHint.${a.role}`),
      })),
    [t, tc, i18n.language],
  )

  const next = params.get('next')
  const target = (account: DarekeAccount) => (next && next.startsWith('/') && !next.startsWith('/login') ? next : account.home)

  async function signIn(nextEmail: string, nextPassword: string) {
    setBusy(true)
    setError(null)
    try {
      let account: DarekeAccount
      try {
        const res = await post<{ user: User; account: DarekeAccount }>('/auth/login', { email: nextEmail, password: nextPassword })
        account = session.current() ?? res.account
      } catch (err) {
        // Wrong credentials are 400/401. Anything else means the auth handler is not
        // available (e.g. not registered yet): the session validates the same way locally.
        if (err instanceof ApiError && err.status !== 400 && err.status !== 401) account = session.signInWith(nextEmail, nextPassword)
        else throw err
      }
      navigate(target(account), { replace: true })
    } catch (err) {
      setError(err instanceof ApiError && err.status < 500 ? t('login.invalid') : t('login.failed'))
      setBusy(false)
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    void signIn(email, password)
  }

  if (me && !busy) return <Navigate to={me.home} replace />

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink lg:flex-row">
      {/* Brand panel */}
      <aside className="theme-dark relative flex shrink-0 flex-col justify-between overflow-hidden bg-carbon px-6 py-6 text-[#E8EFE9] sm:px-10 lg:w-[44%] lg:max-w-[640px] lg:py-10">
        <div className="dial-grid pointer-events-none absolute inset-0 text-[#E8EFE9] opacity-40" aria-hidden />
        <div className="relative flex items-center justify-between gap-4">
          <Logo size={34} wordmarkClassName="text-[#E8EFE9]" />
          <span className="text-xs text-[#9AABA6]">{tc('tenant')}</span>
        </div>
        <div className="relative hidden py-10 lg:block">
          <DialMotif size={300} litLeads={3} className="text-[#E8EFE9]" />
          <p className="mt-10 max-w-md font-display text-[40px] font-extrabold leading-[1.05] tracking-[-0.03em] text-[#E8EFE9]">
            {tc('tagline')}
          </p>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[#9AABA6]">{t('login.pitch')}</p>
        </div>
        <p className="relative mt-3 text-sm text-[#9AABA6] lg:hidden">{tc('tagline')}</p>
        <div className="relative hidden items-center gap-3 text-xs text-[#9AABA6] lg:flex">
          <Mark size={18} />
          <span>© 2026 Dareke</span>
        </div>
      </aside>

      {/* Form */}
      <main className="flex flex-1 flex-col px-4 py-6 sm:px-10">
        <div className="flex items-center justify-end gap-2">
          <LanguageToggle />
          <ThemeToggle />
        </div>
        <div className="mx-auto flex w-full max-w-[460px] flex-1 flex-col justify-center py-8">
          <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.02em]">{t('login.title')}</h1>
          <p className="mt-1.5 text-sm text-muted">{t('login.subtitle')}</p>

          <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4" noValidate>
            {error && <Alert tone="danger" title={error} />}
            <Field label={t('login.email')} htmlFor="login-email">
              <Input
                id="login-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                icon={<Mail strokeWidth={1.75} />}
                invalid={Boolean(error)}
                required
              />
            </Field>
            <Field label={t('login.password')} htmlFor="login-password" hint={t('login.passwordHint')}>
              <Input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                icon={<Lock strokeWidth={1.75} />}
                invalid={Boolean(error)}
                mono
                required
                suffix={
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="grid size-7 place-items-center rounded-[4px] text-muted hover:bg-sunken hover:text-ink"
                    aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                  >
                    {showPassword ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
                  </button>
                }
              />
            </Field>
            <Button type="submit" variant="dial" size="lg" block loading={busy} iconRight={!busy && <ArrowRight size={18} strokeWidth={1.75} />}>
              {tc('actions.signIn')}
            </Button>
          </form>

          <div className="my-7 flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-hairline" />
            {t('login.orPick')}
            <span className="h-px flex-1 bg-hairline" />
          </div>

          <DemoAccounts
            accounts={accounts}
            label={t('login.accountsLabel')}
            disabled={busy}
            currentId={me?.id ?? null}
            onPick={(account) => {
              setEmail(account.email)
              setPassword(account.password)
              void signIn(account.email, account.password)
            }}
            className="grid gap-2 sm:grid-cols-2"
            classNames={{
              item: 'min-w-0',
              card: 'group flex h-full w-full items-start gap-3 rounded-card border border-hairline bg-panel p-3 text-left transition-colors hover:border-ink/50 disabled:opacity-50 data-[current=true]:border-ink dark:hover:border-lime/60',
              avatar: 'grid size-9 shrink-0 place-items-center rounded-full bg-carbon font-display text-sm font-bold text-lime',
              body: 'flex min-w-0 flex-col gap-0.5',
              name: 'truncate text-sm font-semibold text-ink',
              role: 'text-xs font-medium text-ink/80',
              email: 'truncate font-mono text-[11px] text-muted',
              description: 'mt-1 text-xs leading-snug text-muted',
            }}
          />
        </div>
        <p className="text-center text-xs text-muted lg:hidden">© 2026 Dareke · {tc('tenant')}</p>
      </main>
    </div>
  )
}
