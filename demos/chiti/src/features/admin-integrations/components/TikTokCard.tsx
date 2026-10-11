/**
 * TikTok card: state (connected / unverified / blocked / needs reauthorisation),
 * account, limits, EU inbound counter, and a simulated authorise popup that
 * is polled every 3 s until the platform answers. The outcome follows the
 * `demo.tiktokConnectResult` debug switch. The AI assistant is not allowed on TikTok.
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, RefreshCw, Trash2, Zap } from 'lucide-react'

import { errorMessage } from '@/api/client'
import { Avatar, Badge, Button, Card, ConfirmDialog, Modal, Spinner, toast, type BadgeTone } from '@/components/ui'
import { formatDateTime } from '@/lib/format'
import type { TikTokIntegration } from '@/types'

import { useCheckTikTok, useConnectTikTok, useDisconnectTikTok, useTestTikTok } from '../api'
import { CardTitle } from './MetaCard'
import { Notice, SummaryRow, useLang } from './shared'

const TONE: Record<TikTokIntegration['state'], BadgeTone> = { not_configured: 'muted', connected: 'success', unverified: 'warning', blocked: 'danger', needs_reauth: 'warning' }
const BANNER_TONE: Record<TikTokIntegration['state'], 'success' | 'info' | 'warning' | 'danger'> = { not_configured: 'info', connected: 'success', unverified: 'warning', blocked: 'danger', needs_reauth: 'warning' }

type Popup = 'closed' | 'consent' | 'waiting'

export function TikTokCard({ integration, allowed, pending }: { integration: TikTokIntegration; allowed: boolean; pending: boolean }) {
  const { t } = useTranslation(['adminIntegrations', 'common'])
  const lang = useLang()
  const connect = useConnectTikTok()
  const check = useCheckTikTok()
  const test = useTestTikTok()
  const disconnect = useDisconnectTikTok()
  const [popup, setPopup] = useState<Popup>('closed')
  const [confirm, setConfirm] = useState(false)
  const [banner, setBanner] = useState<{ tone: 'success' | 'info' | 'warning' | 'danger'; text: string } | null>(null)
  const sawPending = useRef(false)

  // The popup closes by itself once the platform has answered (the poll flips `pending` off).
  useEffect(() => {
    if (popup !== 'waiting') {
      sawPending.current = false
      return
    }
    if (pending) sawPending.current = true
    else if (sawPending.current) {
      setPopup('closed')
      setBanner({ tone: BANNER_TONE[integration.state], text: t(`channels.tiktok.result.${integration.state}`, { name: integration.account?.username ?? '' }) })
    }
  }, [popup, pending, integration.state, integration.account?.username, t])

  if (!allowed) {
    return (
      <Card muted className="flex flex-col gap-3">
        <CardTitle channel="tiktok" name={t('channels.tiktok.title')} badge={<Badge tone="muted">{t('channels.disabledByPlatform')}</Badge>} />
        <Notice tone="info">{t('channels.disabledByPlatformHint')}</Notice>
      </Card>
    )
  }

  const state = integration.state
  const reconnect = state === 'needs_reauth' || state === 'blocked' || state === 'unverified'
  const startPopup = () => {
    setBanner(null)
    setPopup('consent')
  }

  const authorize = async () => {
    try {
      await connect.mutateAsync()
      setPopup('waiting')
    } catch (error) {
      setPopup('closed')
      toast.error(errorMessage(error))
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <CardTitle channel="tiktok" name={t('channels.tiktok.title')} badge={<Badge tone={TONE[state]} dot>{t(`channels.tiktok.state.${state}`)}</Badge>} />
      <Notice tone="info">{t('channels.aiNotAllowed', { channel: 'TikTok' })}</Notice>

      {state === 'not_configured' ? <p className="text-sm text-muted">{t('channels.tiktok.intro')}</p> : <p className="text-sm">{t(`channels.tiktok.stateHint.${state}`)}</p>}

      {integration.account ? (
        <div className="flex items-center gap-3 rounded-ui border border-line bg-bg p-3">
          <Avatar name={integration.account.name} avatarId={integration.account.avatarId} size="lg" />
          <div className="min-w-0">
            <p className="truncate font-medium">{integration.account.name}</p>
            <p className="truncate font-mono text-[13px] text-muted">{integration.account.username}</p>
          </div>
        </div>
      ) : null}

      {state !== 'not_configured' ? (
        <dl>
          <SummaryRow label={t('channels.tiktok.window')}>{t('channels.tiktok.windowValue')}</SummaryRow>
          <SummaryRow label={t('channels.tiktok.cap')}>{t('channels.tiktok.capValue')}</SummaryRow>
          <SummaryRow label={t('channels.tiktok.euDropped')}>
            <span className="tabular">{integration.euInboundDropped}</span>
          </SummaryRow>
          <SummaryRow label={t('channels.tiktok.connectedAt')}>{integration.connectedAt ? formatDateTime(integration.connectedAt, lang) : '—'}</SummaryRow>
        </dl>
      ) : null}
      {state !== 'not_configured' && integration.euInboundDropped > 0 ? <p className="-mt-2 text-[13px] text-muted">{t('channels.tiktok.euDroppedHint')}</p> : null}

      {banner ? <Notice tone={banner.tone}>{banner.text}</Notice> : null}

      <div className="mt-auto flex flex-wrap gap-2">
        {state === 'not_configured' ? (
          <Button variant="accent" size="sm" onClick={startPopup}>{t('channels.tiktok.connect')}</Button>
        ) : (
          <>
            {reconnect ? <Button variant="accent" size="sm" onClick={startPopup}>{t('channels.tiktok.reconnect')}</Button> : null}
            <Button
              variant="outline"
              size="sm"
              loading={check.isPending}
              leftIcon={<RefreshCw size={16} strokeWidth={1.75} />}
              onClick={async () => {
                setBanner(null)
                try {
                  const result = await check.mutateAsync()
                  setBanner({ tone: BANNER_TONE[result.state], text: result.changed ? t(`channels.tiktok.result.${result.state}`, { name: integration.account?.username ?? '' }) : t(`channels.tiktok.unchanged.${result.state}`) })
                } catch (error) {
                  setBanner({ tone: 'danger', text: errorMessage(error) })
                }
              }}
            >
              {t('channels.tiktok.check')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              loading={test.isPending}
              leftIcon={<Zap size={16} strokeWidth={1.75} />}
              onClick={async () => {
                setBanner(null)
                try {
                  const result = await test.mutateAsync()
                  setBanner(result.ok ? { tone: 'success', text: t('channels.tiktok.testOk') } : { tone: 'warning', text: t('channels.tiktok.testFail') })
                } catch (error) {
                  setBanner({ tone: 'danger', text: errorMessage(error) })
                }
              }}
            >
              {t('channels.meta.test')}
            </Button>
            <Button variant="danger-outline" size="sm" leftIcon={<Trash2 size={16} strokeWidth={1.75} />} onClick={() => setConfirm(true)}>
              {t('channels.tiktok.disconnect')}
            </Button>
          </>
        )}
      </div>

      <Modal
        open={popup !== 'closed'}
        onOpenChange={(open) => !open && setPopup('closed')}
        title={t('channels.tiktok.popup.title')}
        description={t('channels.tiktok.popup.description')}
        footer={
          popup === 'consent' ? (
            <>
              <Button variant="secondary" onClick={() => setPopup('closed')}>{t('common:actions.cancel')}</Button>
              <Button variant="accent" loading={connect.isPending} onClick={() => void authorize()}>{t('channels.tiktok.popup.authorize')}</Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setPopup('closed')}>{t('channels.tiktok.popup.close')}</Button>
          )
        }
      >
        {popup === 'consent' ? (
          <>
            <ul className="flex flex-col gap-2 text-sm">
              {(['read', 'send', 'profile'] as const).map((scope) => (
                <li key={scope} className="flex items-start gap-2">
                  <Check size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                  <span>{t(`channels.tiktok.popup.scope.${scope}`)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-muted">{t('channels.tiktok.popup.demoNote')}</p>
          </>
        ) : (
          <div className="flex items-center gap-3 rounded-ui bg-sunken px-4 py-4" role="status">
            <Spinner size={20} />
            <div>
              <p className="text-sm font-medium">{t('channels.tiktok.popup.waiting')}</p>
              <p className="text-[13px] text-muted">{t('channels.tiktok.popup.polling')}</p>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        tone="danger"
        title={t('channels.tiktok.disconnectTitle')}
        description={t('channels.tiktok.disconnectDescription')}
        confirmLabel={t('channels.tiktok.disconnect')}
        onConfirm={async () => {
          await disconnect.mutateAsync()
          setBanner(null)
          toast.success(t('channels.tiktok.disconnected'))
        }}
      />
    </Card>
  )
}
