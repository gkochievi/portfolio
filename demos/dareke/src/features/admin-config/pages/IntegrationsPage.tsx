/** /admin/integrations - deployment, softphone, PBX and directory settings (super admin only). */
import { CheckCircle2, Eye, EyeOff, Headphones, Network, PhoneCall, Server, ShieldAlert, Users, XCircle } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { useMe } from '@/app/controls'
import { Badge, Button, EmptyState, Field, IconButton, Input, LoadingBlock, PageHeader, Panel, Switch, Textarea } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatDateTime } from '@/lib/format'
import { toast } from '@/lib/toast'
import type { AppConfig, ClientConfig, ConnectionTestResult, LdapConfig, PbxConfig } from '@/types'

import { useSaveConfigSection, useSystemConfig, useTestConnection, type ConfigSection } from '../api'
import { LoadError, USERNAME_TOKEN, useFieldErrors, useServerText, useToastError } from '../components/shared'

/** Save handler shared by the three editable cards. */
function useCardSave(section: ConfigSection) {
  const { t } = useTranslation('config')
  const save = useSaveConfigSection()
  const mapErrors = useFieldErrors()
  const toastError = useToastError()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const run = (input: Record<string, unknown>, onDone?: () => void) => {
    setErrors({})
    save.mutate(
      { section, input },
      {
        onSuccess: () => {
          toast.success(t('integrations.saved'))
          onDone?.()
        },
        onError: (error) => {
          const fields = mapErrors(error)
          if (Object.keys(fields).length) setErrors(fields)
          else toastError(error)
        },
      },
    )
  }
  return { run, errors, saving: save.isPending }
}

function TestResult({ result }: { result: ConnectionTestResult }) {
  const { t } = useTranslation('config')
  const text = useServerText()
  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-2.5 rounded-control border px-3 py-2.5 text-sm',
        result.ok ? 'border-success/40 bg-success/10 text-success' : 'border-danger/40 bg-danger/10 text-danger',
      )}
    >
      {result.ok ? <CheckCircle2 size={18} strokeWidth={1.75} className="mt-px shrink-0" aria-hidden /> : <XCircle size={18} strokeWidth={1.75} className="mt-px shrink-0" aria-hidden />}
      <span className="min-w-0 flex-1 break-words font-medium">{text(result.message)}</span>
      {result.latencyMs !== null && <span className="shrink-0 font-mono text-xs tabular">{t('integrations.latency', { ms: result.latencyMs })}</span>}
    </div>
  )
}

function TestRow({ target, payload }: { target: 'pbx' | 'ldap'; payload: Record<string, unknown> }) {
  const { t } = useTranslation('config')
  const test = useTestConnection(target)
  const toastError = useToastError()
  return (
    <div className="flex flex-col gap-3">
      <div>
        <Button
          variant="outline"
          loading={test.isPending}
          icon={<Network size={18} strokeWidth={1.75} />}
          onClick={() => test.mutate(payload, { onError: toastError })}
        >
          {test.isPending ? t('integrations.testing') : t('integrations.test')}
        </Button>
      </div>
      {test.data && !test.isPending && <TestResult result={test.data} />}
    </div>
  )
}

