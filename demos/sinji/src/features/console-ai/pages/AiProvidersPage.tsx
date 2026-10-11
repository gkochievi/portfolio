/** Console > AI providers: the registry of named connections per capability (LLM / STT / TTS). */
import { useState } from 'react'
import { CheckCircle2, Ellipsis, KeyRound, Pencil, Plug, Plus, Power, PowerOff, ShieldCheck, Star, Zap } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { errorMessage } from '@/api/client'
import {
  Badge,
  Button,
  Card,
  Callout,
  ConfirmDialog,
  DropdownMenu,
  EmptyState,
  IconButton,
  PageHeader,
  Switch,
  Tabs,
  toast,
  type MenuItem,
} from '@/components/ui'
import { formatDateTime } from '@/lib/format'
import type { AiCapability, AiConnection, AiProviderEntry } from '@/types'
import { useCatalog, useConnections, useMakeDefault, useTestConnection, useUpdateConnection } from '../api'
import { CapabilityLabel, LastTest, QueryState, capabilityIcon, hostOf } from '../components/bits'
import { ConnectionDialog } from '../components/ConnectionDialog'
import { CAPABILITIES } from '../types'

export default function AiProvidersPage() {
  const { t, i18n } = useTranslation('consoleAi')
  const lang = i18n.language
  const [tab, setTab] = useState<AiCapability>('llm')
  const [showInactive, setShowInactive] = useState(false)
  const [dialog, setDialog] = useState<{ open: boolean; connection: AiConnection | null }>({ open: false, connection: null })
  const [toDeactivate, setToDeactivate] = useState<AiConnection | null>(null)
  const [testing, setTesting] = useState<Set<string>>(new Set())

  const catalog = useCatalog()
  const connections = useConnections(showInactive)
  const test = useTestConnection()
  const makeDefault = useMakeDefault()
  const update = useUpdateConnection()

  const list = connections.data ?? []
  const catalogById = new Map((catalog.data ?? []).map((p) => [p.id, p] as const))

  const runTest = async (c: AiConnection) => {
    setTesting((s) => new Set(s).add(c.id))
    try {
      const r = await test.mutateAsync(c.id)
      if (r.ok) toast.success(t('providers.toast.testOk', { name: c.name }))
      else toast.error(t('providers.toast.testFailed', { name: c.name }))
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setTesting((s) => {
        const n = new Set(s)
        n.delete(c.id)
        return n
      })
    }
  }

  const setDefault = async (c: AiConnection) => {
    try {
      await makeDefault.mutateAsync(c.id)
      toast.success(t('providers.toast.defaulted', { name: c.name, capability: t(`capability.${c.capability}`) }))
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const setActive = async (c: AiConnection, is_active: boolean) => {
    try {
      await update.mutateAsync({ id: c.id, is_active })
      toast.success(t(is_active ? 'providers.toast.reactivated' : 'providers.toast.deactivated', { name: c.name }))
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const items = CAPABILITIES.map((cap) => {
    const rows = list
      .filter((c) => c.capability === cap)
      .sort((a, b) => Number(b.is_default) - Number(a.is_default) || Number(b.is_active) - Number(a.is_active) || a.name.localeCompare(b.name))
    return {
      value: cap,
      label: t(`capabilityLong.${cap}`),
      icon: (() => {
        const Icon = capabilityIcon[cap]
        return <Icon aria-hidden />
      })(),
      count: rows.length,
      content: (
        <div className="pt-5">
          {rows.length === 0 ? (
            <EmptyState
              title={t('providers.empty.title', { capability: t(`capability.${cap}`) })}
              body={showInactive ? t('providers.empty.body') : t('providers.empty.bodyActive')}
              action={
                <Button variant="primary" icon={<Plus />} onClick={() => setDialog({ open: true, connection: null })}>
                  {t('providers.new')}
                </Button>
              }
            />
          ) : (
            <ul className="grid gap-4 lg:grid-cols-2">
              {rows.map((c) => (
                <li key={c.id}>
                  <ConnectionCard
                    c={c}
                    entry={catalogById.get(c.provider)}
                    lang={lang}
                    testing={testing.has(c.id)}
                    onTest={() => runTest(c)}
                    onEdit={() => setDialog({ open: true, connection: c })}
                    onDefault={() => setDefault(c)}
                    onDeactivate={() => setToDeactivate(c)}
                    onReactivate={() => setActive(c, true)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      ),
    }
  })

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('providers.title')}
        description={t('providers.description')}
        actions={
          <div className="flex flex-wrap items-center gap-4">
            <Switch checked={showInactive} onCheckedChange={setShowInactive} label={t('providers.showInactive')} size="sm" />
            <Button variant="primary" icon={<Plus />} onClick={() => setDialog({ open: true, connection: null })} disabled={!catalog.data}>
              {t('providers.new')}
            </Button>
          </div>
        }
      />

      <Callout tone="success" icon={<ShieldCheck />} title={t('providers.encryption.title')}>
        {t('providers.encryption.body')}
      </Callout>

      <QueryState loading={connections.isLoading || catalog.isLoading} error={connections.error ?? catalog.error} onRetry={() => { void connections.refetch(); void catalog.refetch() }} rows={4}>
        <Tabs items={items} value={tab} onValueChange={(v) => setTab(v as AiCapability)} />
      </QueryState>

      <ConnectionDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        catalog={catalog.data ?? []}
        connection={dialog.connection}
        capability={tab}
      />

      <ConfirmDialog
        open={toDeactivate !== null}
        onOpenChange={(open) => !open && setToDeactivate(null)}
        title={t('providers.deactivate.title', { name: toDeactivate?.name })}
        body={t('providers.deactivate.body')}
        confirmLabel={t('providers.deactivate.confirm')}
        danger
        onConfirm={async () => {
          if (toDeactivate) await setActive(toDeactivate, false)
          setToDeactivate(null)
        }}
      />
    </div>
  )
}

function ConnectionCard({
  c,
  entry,
  lang,
  testing,
  onTest,
  onEdit,
  onDefault,
  onDeactivate,
  onReactivate,
}: {
  c: AiConnection
  entry: AiProviderEntry | undefined
  lang: string
  testing: boolean
  onTest: () => void
  onEdit: () => void
  onDefault: () => void
  onDeactivate: () => void
  onReactivate: () => void
}) {
  const { t } = useTranslation('consoleAi')
  const settings = Object.entries(c.settings)
  const menu: MenuItem[] = [
    { label: t('providers.card.edit'), icon: <Pencil />, onSelect: onEdit },
    ...(c.is_active && !c.is_default ? [{ label: t('providers.card.makeDefault'), icon: <Star />, onSelect: onDefault } as MenuItem] : []),
    { type: 'separator' },
    c.is_active
      ? { label: t('providers.card.deactivate'), icon: <PowerOff />, danger: true, disabled: c.is_default, hint: c.is_default ? t('providers.card.isDefaultHint') : undefined, onSelect: onDeactivate }
      : { label: t('providers.card.reactivate'), icon: <Power />, onSelect: onReactivate },
  ]
  return (
    <Card className={c.is_active ? 'h-full' : 'h-full bg-sunken/60'}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-display text-lg font-semibold">{c.name}</h3>
            {c.is_default ? (
              <Badge tone="primary" icon={<Star className="size-3" />}>
                {t('providers.card.default')}
              </Badge>
            ) : null}
            {!c.is_active ? <Badge tone="neutral">{t('providers.card.inactive')}</Badge> : null}
          </div>
          <p className="mt-0.5 text-[13px] text-muted">
            <CapabilityLabel capability={c.capability} short /> · {entry?.name ?? c.provider}
          </p>
        </div>
        <DropdownMenu
          align="end"
          trigger={<IconButton label={t('providers.card.more')} icon={<Ellipsis />} />}
          items={menu}
        />
      </div>

      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
        <dt className="text-muted">{t('providers.card.model')}</dt>
        <dd className="min-w-0 truncate font-mono">{c.model}</dd>
        <dt className="text-muted">{t('providers.card.baseUrl')}</dt>
        <dd className="min-w-0 truncate font-mono" title={c.base_url ?? undefined}>
          {c.base_url ? hostOf(c.base_url) + (new URL(c.base_url, 'http://x').pathname === '/' ? '' : new URL(c.base_url, 'http://x').pathname) : <span className="font-sans text-muted">{t('providers.card.baseUrlDefault')}</span>}
        </dd>
        <dt className="text-muted">{t('providers.card.key')}</dt>
        <dd className="flex min-w-0 items-center gap-1.5">
          <KeyRound className="size-3.5 shrink-0 text-muted" strokeWidth={1.75} aria-hidden />
          {c.has_key ? <span className="font-mono">{c.key_hint}</span> : <span className="text-muted">{t('providers.card.noKey')}</span>}
        </dd>
        {settings.length ? (
          <>
            <dt className="text-muted">{t('providers.card.settings')}</dt>
            <dd className="flex min-w-0 flex-wrap gap-1.5">
              {settings.map(([k, v]) => (
                <Badge key={k} shape="tag" tone="neutral" className="font-mono">
                  {k}={String(v)}
                </Badge>
              ))}
            </dd>
          </>
        ) : null}
      </dl>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
        <div className="min-w-0 flex-1" aria-live="polite">
          {testing ? <span className="text-[13px] text-muted">{t('providers.card.testing')}</span> : <LastTest test={c.last_test} lang={lang} />}
        </div>
        <div className="flex items-center gap-2">
          {c.last_test?.ok && !testing ? <CheckCircle2 className="size-4 text-success" aria-hidden /> : null}
          <Button size="sm" variant="secondary" icon={<Zap />} loading={testing} onClick={onTest} disabled={!c.is_active} className="min-w-20">
            {t('providers.card.test')}
          </Button>
          <Button size="sm" variant="ghost" icon={<Plug />} onClick={onEdit}>
            {t('providers.card.configure')}
          </Button>
        </div>
      </div>
      <p className="mt-2 text-xs text-subtle">{t('providers.card.updated', { when: formatDateTime(c.updated_at, lang), by: c.updated_by ?? '-' })}</p>
    </Card>
  )
}
