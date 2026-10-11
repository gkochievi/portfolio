/** Sign in: pine brand panel + one-click demo personas + free-form form. */
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { DemoAccounts } from '@portfolio/demo-kit'
import { useTranslation } from 'react-i18next'
import { Archive, Hash, Headset, LogIn, PhoneCall, type LucideIcon } from 'lucide-react'

import { LogoMark, PolyphonyMotif, Wordmark } from '@/components/brand'
import { Banner, Button, Field, Input } from '@/components/ui'
import { bus, session, store } from '@/demo'
import { DEMO_PASSWORD } from '@/demo/seed/personas'
import { ApiError, http } from '@/lib/api'
import { queryClient } from '@/lib/queryClient'
import { firstAllowedPath } from '@/lib/rbac'
import type { MeResponse } from '@/types'
import { LangToggle, ThemeToggle } from './AppShell'
import { useLang } from './state'

const FEATURES: { key: string; icon: LucideIcon }[] = [
  { key: 'calls', icon: PhoneCall },
  { key: 'archive', icon: Archive },
  { key: 'cc', icon: Headset },
  { key: 'ext', icon: Hash },
]

export default function LoginPage() {
  const { t } = useTranslation('shell')
  const lang = useLang()
  const navigate = useNavigate()
  const first = session.accounts[0]
  const [username, setUsername] = useState(first?.username ?? '')
  const [password, setPassword] = useState(DEMO_PASSWORD)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    document.title = `${t('login.title')} · ${t('common:product.name')}`
  }, [t, lang])

  const signIn = async (user: string, pass: string, key: string) => {
    setError(null)
    setBusy(key)
    try {
      const persona = await http.post<MeResponse['persona']>('/auth/login', { username: user, password: pass })
      queryClient.clear()
      bus.emit('session:changed')
      navigate(firstAllowedPath(persona.role, store.data.rbacOverrides), { replace: true })
    } catch (err) {
      setError(err instanceof ApiError && err.status === 400 ? t('login.invalid') : err instanceof Error ? err.message : t('login.invalid'))
    } finally {
      setBusy(null)
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void signIn(username, password, 'form')
  }

  const accounts = session.accounts.map((p) => ({
    ...p,
    name: lang === 'ka' ? p.nameKa : p.name,
    roleLabel: t(`common:roles.${p.role}`),
    description: t(`personas.${p.role}`, { defaultValue: p.description ?? '' }),
  }))

  return (
    <div className="grid min-h-[100dvh] bg-bg text-ink lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      {/* Brand panel */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-pine p-10 text-linen lg:flex">
        <div className="flex items-center gap-3">
          <LogoMark size={36} />
          <Wordmark lang={lang} tone="linen" className="text-[28px]" animate />
        </div>
        <div className="max-w-md">
          <PolyphonyMotif ground="pine" animate dots className="mb-10 w-full max-w-[380px]" />
          <h1 className="text-[30px] font-bold leading-tight text-linen">{t('common:product.tagline')}</h1>
          <p className="mt-3 text-[15px] text-[#B9C3BC]">{t('common:product.line')}</p>
          <ul className="mt-8 flex flex-col gap-3.5">
            {FEATURES.map(({ key, icon: Icon }) => (
              <li key={key} className="flex items-start gap-3 text-[14px] text-[#D5DCD6]">
                <Icon size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-brass" aria-hidden />
                <span>{t(`login.features.${key}`)}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-[12.5px] text-[#9AA79F]">{t('login.tenant', { tenant: t('common:tenant.name') })}</p>
      </aside>

      {/* Form side */}
      <main className="flex min-w-0 flex-col">
        <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-8">
          <div className="flex items-center gap-2.5 lg:invisible">
            <LogoMark size={30} />
            <Wordmark lang={lang} className="text-[22px]" />
          </div>
          <div className="flex items-center gap-2">
            <LangToggle lang={lang} />
            <ThemeToggle />
          </div>
        </div>

        <div className="mx-auto w-full max-w-[720px] flex-1 px-4 pb-28 pt-4 sm:px-8 lg:pt-10">
          <h2 className="text-[26px] font-bold">{t('login.title')}</h2>
          <p className="mt-1 text-muted">{t('login.subtitle')}</p>
          <div aria-hidden className="mt-4 h-[2px] w-full origin-left rounded-full bg-primary animate-draw" />

          <section className="mt-7" aria-labelledby="demo-accounts">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h3 id="demo-accounts" className="text-[15px] font-semibold">
                {t('login.accounts')}
              </h3>
              <span className="text-[12.5px] text-muted">{t('login.accountsHint')}</span>
            </div>
            <DemoAccounts
              accounts={accounts}
              currentId={null}
              disabled={busy !== null}
              label={t('login.accounts')}
              onPick={(a) => void signIn(a.username, a.password, a.id)}
              className="grid gap-2.5 sm:grid-cols-2"
              classNames={{
                item: 'min-w-0',
                card:
                  'group flex h-full w-full items-start gap-3 rounded-[10px] border border-line bg-panel p-3.5 text-left transition-colors duration-[160ms] hover:border-primary/60 hover:bg-primary/5 disabled:cursor-wait disabled:opacity-60',
                avatar:
                  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--bdk-avatar,#2F5D4E)] text-[13px] font-semibold text-[#FBFCF8]',
                body: 'flex min-w-0 flex-1 flex-col',
                name: 'truncate text-[14px] font-semibold text-ink',
                role: 'truncate text-[12.5px] font-medium text-primary',
                email: 'truncate font-mono text-[11.5px] text-muted',
                description: 'mt-1 text-[12.5px] leading-snug text-muted',
              }}
            />
          </section>

          <div className="my-7 flex items-center gap-3 text-[12.5px] text-muted">
            <span className="h-px flex-1 bg-line" />
            {t('login.or')}
            <span className="h-px flex-1 bg-line" />
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-[10px] border border-line bg-panel p-5" noValidate>
            {error && <Banner tone="danger">{error}</Banner>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('login.username')}>
                <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" spellCheck={false} />
              </Field>
              <Field label={t('login.password')}>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
              </Field>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-md text-[12.5px] text-muted">
                {t('login.demoNote', { password: DEMO_PASSWORD })}
              </p>
              <Button type="submit" variant="primary" icon={LogIn} loading={busy === 'form'} disabled={busy !== null && busy !== 'form'}>
                {t('login.submit')}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