function SecretInput({ id, value, onChange, isSet, label }: { id: string; value: string; onChange: (v: string) => void; isSet: boolean; label: string }) {
  const { t } = useTranslation('config')
  const [visible, setVisible] = useState(false)
  return (
    <Input
      id={id}
      mono
      autoComplete="new-password"
      type={visible ? 'text' : 'password'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={isSet ? '••••••••••' : t('integrations.pbx.secretNotSet')}
      aria-label={label}
      suffix={
        <IconButton
          label={visible ? t('integrations.hide') : t('integrations.show')}
          icon={visible ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
          size="sm"
          onClick={() => setVisible((v) => !v)}
        />
      }
    />
  )
}

function CardFooter({ saving, dirty }: { saving: boolean; dirty: boolean }) {
  const { t: tc } = useTranslation()
  return (
    <div className="flex justify-end">
      <Button type="submit" variant="dial" loading={saving} disabled={!dirty}>
        {tc('actions.save')}
      </Button>
    </div>
  )
}

function ReadValue({ label, value, mono = true }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[10rem_1fr] sm:gap-3">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className={cn('min-w-0 break-words text-sm text-ink', mono && 'font-mono')}>{value}</dd>
    </div>
  )
}

/* ------------------------------------------------------------------- cards */

function DeploymentCard({ app }: { app: AppConfig }) {
  const { t } = useTranslation('config')
  const { t: tc } = useTranslation()
  return (
    <Panel
      title={t('integrations.app.title')}
      description={t('integrations.app.description')}
      icon={<Server size={18} strokeWidth={1.75} />}
      actions={<Badge tone="warning" variant="outline">{t('integrations.restartRequired')}</Badge>}
    >
      <dl className="grid gap-3">
        <ReadValue label={t('integrations.app.port')} value={app.port} />
        <ReadValue label={t('integrations.app.host')} value={app.host} />
        <ReadValue label={t('integrations.app.jwt')} value={app.jwtExpiresIn} />
        <ReadValue label={t('integrations.app.cors')} value={app.corsOrigin} />
        <ReadValue label={t('integrations.app.recordings')} value={app.recordingsPath} />
        <ReadValue
          label={t('integrations.app.mockMode')}
          mono={false}
          value={
            <span className="flex flex-col gap-0.5">
              <Badge tone={app.dialerMockMode ? 'success' : 'muted'} className="w-fit">
                {app.dialerMockMode ? tc('states.on') : tc('states.off')}
              </Badge>
              <span className="text-xs text-muted">{t('integrations.app.mockModeHint')}</span>
            </span>
          }
        />
      </dl>
    </Panel>
  )
}

function ClientCard({ client }: { client: ClientConfig }) {
  const { t } = useTranslation('config')
  const card = useCardSave('client')
  const [form, setForm] = useState(client)
  const set = <K extends keyof ClientConfig>(key: K, value: ClientConfig[K]) => setForm((f) => ({ ...f, [key]: value }))
  const dirty = JSON.stringify(form) !== JSON.stringify(client)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    card.run({ ...form })
  }
  return (
    <Panel title={t('integrations.client.title')} description={t('integrations.client.description')} icon={<Headphones size={18} strokeWidth={1.75} />}>
      <form onSubmit={submit} className="grid gap-4" noValidate>
        <Field label={t('integrations.client.apiUrl')} error={card.errors.apiUrl} htmlFor="cl-api">
          <Input id="cl-api" mono value={form.apiUrl} onChange={(e) => set('apiUrl', e.target.value)} invalid={Boolean(card.errors.apiUrl)} />
        </Field>
        <Field label={t('integrations.client.wsUrl')} error={card.errors.wsUrl} htmlFor="cl-ws">
          <Input id="cl-ws" mono value={form.wsUrl} onChange={(e) => set('wsUrl', e.target.value)} invalid={Boolean(card.errors.wsUrl)} />
        </Field>
        <Switch
          checked={form.webrtcEnabled}
          onCheckedChange={(v) => set('webrtcEnabled', v)}
          label={t('integrations.client.webrtc')}
          description={t('integrations.client.webrtcHint')}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('integrations.client.sipWss')} error={card.errors.sipWssUrl} htmlFor="cl-sip">
            <Input id="cl-sip" mono value={form.sipWssUrl} onChange={(e) => set('sipWssUrl', e.target.value)} invalid={Boolean(card.errors.sipWssUrl)} />
          </Field>
          <Field label={t('integrations.client.sipDomain')} htmlFor="cl-domain">
            <Input id="cl-domain" mono value={form.sipDomain} onChange={(e) => set('sipDomain', e.target.value)} />
          </Field>
        </div>
        <Field label={t('integrations.client.ice')} hint={t('integrations.client.iceHint')} htmlFor="cl-ice">
          <Textarea id="cl-ice" className="font-mono text-[13px]" rows={3} value={form.iceServers} onChange={(e) => set('iceServers', e.target.value)} />
        </Field>
        <Switch checked={form.useMockData} onCheckedChange={(v) => set('useMockData', v)} label={t('integrations.client.mockData')} />
        <CardFooter saving={card.saving} dirty={dirty} />
      </form>
    </Panel>
  )
}

