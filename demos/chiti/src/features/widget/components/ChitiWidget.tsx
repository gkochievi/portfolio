/**
 * The Chiti customer widget: launcher + 380x600 card. One component serves the
 * storefront (floating), the live desk (contained in its pane) and the
 * full-page `/widget` route. Conversation state lives in `../controller`.
 */
import { useEffect, useState } from 'react'
import { ChevronDown, Headset, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ChitiLauncherMark, ChitiMark } from '@/components/brand'
import { Avatar, CountBubble, ErrorState, IconButton, Spinner } from '@/components/ui'
import { cn } from '@/lib/cn'
import { useAccount } from '@/lib/account'
import { pickText } from '@/lib/format'
import type { Lang, WidgetPosition } from '@/types'

import { useWidgetConfig } from '../api'
import { useWidget } from '../controller'
import { themeStyle, isDarkTheme } from '../themes'
import { ChatView } from './ChatView'
import { FaqView } from './FaqView'
import { PreChatForm, personaValues } from './PreChatForm'
import { BannedPanel, DisabledCard, EndChatDialog, FeedbackDialog, InactivityDialog, NotFoundCard, OfflinePanel } from './panels'

export type WidgetMode = 'floating' | 'contained' | 'page'

export interface ChitiWidgetProps {
  slug: string
  mode: WidgetMode
  /** Overrides the tenant's configured position (the storefront demo panel does not need it). */
  position?: WidgetPosition
  /** Open the card on mount. */
  defaultOpen?: boolean
  /** Always pre-fill the form with the customer persona (live desk), not only when signed in as Ana. */
  persona?: boolean
}

