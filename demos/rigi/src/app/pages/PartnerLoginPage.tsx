/** Route /partner/login: partner portal sign-in (username or email). Owner: shell. */
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AuthScreen, PersonaCards } from '@/components/layout/AuthScreen'
import { Banner, Button, Field, Input } from '@/components/ui'
import { accounts, DEMO_PASSWORD, type RigiAccount } from '@/demo/accounts'
import { http, isApiError } from '@/lib/api'
import { clearData, useMe } from '@/lib/session'

import { safeNext } from './LoginPage'

const partnerAccounts = accounts.filter((a) => a.realm === 'partner')

export default function PartnerLoginPage() {
  const { t } = useTranslation('shell')
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const me = useMe()
  const next = safeNext(params.get('next'), 'partner')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const schema = z.object({
    username: z.string().trim().min(1, t('auth.errors.required')),
    password: z.string().min(1, t('auth.errors.required')),
  })
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { username: partnerAccounts[0]?.username ?? '', password: DEMO_PASSWORD },
  })

  const land = (account: RigiAccount) => {
    clearData()
    navigate(next ?? account.home, { replace: true })
  }

  const explain = (e: unknown) =>
    isApiError(e, 403) ? t('auth.errors.disabled') : isApiError(e, 400) ? t('auth.errors.invalidUsername') : t('common:states.error')

  const submit = form.handleSubmit(async (values) => {
    setError(null)
    try {
      land(await http.post<RigiAccount>('/portal/auth/login', values))
    } catch (e) {
      setError(explain(e))
    }
  })

  const pick = async (account: RigiAccount) => {
    setBusy(true)
    setError(null)
    try {
      land(await http.post<RigiAccount>('/auth/switch', { accountId: account.id }))
    } catch (e) {
      setError(explain(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthScreen realm="partner">
      <p className="eyebrow">{t('common:app.partnerSpace')}</p>
      <h1 className="mt-1 font-display text-[28px] font-bold leading-[34px] tracking-[-0.02em]">{t('auth.partner.title')}</h1>
      <p className="mt-1.5 text-sm text-muted">{t('auth.partner.subtitle')}</p>

      <form onSubmit={submit} noValidate className="mt-6 flex flex-col gap-4">
        {error ? <Banner tone="danger">{error}</Banner> : null}
        <Field label={t('auth.partner.username')} htmlFor="username" hint={t('auth.partner.usernameHint')} error={form.formState.errors.username?.message}>
          <Input id="username" autoComplete="username" invalid={Boolean(form.formState.errors.username)} {...form.register('username')} />
        </Field>
        <Field label={t('common:fields.password')} htmlFor="password" error={form.formState.errors.password?.message}>
          <Input id="password" type="password" autoComplete="current-password" invalid={Boolean(form.formState.errors.password)} {...form.register('password')} />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" loading={form.formState.isSubmitting} iconRight={<ArrowRight aria-hidden />}>
            {t('common:actions.signIn')}
          </Button>
        </div>
      </form>

      <div className="my-7 flex items-center gap-3">
        <span className="h-px flex-1 bg-hairline" />
        <span className="eyebrow">{t('auth.orPersona')}</span>
        <span className="h-px flex-1 bg-hairline" />
      </div>
      <PersonaCards accounts={partnerAccounts} onPick={(a) => void pick(a)} disabled={busy} currentId={me?.id ?? null} />

      <p className="mt-6 text-[13px] text-muted">
        {t('auth.partner.staffHint')}{' '}
        <Link to="/login" className="link">{t('auth.partner.staffLink')}</Link>
      </p>
    </AuthScreen>
  )
}
