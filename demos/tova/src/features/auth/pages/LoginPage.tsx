/**
 * Sign in: brand panel + one-click demo roles, "Enter demo", and the
 * Password / Code tabs (port of the source's login client). `?next=` is
 * honoured; otherwise players land on /play and staff on /admin.
 */
import { DemoAccounts } from '@portfolio/demo-kit'
import { useMutation } from '@tanstack/react-query'
import { Check, KeyRound, Mail } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { Flakes, Lockup } from '@/components/brand'
import { Button, Card, Field, Input, Tabs, TabsContent, TabsList, TabsTrigger, toast } from '@/components/ui'
import { DEMO_OTP, DEMO_PASSWORD } from '@/demo/seed/accounts'
import { ApiError, http } from '@/lib/api'
import { useDemoAccounts } from '@/shell/session'
import type { SessionUser, TovaAccount } from '@/types'
import { AuthTopBar, safeNext } from '../components/AuthTopBar'

type FieldErrors = Record<string, string[]>

function errorsOf(error: unknown): { message: string | null; fields: FieldErrors } {
  if (error instanceof ApiError) {
    const fields = error.fieldErrors
    return { message: Object.keys(fields).length ? null : error.message, fields }
  }
  return error ? { message: 'common:errors.generic', fields: {} } : { message: null, fields: {} }
}

function FormError({ message }: { message: string | null }) {
  const { t } = useTranslation()
  if (!message) return null
  return (
    <p role="alert" className="rounded-chip bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
      {t(message)}
    </p>
  )
}

function BrandPanel() {
  const { t } = useTranslation()
  return (
    <aside className="relative hidden overflow-hidden bg-primary text-on-primary lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:justify-between lg:p-12">
      <Flakes count={16} tone="light" className="opacity-60" />
      <Lockup size={44} tone="inverse" className="relative" />
      <div className="relative max-w-[480px]">
        <h2 className="font-display text-[40px] leading-[1.08] xl:text-[48px]">{t('auth:brand.headline')}</h2>
        <p className="mt-5 text-lg opacity-90">{t('auth:brand.body')}</p>
        <ul className="mt-8 space-y-3">
          {(['point1', 'point2', 'point3'] as const).map((key) => (
            <li key={key} className="flex items-start gap-3 text-[15px] font-medium">
              <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-chip bg-on-primary text-primary">
                <Check className="size-4" strokeWidth={3} aria-hidden />
              </span>
              {t(`auth:brand.${key}`)}
            </li>
          ))}
        </ul>
      </div>
      <p className="relative text-sm opacity-75">{t('common:organiser')}</p>
    </aside>
  )
}

