/** Route /login: staff sign-in + one-click persona cards. Owner: shell. */
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
import { canOpenArea, clearData, useMe } from '@/lib/session'
import type { StaffArea } from '@/types'

const staffAccounts = accounts.filter((a) => a.realm === 'staff')

export function safeNext(next: string | null, realm: 'staff' | 'partner'): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return null
  const partnerPath = next === '/partner' || next.startsWith('/partner/')
  if (realm === 'partner' ? !partnerPath : partnerPath) return null
  return next
}

export default function LoginPage() {
  const { t } = useTranslation('shell')
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const me = useMe()
  const next = safeNext(params.get('next'), 'staff')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const schema = z.object({
    email: z.string().trim().min(1, t('auth.errors.required')).email(t('auth.errors.email')),
    password: z.string().min(1, t('auth.errors.required')),
  })
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: staffAccounts[0]?.email ?? '', password: DEMO_PASSWORD },
  })

  const land = (account: RigiAccount) => {
    clearData()
    const area = next?.split(/[/?#]/)[1] as StaffArea | undefined
    const target = next && area && canOpenArea(account, area) ? next : account.home
    navigate(target, { replace: true })
  }

  const submit = form.handleSubmit(async (values) => {
    setError(null)
    try {
      land(await http.post<RigiAccount>('/auth/login', values))
    } catch (e) {
      setError(isApiError(e, 400) ? t('auth.errors.invalid') : t('common:states.error'))
    }
  })

  const pick = async (account: RigiAccount) => {
    setBusy(true)
    try {
      land(await http.post<RigiAccount>('/auth/switch', { accountId: account.id }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthScreen realm="staff">
      <h1 className="font-display text-[28px] font-bold leading-[34px] tracking-[-0.02em]">{t('auth.staff.title')}</h1>
      <p className="mt-1.5 text-sm text-muted">{t('auth.staff.subtitle')}</p>

      <form onSubmit={submit} noValidate className="mt-6 flex flex-col gap-4">
        {error ? <Banner tone="danger">{error}</Banner> : null}
        <Field label={t('common:fields.email')} htmlFor="email" error={form.formState.errors.email?.message}>
          <Input id="email" type="email" autoComplete="username" invalid={Boolean(form.formState.errors.email)} {...form.register('email')} />
        </Field>
        <Field label={t('common:fields.password')} htmlFor="password" error={form.formState.errors.password?.message}>
          <Input id="password" type="password" autoComplete="current-password" invalid={Boolean(form.formState.errors.password)} {...form.register('password')} />
        </Field>
        <div className="flex items-center justify-between gap-3">
          <Link to="/forgot-password" className="link text-[13px]">{t('auth.forgot')}</Link>
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
      <PersonaCards accounts={staffAccounts} onPick={(a) => void pick(a)} disabled={busy} currentId={me?.id ?? null} />

      <p className="mt-6 text-[13px] text-muted">
        {t('auth.staff.partnerHint')}{' '}
        <Link to="/partner/login" className="link">{t('auth.staff.partnerLink')}</Link>
      </p>
    </AuthScreen>
  )
}