function PbxCard({ pbx }: { pbx: PbxConfig }) {
  const { t } = useTranslation('config')
  const card = useCardSave('pbx')
  const [form, setForm] = useState({ host: pbx.host, port: String(pbx.port), username: pbx.username, trunk: pbx.trunk, context: pbx.context, enabled: pbx.enabled })
  const [secret, setSecret] = useState('')
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }))
  const dirty =
    secret !== '' ||
    form.host !== pbx.host ||
    form.port !== String(pbx.port) ||
    form.username !== pbx.username ||
    form.trunk !== pbx.trunk ||
    form.context !== pbx.context ||
    form.enabled !== pbx.enabled
  const submit = (event: FormEvent) => {
    event.preventDefault()
    card.run({ ...form, port: Number(form.port), ...(secret ? { secret } : {}) }, () => setSecret(''))
  }
  return (
    <Panel title={t('integrations.pbx.title')} description={t('integrations.pbx.description')} icon={<PhoneCall size={18} strokeWidth={1.75} />}>
      <form onSubmit={submit} className="grid gap-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
          <Field label={t('integrations.pbx.host')} error={card.errors.host} htmlFor="pbx-host">
            <Input id="pbx-host" mono value={form.host} onChange={(e) => set('host', e.target.value)} invalid={Boolean(card.errors.host)} />
          </Field>
          <Field label={t('integrations.pbx.port')} error={card.errors.port} htmlFor="pbx-port">
            <Input id="pbx-port" mono type="number" inputMode="numeric" min={1} max={65535} value={form.port} onChange={(e) => set('port', e.target.value)} invalid={Boolean(card.errors.port)} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('integrations.pbx.user')} htmlFor="pbx-user">
            <Input id="pbx-user" mono autoComplete="off" value={form.username} onChange={(e) => set('username', e.target.value)} />
          </Field>
          <Field label={t('integrations.pbx.secret')} hint={t('integrations.pbx.secretHint')} htmlFor="pbx-secret">
            <SecretInput id="pbx-secret" value={secret} onChange={setSecret} isSet={pbx.secretSet} label={t('integrations.pbx.secret')} />
          </Field>
          <Field label={t('integrations.pbx.trunk')} htmlFor="pbx-trunk">
            <Input id="pbx-trunk" mono value={form.trunk} onChange={(e) => set('trunk', e.target.value)} />
          </Field>
          <Field label={t('integrations.pbx.context')} htmlFor="pbx-context">
            <Input id="pbx-context" mono value={form.context} onChange={(e) => set('context', e.target.value)} />
          </Field>
        </div>
        <Switch checked={form.enabled} onCheckedChange={(v) => set('enabled', v)} label={t('integrations.pbx.enabled')} />
        <TestRow target="pbx" payload={{ host: form.host, port: Number(form.port) }} />
        <CardFooter saving={card.saving} dirty={dirty} />
      </form>
    </Panel>
  )
}