export default function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const accounts = useDemoAccounts()
  const first = accounts[0]

  const [identifier, setIdentifier] = useState(first?.email ?? '')
  const [password, setPassword] = useState(DEMO_PASSWORD)
  const [codeEmail, setCodeEmail] = useState(first?.email ?? '')
  const [code, setCode] = useState('')
  const [codeStep, setCodeStep] = useState<'email' | 'code'>('email')
  const [tab, setTab] = useState('password')

  const done = (user: SessionUser) => {
    toast.success(t('auth:welcome', { name: user.firstName || user.email }))
    navigate(next ?? (user.isStaff ? '/admin' : '/play'), { replace: true })
  }

  const demo = useMutation({
    mutationFn: (accountId: string) => http.post<SessionUser>('/auth/demo', { accountId }),
    onSuccess: done,
  })
  const login = useMutation({
    mutationFn: () => http.post<SessionUser>('/auth/login', { identifier, password }),
    onSuccess: done,
  })
  const requestCode = useMutation({
    mutationFn: () => http.post<{ sent: boolean }>('/auth/otp/request', { email: codeEmail }),
    onSuccess: () => setCodeStep('code'),
  })
  const verify = useMutation({
    mutationFn: () => http.post<SessionUser>('/auth/otp/verify', { email: codeEmail, code }),
    onSuccess: done,
  })

  const busy = demo.isPending || login.isPending || requestCode.isPending || verify.isPending
  const player = accounts.find((account) => account.role === 'PLAYER')
  const loginErr = errorsOf(login.error)
  const requestErr = errorsOf(requestCode.error)
  const verifyErr = errorsOf(verify.error)
  const demoErr = errorsOf(demo.error)

  const submit = (event: FormEvent, run: () => void) => {
    event.preventDefault()
    run()
  }

  return (
    <div className="grid min-h-dvh bg-surface lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <BrandPanel />
      <div className="flex min-w-0 flex-col px-4 pb-28 sm:px-8">
        <AuthTopBar className="mx-auto w-full max-w-[520px]" />
        <main className="mx-auto w-full max-w-[440px] flex-1 animate-drop-in py-6 sm:py-10">
          <h1 className="font-display text-[32px] leading-tight text-ink sm:text-[40px]">{t('auth:login.title')}</h1>
          <p className="mt-2 text-muted">{t('auth:login.subtitle')}</p>

          {player && (
            <div className="mt-7">
              <Button size="lg" block loading={demo.isPending && demo.variables === player.id} disabled={busy} onClick={() => demo.mutate(player.id)}>
                {t('auth:login.enterDemo')}
              </Button>
              <p className="mt-2 text-center text-sm text-muted">{t('auth:login.enterDemoHint')}</p>
            </div>
          )}

          <section className="mt-7" aria-labelledby="demo-roles">
            <h2 id="demo-roles" className="mb-3 text-sm font-semibold text-ink">
              {t('auth:login.rolesTitle')}
            </h2>
            <DemoAccounts<TovaAccount>
              accounts={accounts}
              onPick={(account) => demo.mutate(account.id)}
              disabled={busy}
              label={t('auth:login.rolesTitle')}
              className="grid grid-cols-1 gap-2 sm:grid-cols-2"
              classNames={{
                item: 'list-none',
                card: 'flex h-full w-full items-center gap-3 rounded-card border-[1.5px] border-line bg-panel p-3 text-left shadow-card transition-[border-color,transform] hover:-translate-y-px hover:border-primary disabled:opacity-60',
                avatar: 'grid size-10 shrink-0 place-items-center rounded-full bg-[var(--bdk-avatar,var(--color-primary))] text-sm font-bold text-white',
                body: 'min-w-0 flex-1',
                name: 'block truncate text-[15px] font-semibold text-ink',
                role: 'block truncate text-xs font-semibold text-primary',
                email: 'block truncate font-mono text-[11px] text-muted',
                description: 'hidden',
              }}
            />
            <div className="mt-2">
              <FormError message={demoErr.message} />
            </div>
          </section>

          <div className="my-7 flex items-center gap-3 text-sm text-muted" aria-hidden>
            <span className="h-[1.5px] flex-1 bg-line" />
            {t('auth:login.or')}
            <span className="h-[1.5px] flex-1 bg-line" />
          </div>

          <Card padding="md">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="password">
                  <KeyRound aria-hidden />
                  {t('auth:login.tabPassword')}
                </TabsTrigger>
                <TabsTrigger value="code">
                  <Mail aria-hidden />
                  {t('auth:login.tabCode')}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="password">
                <form className="flex flex-col gap-4" onSubmit={(event) => submit(event, () => login.mutate())} noValidate>
                  <FormError message={loginErr.message} />
                  <Field label={t('auth:login.identifier')} htmlFor="login-identifier" error={loginErr.fields.identifier}>
                    <Input
                      id="login-identifier"
                      autoComplete="username"
                      value={identifier}
                      onChange={(event) => setIdentifier(event.target.value)}
                      invalid={Boolean(loginErr.fields.identifier)}
                    />
                  </Field>
                  <Field label={t('auth:login.password')} htmlFor="login-password" error={loginErr.fields.password}>
                    <Input
                      id="login-password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      invalid={Boolean(loginErr.fields.password)}
                    />
                  </Field>
                  <Button type="submit" block loading={login.isPending} disabled={busy}>
                    {t('auth:login.submit')}
                  </Button>
                  <p className="text-sm text-muted">
                    {t('auth:login.demoPassword')} <code className="rounded-[4px] bg-sunken px-1.5 py-0.5 font-mono text-ink">{DEMO_PASSWORD}</code>
                    . {t('auth:login.guestHint')}
                  </p>
                </form>
              </TabsContent>

              <TabsContent value="code">
                {codeStep === 'email' ? (
                  <form className="flex flex-col gap-4" onSubmit={(event) => submit(event, () => requestCode.mutate())} noValidate>
                    <FormError message={requestErr.message} />
                    <Field label={t('auth:login.codeEmail')} htmlFor="code-email" error={requestErr.fields.email}>
                      <Input
                        id="code-email"
                        type="email"
                        autoComplete="email"
                        value={codeEmail}
                        onChange={(event) => setCodeEmail(event.target.value)}
                        invalid={Boolean(requestErr.fields.email)}
                      />
                    </Field>
                    <Button type="submit" block loading={requestCode.isPending} disabled={busy}>
                      {t('auth:login.sendCode')}
                    </Button>
                  </form>
                ) : (
                  <form className="flex flex-col gap-4" onSubmit={(event) => submit(event, () => verify.mutate())} noValidate>
                    <p className="text-sm text-muted">{t('auth:login.codeSent', { email: codeEmail })}</p>
                    <FormError message={verifyErr.message} />
                    <Field label={t('auth:login.code')} htmlFor="code-value" error={verifyErr.fields.code}>
                      <Input
                        id="code-value"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        inputSize="lg"
                        className="text-center font-mono text-2xl font-bold tracking-[0.4em]"
                        value={code}
                        onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                        invalid={Boolean(verifyErr.fields.code)}
                        autoFocus
                      />
                    </Field>
                    <p className="text-sm text-muted">
                      {t('auth:login.demoCode')}{' '}
                      <code className="rounded-[4px] bg-sunken px-1.5 py-0.5 font-mono font-bold text-ink">{DEMO_OTP}</code>
                    </p>
                    <Button type="submit" block loading={verify.isPending} disabled={busy || code.length !== 6}>
                      {t('auth:login.verify')}
                    </Button>
                    <Button
                      variant="ghost"
                      block
                      onClick={() => {
                        verify.reset()
                        setCode('')
                        setCodeStep('email')
                      }}
                    >
                      {t('auth:login.back')}
                    </Button>
                  </form>
                )}
              </TabsContent>
            </Tabs>
          </Card>

          <p className="mt-6 text-center text-[15px] text-muted">
            {t('auth:login.noAccount')}{' '}
            <Link to="/register" className="font-semibold text-primary underline-offset-4 hover:underline">
              {t('auth:login.register')}
            </Link>
          </p>
        </main>
      </div>
    </div>
  )
}