export function ChitiWidget({ slug, mode, position, defaultOpen = false, persona = false }: ChitiWidgetProps) {
  const { t, i18n } = useTranslation('widget')
  const lang: Lang = i18n.language?.startsWith('ka') ? 'ka' : 'en'
  const account = useAccount()
  const [state, controller] = useWidget(slug)
  const configQuery = useWidgetConfig(slug)
  const config = configQuery.data
  const [confirmEnd, setConfirmEnd] = useState(false)

  controller.lang = lang
  if (config) controller.requestFeedback = config.requestFeedback

  const page = mode === 'page'
  const open = page ? true : state.open

  useEffect(() => {
    if (defaultOpen || page) controller.setOpen(true)
  }, [controller, defaultOpen, page])

  // Pre-fill the persona (Ana) once the field list is known.
  const fields = config?.fields
  const personaOn = persona || account?.id === 'cus_ana'
  useEffect(() => {
    if (personaOn && config?.state === 'active' && fields && fields.length > 0 && !state.prefilled) controller.prefill(personaValues(fields, lang))
  }, [personaOn, config?.state, fields, controller, lang, state.prefilled])

  // After the thank-you, start over.
  useEffect(() => {
    if (state.feedback !== 'sent') return
    const timer = setTimeout(() => controller.reset(), 1_600)
    return () => clearTimeout(timer)
  }, [state.feedback, controller])

  const side: WidgetPosition = position ?? config?.widgetPosition ?? 'right'
  const theme = config?.clientTheme ?? 'canary'
  const faq = config?.faq
  const faqEnabled = !!faq?.enabled && !!faq.tree.rootIds.length
  const stage = state.stage === 'faq' && !faqEnabled ? 'form' : state.stage
  const offline = !!config && config.state === 'active' && !config.hours.isOpen && !state.sessionId

  const session = state.session
  const ended = session?.status === 'ended'
  const operatorName = state.operator?.nickname ?? null

  let statusText = t('status.assistant')
  let statusTone: 'bot' | 'online' | 'waiting' | 'off' = 'bot'
  if (stage === 'chat' && session) {
    if (ended) {
      statusText = t('status.ended')
      statusTone = 'off'
    } else if (session.operatorId && operatorName) {
      statusText = t('status.operatorOnline', { name: operatorName })
      statusTone = 'online'
    } else if (session.aiState === 'bot') {
      statusText = t('status.assistant')
      statusTone = 'bot'
    } else if (session.status === 'waiting' || !session.operatorId) {
      statusText = t('status.waiting')
      statusTone = 'waiting'
    }
  } else if (offline) {
    statusText = t('status.offline')
    statusTone = 'off'
  }

  const title = config?.chatTitle ? pickText(config.chatTitle, lang) : t('title.fallback')
  const closeCard = () => controller.setOpen(false)

  /* ------------------------------------------------------------- body */
  let body
  if (configQuery.isPending) {
    body = (
      <div className="grid flex-1 place-items-center">
        <Spinner label={t('loading')} />
      </div>
    )
  } else if (configQuery.isError || !config) {
    body = (
      <div className="grid flex-1 place-items-center p-4">
        <ErrorState title={t('error.title')} onRetry={() => void configQuery.refetch()} retryLabel={t('errors.retry')} />
      </div>
    )
  } else if (config.state === 'not_found') {
    body = <NotFoundCard slug={slug} />
  } else if (config.state === 'disabled' || state.failure?.code === 'TENANT_DISABLED') {
    body = <DisabledCard />
  } else if (state.failure?.code === 'CLIENT_BANNED') {
    body = (
      <BannedPanel
        message={state.failure.bannedMessage ?? state.failure.message}
        onClose={() => {
          controller.clearFailure()
          if (!page) closeCard()
        }}
      />
    )
  } else if (stage === 'chat') {
    body = <ChatView state={state} controller={controller} lang={lang} />
  } else if (offline) {
    body = <OfflinePanel config={config} lang={lang} onClose={page ? undefined : closeCard} />
  } else if (stage === 'form') {
    body = (
      <PreChatForm
        state={state}
        controller={controller}
        fields={config.fields}
        lang={lang}
        faqEnabled={faqEnabled}
        onRetry={() => void configQuery.refetch()}
      />
    )
  } else if (faq) {
    body = <FaqView state={state} controller={controller} tree={faq.tree} lang={lang} showOperatorButton={faq.showOperatorButton} />
  }

  const showConnect = !!config && config.state === 'active' && stage === 'faq' && faqEnabled && faq?.showOperatorButton && !offline && !state.failure
  const canEnd = stage === 'chat' && !!session && !ended

  const cardClass = cn(
    'pointer-events-auto relative flex flex-col overflow-hidden border border-line bg-bg font-sans text-ink',
    page
      ? 'mx-auto h-[600px] max-h-[calc(100dvh-2rem)] w-[380px] max-w-full rounded-modal shadow-pop'
      : cn(
          'h-[600px] w-[380px] max-w-[calc(100vw-2rem)] rounded-modal shadow-pop animate-pop-in',
          mode === 'floating' ? 'max-h-[calc(100dvh-7.5rem)]' : 'max-h-[calc(100%-4.5rem)] min-h-0',
          mode === 'floating'
            ? 'max-sm:fixed max-sm:inset-x-2 max-sm:bottom-[84px] max-sm:top-2 max-sm:h-auto max-sm:max-h-none max-sm:w-auto max-sm:max-w-none'
            : 'max-sm:absolute max-sm:inset-x-2 max-sm:bottom-[84px] max-sm:top-2 max-sm:h-auto max-sm:max-h-none max-sm:w-auto max-sm:max-w-none',
        ),
  )

  const card = (
    <section className={cardClass} aria-label={title} data-chiti-widget>
      <header className="flex shrink-0 items-center gap-2.5 border-b border-line bg-bg px-3.5 py-2.5">
        {state.operator && stage === 'chat' ? (
          <span key={state.operator.id} className="animate-slide-in-right">
            <Avatar name={state.operator.nickname} avatarId={state.operator.avatarId} avatarUrl={state.operator.avatarUrl} size="md" status="online" />
          </span>
        ) : (
          <ChitiMark size={34} />
        )}
        <div className="min-w-0 flex-1">
          <h2 className="m-0 truncate font-display text-[15px] font-semibold leading-tight">{title}</h2>
          <p className="m-0 mt-0.5 flex items-center gap-1.5 text-[12px] leading-tight text-muted" aria-live="polite">
            <span
              aria-hidden
              className={cn(
                'size-[7px] shrink-0 rounded-full',
                statusTone === 'online' && 'bg-success',
                statusTone === 'bot' && 'bg-primary ring-1 ring-ink/40',
                statusTone === 'waiting' && 'bg-warning',
                statusTone === 'off' && 'bg-line-strong',
              )}
            />
            <span className="truncate">{statusText}</span>
          </p>
        </div>
        {showConnect && (
          <button
            type="button"
            onClick={() => controller.connectToOperator(faq!.tree, t('faq.connect'))}
            className="inline-flex max-w-[136px] shrink-0 items-center gap-1.5 rounded-ui border-[1.5px] border-ink px-2 py-1 text-left text-[11.5px] font-medium leading-[1.15] hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Headset size={15} strokeWidth={1.75} aria-hidden className="shrink-0" />
            <span className="min-w-0 break-words">{t('header.connect')}</span>
          </button>
        )}
        {canEnd && <IconButton label={t('header.endChat')} icon={<X size={18} strokeWidth={1.75} />} variant="ghost" size="sm" onClick={() => setConfirmEnd(true)} />}
        {!page && <IconButton label={t('header.minimize')} icon={<ChevronDown size={18} strokeWidth={1.75} />} variant="ghost" size="sm" onClick={closeCard} />}
      </header>

      <div className="flex min-h-0 flex-1 flex-col bg-bg">{body}</div>

      {stage !== 'chat' && config?.state === 'active' && (
        <p className="m-0 shrink-0 border-t border-line bg-panel py-1.5 text-center text-[11px] text-muted">{t('powered')}</p>
      )}

      {state.warning && !ended && <InactivityDialog disconnectAt={state.warning.disconnectAt} onAcknowledge={() => void controller.acknowledgeWarning()} />}
      {confirmEnd && (
        <EndChatDialog
          onCancel={() => setConfirmEnd(false)}
          onConfirm={() => {
            setConfirmEnd(false)
            void controller.endChat()
          }}
        />
      )}
      {ended && state.feedback !== 'none' && (
        <FeedbackDialog
          sent={state.feedback === 'sent'}
          onSend={(rating, comment) => controller.sendFeedback(rating, comment)}
          onSkip={() => controller.reset()}
        />
      )}
    </section>
  )

  const rootClass = cn(isDarkTheme(theme) && 'dark')

  if (page) {
    return (
      <div className={rootClass} style={themeStyle(theme)}>
        {card}
      </div>
    )
  }

  const positioned = mode === 'floating' ? 'fixed' : 'absolute'
  const hop = !state.hopped

  return (
    <div
      className={cn(
        positioned,
        'pointer-events-none bottom-4 z-40 flex flex-col gap-3',
        mode === 'contained' && 'top-10 justify-end',
        side === 'right' ? 'right-4 items-end' : 'left-4 items-start',
        rootClass,
      )}
      style={themeStyle(theme)}
    >
      {open && card}
      <button
        type="button"
        aria-label={open ? t('launcher.close') : t('launcher.open')}
        aria-expanded={open}
        onClick={() => controller.setOpen(!open)}
        onAnimationEnd={() => controller.markHopped()}
        style={hop ? { animationDelay: '700ms' } : undefined}
        className={cn(
          'pointer-events-auto relative grid size-14 shrink-0 place-items-center rounded-full transition-transform hover:scale-[1.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          hop && 'animate-hop',
        )}
      >
        {open ? (
          <span className="grid size-14 place-items-center rounded-full border-[1.5px] border-ink bg-primary text-on-primary">
            <ChevronDown size={24} strokeWidth={2} aria-hidden />
          </span>
        ) : (
          <ChitiLauncherMark size={56} />
        )}
        {!open && state.unread > 0 && (
          <span className="absolute -right-1 -top-1">
            <CountBubble count={state.unread} tone="danger" />
          </span>
        )}
      </button>
    </div>
  )
}