function LdapCard({ ldap }: { ldap: LdapConfig }) {
  const { t } = useTranslation('config')
  const card = useCardSave('ldap')
  const [form, setForm] = useState({ url: ldap.url, bindDn: ldap.bindDn, baseDn: ldap.baseDn, userSearchFilter: ldap.userSearchFilter, enabled: ldap.enabled })
  const [password, setPassword] = useState('')
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }))
  const dirty =
    password !== '' ||
    form.url !== ldap.url ||
    form.bindDn !== ldap.bindDn ||
    form.baseDn !== ldap.baseDn ||
    form.userSearchFilter !== ldap.userSearchFilter ||
    form.enabled !== ldap.enabled
  const submit = (event: FormEvent) => {
    event.preventDefault()
    card.run({ ...form, ...(password ? { bindPassword: password } : {}) }, () => setPassword(''))
  }
  return (
    <Panel title={t('integrations.ldap.title')} description={t('integrations.ldap.description')} icon={<Users size={18} strokeWidth={1.75} />}>
      <form onSubmit={submit} className="grid gap-4" noValidate>
        <Field label={t('integrations.ldap.url')} error={card.errors.url} htmlFor="ldap-url">
          <Input id="ldap-url" mono value={form.url} onChange={(e) => set('url', e.target.value)} invalid={Boolean(card.errors.url)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('integrations.ldap.bindDn')} htmlFor="ldap-dn">
            <Input id="ldap-dn" mono value={form.bindDn} onChange={(e) => set('bindDn', e.target.value)} />
          </Field>
          <Field label={t('integrations.ldap.bindPassword')} hint={t('integrations.pbx.secretHint')} htmlFor="ldap-pass">
            <SecretInput id="ldap-pass" value={password} onChange={setPassword} isSet={ldap.bindPasswordSet} label={t('integrations.ldap.bindPassword')} />
          </Field>
        </div>
        <Field label={t('integrations.ldap.baseDn')} htmlFor="ldap-base">
          <Input id="ldap-base" mono value={form.baseDn} onChange={(e) => set('baseDn', e.target.value)} />
        </Field>
        <Field label={t('integrations.ldap.filter')} hint={t('integrations.ldap.filterHint', { token: USERNAME_TOKEN })} error={card.errors.userSearchFilter} htmlFor="ldap-filter">
          <Input id="ldap-filter" mono value={form.userSearchFilter} onChange={(e) => set('userSearchFilter', e.target.value)} invalid={Boolean(card.errors.userSearchFilter)} />
        </Field>
        <Switch checked={form.enabled} onCheckedChange={(v) => set('enabled', v)} label={t('integrations.ldap.enabled')} />
        <TestRow target="ldap" payload={{ url: form.url, bindDn: form.bindDn }} />
        <CardFooter saving={card.saving} dirty={dirty} />
      </form>
    </Panel>
  )
}

/* -------------------------------------------------------------------- page */

export default function IntegrationsPage() {
  const { t } = useTranslation('config')
  const { account } = useMe()
  const allowed = account?.role === 'super_admin'
  const query = useSystemConfig(allowed)

  if (!allowed) {
    return (
      <section>
        <PageHeader eyebrow={t('eyebrow')} title={t('pages.IntegrationsPage')} />
        <EmptyState icon={<ShieldAlert size={40} strokeWidth={1.5} />} title={t('shared.accessDenied')} description={t('shared.accessDeniedHint')} />
      </section>
    )
  }

  const config = query.data
  return (
    <section>
      <PageHeader
        eyebrow={t('eyebrow')}
        title={t('pages.IntegrationsPage')}
        description={t('integrations.description')}
        actions={config && <span className="text-xs text-muted">{t('integrations.updatedOn', { date: formatDateTime(config.updatedAt) })}</span>}
      />
      {query.isError ? (
        <LoadError error={query.error} onRetry={() => void query.refetch()} />
      ) : !config ? (
        <LoadingBlock />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <DeploymentCard app={config.app} />
          <ClientCard key={`client-${JSON.stringify(config.client)}`} client={config.client} />
          <PbxCard key={`pbx-${JSON.stringify(config.pbx)}`} pbx={config.pbx} />
          <LdapCard key={`ldap-${JSON.stringify(config.ldap)}`} ldap={config.ldap} />
        </div>
      )}
    </section>
  )
}
