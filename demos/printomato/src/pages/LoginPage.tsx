import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, Lock, ShieldCheck, User } from 'lucide-react'

import { ApiError } from '@/lib/api'
import { api } from '@/lib/api'
import { useLogin, useSession } from '@/lib/queries'
import { store } from '@/demo/store'
import { Button, Spinner } from '@/components/ui/primitives'
import { Field, Input } from '@/components/ui/form'
import { StarMark, Wordmark } from '@/components/layout/Logo'

export function LoginPage() {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { data: session, isPending } = useSession()
  const login = useLogin()

  // The demo account, pre-filled: signing out is a dead end otherwise, since
  // nobody could guess credentials that live only in the seed.
  const [username, setUsername] = useState(store.user.username)
  const [password, setPassword] = useState(store.user.password)
  const [reveal, setReveal] = useState(false)

  // Prime the CSRF cookie so the first POST is never rejected.
  useEffect(() => {
    void api.get('/auth/csrf/').catch(() => undefined)
  }, [])

  if (isPending) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (session) {
    return <Navigate to={params.get('next') || '/'} replace />
  }

  const error = login.error instanceof ApiError ? login.error : null

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    login.mutate(
      { username: username.trim(), password },
      {
        onSuccess: () => {
          navigate(params.get('next') || '/', { replace: true })
        },
      },
    )
  }

  return (
    <div className="relative grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Brand side */}
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-hairline p-12 lg:flex">
        <div
          aria-hidden
          className="absolute inset-0 opacity-70"
          style={{
            background:
              'radial-gradient(ellipse 70% 60% at 25% 15%, rgba(248,190,98,0.17), transparent 60%), radial-gradient(ellipse 60% 60% at 85% 85%, rgba(243,127,139,0.09), transparent 60%)',
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
            maskImage: 'radial-gradient(ellipse 90% 70% at 40% 40%, #000 30%, transparent 75%)',
          }}
        />

        <div className="relative">
          <Wordmark className="h-8" />
        </div>

        <div className="relative max-w-md">
          <StarMark className="size-8 text-gold" />
          <h1 className="text-balance mt-6 text-[2.6rem] leading-[1.08] font-semibold text-ink">
            Fleet control for{' '}
            <span className="text-gold">photo kiosks</span>
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-muted">
            Every device, campaign and print in one console — live status, paper levels and payment
            sessions as they happen.
          </p>

          <dl className="mt-10 grid grid-cols-3 gap-6 border-t border-hairline pt-6">
            {[
              ['Live', 'device presence'],
              ['Instant', 'photo archive'],
              ['Tracked', 'payment sessions'],
            ].map(([value, label]) => (
              <div key={label}>
                <dt className="text-sm font-semibold text-gold">{value}</dt>
                <dd className="mt-0.5 text-xs text-ink-faint">{label}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="relative text-xs text-ink-faint">
          © {new Date().getFullYear()} Printomato
        </p>
      </aside>

      {/* Form side */}
      <main className="relative flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Wordmark className="h-7" />
          </div>

          <h2 className="text-2xl font-semibold text-ink">{t('auth.signInTitle')}</h2>
          <p className="mt-1.5 text-sm text-ink-faint">{t('auth.signInSubtitle')}</p>

          <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4" noValidate>
            {error && !error.fieldErrors.username && !error.fieldErrors.password && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-control border border-danger/30 bg-danger/8 px-3.5 py-3"
              >
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-danger" />
                <p className="text-sm text-danger">{error.message}</p>
              </div>
            )}

            <Field label={t('auth.username')} htmlFor="username" error={error?.fieldError('username')}>
              <Input
                id="username"
                name="username"
                autoComplete="username"
                autoFocus
                required
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                adornment={<User className="size-4" />}
                className="pr-9"
                invalid={Boolean(error?.fieldError('username'))}
              />
            </Field>

            <Field label={t('auth.password')} htmlFor="password" error={error?.fieldError('password')}>
              <div className="relative flex items-center">
                <Input
                  id="password"
                  name="password"
                  type={reveal ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="pr-10 pl-9"
                  invalid={Boolean(error?.fieldError('password'))}
                />
                <Lock className="pointer-events-none absolute left-3 size-4 text-ink-faint" />
                <button
                  type="button"
                  onClick={() => setReveal((previous) => !previous)}
                  aria-label={reveal ? t('common.hide') : t('common.show')}
                  className="absolute right-3 text-ink-faint transition-colors hover:text-ink"
                >
                  {reveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Field>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={login.isPending}
              className="mt-2 w-full"
            >
              {login.isPending ? t('auth.signingIn') : t('auth.signIn')}
            </Button>
          </form>

          <p className="mt-6 rounded-control border border-hairline bg-white/3 px-3 py-2.5 text-center text-xs text-ink-faint">
            {t('demo.loginHint')}{' '}
            <span className="numeral text-ink-muted">
              {store.user.username} / {store.user.password}
            </span>
          </p>
        </div>
      </main>
    </div>
  )
}
