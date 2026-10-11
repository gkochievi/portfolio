/**
 * /copilot - the chat harness. The visitor types as the customer; in Copilot
 * mode the operator sees the tier ladder and streamed drafts, in Autopilot the
 * bot answers from public documents only. OWNED BY: copilot.
 */
import { useQueryClient } from '@tanstack/react-query'
import { Bot, Headset, MessageSquarePlus, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { errorMessage } from '@/api/client'
import { Button, Callout, Card, EmptyState, PageHeader, SegmentedControl, Select, Skeleton, toast } from '@/components/ui'
import { streamTurn } from '@/demo/handlers/copilot'
import { useAccount, useTenantId } from '@/lib/session'
import type { ChatConversation, Citation, ContentLang, RetrievalHit, Channel } from '@/types'
import { createConversation, fetchConversation, sendFeedback, sendTurn, useCopilotSync, useWorkspaces } from '../api'
import { AssistPanel, CitationDialog, type DraftState, type RunState } from '../components/AssistPanel'
import { Bubble, Composer, useSpeaker, type Msg } from '../components/ThreadParts'
import { startersFor } from '../copy'

const LOCALES: ContentLang[] = ['ka', 'en', 'ru']
const CHANNELS: Channel[] = ['web', 'instagram', 'messenger', 'whatsapp']

let seq = 0
const nextKey = (prefix: string) => `${prefix}-${++seq}`

export default function CopilotPage() {
  const { t, i18n } = useTranslation('copilot')
  const account = useAccount()
  const tenantId = useTenantId()
  const client = useQueryClient()
  const workspaces = useWorkspaces()
  useCopilotSync()

  const isOperator = account?.role === 'operator'
  const canManage = account?.role === 'owner' || isOperator

  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [mode, setMode] = useState<'copilot' | 'autopilot'>('copilot')
  const [locale, setLocale] = useState<ContentLang>(i18n.language === 'ka' ? 'ka' : 'en')
  const [channel, setChannel] = useState<Channel>('web')
  const [conv, setConv] = useState<ChatConversation | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [run, setRun] = useState<RunState | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [citation, setCitation] = useState<Citation | null>(null)
  const [hit, setHit] = useState<RetrievalHit | null>(null)
  const epoch = useRef(0)
  const threadEnd = useRef<HTMLDivElement | null>(null)

  const list = workspaces.data
  const workspace = useMemo(() => {
    if (!list || list.length === 0) return undefined
    return list.find((w) => w.id === workspaceId) ?? list.find((w) => w.id === tenantId) ?? list[0]
  }, [list, workspaceId, tenantId])

  const speaker = useSpeaker(locale)

  useEffect(() => () => void (epoch.current += 1), [])
  useEffect(() => {
    threadEnd.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [msgs, run?.drafts.length])

  /* Keep the chosen language inside what the workspace speaks. */
  useEffect(() => {
    if (workspace && !workspace.languages.includes(locale)) setLocale(workspace.languages[0] ?? 'en')
  }, [workspace, locale])

  const reset = useCallback(() => {
    epoch.current += 1
    setConv(null)
    setMsgs([])
    setRun(null)
    setInput('')
    setSending(false)
  }, [])

  const change = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value)
    reset()
  }

  const openCitation = (c: Citation) => {
    setHit(null)
    setCitation(c)
  }

  const send = async (override?: string) => {
    const text = (override ?? input).trim()
    if (!text || sending || !workspace) return
    const mine = epoch.current
    const alive = () => epoch.current === mine
    setSending(true)
    setInput('')
    try {
      let current = conv
      if (!current) {
        current = await createConversation({ client_id: workspace.id, channel, locale, mode })
        if (!alive()) return
        setConv(current)
      }
      setMsgs((m) => [...m, { key: nextKey('c'), role: 'customer', text, at: Date.now() }])
      const { turn_id, ticket } = await sendTurn(current.id, text)
      if (!alive()) return
      setRun({ turnId: turn_id, mode, phase: 'grounding', stages: {}, drafts: [] })
      const botKey = `bot-${turn_id}`

      for await (const event of streamTurn(ticket)) {
        if (!alive()) return
        switch (event.type) {
          case 'grounding':
            setRun((r) => r && { ...r, phase: 'tier1', grounding: event.grounding, stages: { ...r.stages, grounding: event.ms } })
            break
          case 'tier1':
            setRun((r) => r && { ...r, phase: 'drafts', tier1: event.passages, stages: { ...r.stages, tier1: event.ms } })
            break
          case 'suggestion':
            setRun((r) => {
              if (!r) return r
              const existing = r.drafts.find((d) => d.index === event.index)
              const drafts: DraftState[] = existing
                ? r.drafts.map((d) => (d.index === event.index ? { ...d, text: d.text + event.delta } : d))
                : [...r.drafts, { index: event.index, kind: event.kind, text: event.delta, citations: [], status: 'streaming' }]
              return { ...r, drafts }
            })
            break
          case 'reply':
            setMsgs((m) =>
              m.some((x) => x.key === botKey)
                ? m.map((x) => (x.key === botKey ? { ...x, text: x.text + event.delta } : x))
                : [...m, { key: botKey, role: 'bot', text: event.delta, streaming: true, at: Date.now() }],
            )
            break
          case 'handoff':
            setRun((r) => r && { ...r, handoff: event.handoff })
            break
          case 'done': {
            const env = event.envelope
            const stages = Object.fromEntries(env.stages.map((s) => [s.name, s.ms]))
            setRun((r) =>
              r && {
                ...r,
                phase: 'done',
                envelope: env,
                stages: { ...r.stages, ...stages },
                handoff: env.handoff ?? r.handoff,
                drafts: env.suggestions.map((s) => ({ index: s.index, kind: s.kind, text: s.text, citations: s.citations, status: 'idle' as const })),
              },
            )
            const replyKind = env.reply?.kind
            if (env.reply && replyKind && replyKind !== 'blocked') {
              const replyText = env.reply.text
              setMsgs((m) => {
                const done: Msg = { key: botKey, role: 'bot', text: replyText, kind: replyKind, citations: env.citations, at: Date.now() }
                return m.some((x) => x.key === botKey) ? m.map((x) => (x.key === botKey ? done : x)) : [...m, done]
              })
            }
            break
          }
        }
      }
      if (alive()) {
        const view = await fetchConversation(current.id)
        if (alive()) setConv(view.conversation)
        void client.invalidateQueries({ queryKey: ['usage'] })
      }
    } catch (error) {
      if (!alive()) return
      const message = errorMessage(error, t('panel.error'))
      setRun((r) => (r ? { ...r, phase: 'error', error: message } : r))
      toast.error(message)
    } finally {
      if (alive()) setSending(false)
    }
  }

  const act = async (draft: DraftState, action: 'inserted' | 'edited' | 'ignored', finalText?: string) => {
    if (!run) return
    const mine = epoch.current
    const setStatus = (status: DraftState['status']) => setRun((r) => r && { ...r, drafts: r.drafts.map((d) => (d.index === draft.index ? { ...d, status } : d)) })
    setStatus('busy')
    try {
      const result = await sendFeedback({ turn_id: run.turnId, suggestion_index: draft.index, action, final_text: finalText ?? null })
      if (epoch.current !== mine) return
      setStatus(action)
      if (result.turn) {
        const turn = result.turn
        setMsgs((m) => [...m, { key: turn.id, role: 'operator', text: turn.content, citations: turn.citations, at: Date.now() }])
      }
      toast.success(t(`drafts.toast.${action}`))
    } catch (error) {
      if (epoch.current !== mine) return
      setStatus('idle')
      toast.error(errorMessage(error, t('drafts.error')))
    }
  }

  /* ------------------------------------------------------------- render */

  const header = (
    <PageHeader
      title={t('title')}
      description={t('description')}
      actions={
        <Button variant="secondary" icon={<MessageSquarePlus className="size-4" />} onClick={reset} disabled={!conv && msgs.length === 0}>
          {t('controls.newConversation')}
        </Button>
      }
    />
  )

  if (workspaces.isLoading) {
    return (
      <>
        {header}
        <Skeleton className="h-24 w-full" />
        <Skeleton className="mt-5 h-96 w-full" />
      </>
    )
  }
  if (workspaces.isError || !workspace) {
    return (
      <>
        {header}
        {workspaces.isError ? (
          <Callout tone="danger" title={t('loadError')} action={<Button size="sm" onClick={() => void workspaces.refetch()}>{t('retry')}</Button>}>
            {errorMessage(workspaces.error, t('loadError'))}
          </Callout>
        ) : (
          <EmptyState title={t('noWorkspaces.title')} body={t('noWorkspaces.body')} />
        )}
      </>
    )
  }

  const starters = startersFor(workspace.industry, locale)
  const ended = conv?.state === 'resolved'
  const blocked = mode === 'autopilot' ? workspace.blocked : null
  const wsName = (w: { name: string; name_ka: string }) => (i18n.language === 'ka' ? w.name_ka : w.name)
  const offTopic = conv?.off_topic_count ?? 0
  const disclosureLine = mode === 'autopilot' && workspace.disclosure_mode !== 'off' ? t(`disclosure.${workspace.disclosure_mode}`) : null
  const greeting = mode === 'autopilot' ? workspace.greeting[locale] : ''

  return (
    <>
      {header}

      <Card className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.3fr)_auto_auto_minmax(0,0.8fr)] xl:items-end">
        <div>
          <div className="mb-1.5 text-[13px] font-medium" id="cp-ws">{t('controls.workspace')}</div>
          <Select
            aria-labelledby="cp-ws"
            value={workspace.id}
            onValueChange={change(setWorkspaceId)}
            disabled={(list?.length ?? 0) < 2 || sending}
            options={(list ?? []).map((w) => ({ value: w.id, label: wsName(w), hint: t(`industry.${w.industry}`) }))}
          />
        </div>
        <div>
          <div className="mb-1.5 text-[13px] font-medium" id="cp-mode">{t('controls.mode')}</div>
          <SegmentedControl
            aria-label={t('controls.mode')}
            value={mode}
            onValueChange={change(setMode)}
            options={[
              { value: 'copilot', label: t('controls.copilot'), icon: <Headset className="size-4" />, disabled: sending },
              { value: 'autopilot', label: t('controls.autopilot'), icon: <Bot className="size-4" />, disabled: sending },
            ]}
          />
        </div>
        <div>
          <div className="mb-1.5 text-[13px] font-medium">{t('controls.language')}</div>
          <SegmentedControl
            aria-label={t('controls.language')}
            value={locale}
            onValueChange={change(setLocale)}
            options={LOCALES.map((l) => ({ value: l, label: t(`lang.${l}Short`), disabled: sending || !workspace.languages.includes(l) }))}
          />
        </div>
        <div>
          <div className="mb-1.5 text-[13px] font-medium" id="cp-ch">{t('controls.channel')}</div>
          <Select
            aria-labelledby="cp-ch"
            value={channel}
            onValueChange={change((v: string) => setChannel(v as Channel))}
            disabled={sending}
            options={CHANNELS.map((c) => ({ value: c, label: c === 'web' ? t('channels.webChat') : t(`channels.${c}`) }))}
          />
        </div>
        <p className="text-[13px] text-muted sm:col-span-2 xl:col-span-4">{mode === 'copilot' ? t('controls.copilotHint') : t('controls.autopilotHint')}</p>
      </Card>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card padded={false} className="flex min-h-[520px] flex-col overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <Sparkles className="size-4 text-accent" aria-hidden />
            <h2 className="min-w-0 flex-1 truncate font-sans text-[15px] font-semibold">{conv?.subject || t('thread.title')}</h2>
            {conv ? <span className="font-mono text-xs text-subtle">{conv.external_ref}</span> : null}
          </div>

          <div className="scrollbar-thin max-h-[58vh] min-h-[280px] flex-1 overflow-y-auto px-4 py-4" role="log" aria-live="polite" aria-label={t('thread.title')}>
            {msgs.length === 0 && !greeting ? (
              <EmptyState compact title={t('thread.emptyTitle')} body={mode === 'copilot' ? t('thread.emptyCopilot') : t('thread.emptyAutopilot')} />
            ) : (
              <ul className="space-y-4">
                {greeting && msgs.length === 0 ? (
                  <Bubble msg={{ key: 'greeting', role: 'bot', text: greeting, at: 0 }} onCitation={openCitation} speaker={speaker} />
                ) : null}
                {msgs.map((m) => (
                  <Bubble key={m.key} msg={m} onCitation={openCitation} speaker={speaker} />
                ))}
              </ul>
            )}
            <div ref={threadEnd} />
          </div>

          {conv && mode === 'autopilot' && (offTopic > 0 || conv.state !== 'open') ? (
            <div className="space-y-2 border-t border-line px-4 py-2.5 text-[13px]">
              {offTopic > 0 ? (
                <p className="text-muted">
                  {t('thread.offTopic', { count: offTopic, warn: workspace.off_topic_warn_after, cutoff: workspace.off_topic_cutoff_after })}
                </p>
              ) : null}
              {conv.state === 'handoff' ? <p className="text-warning">{t('thread.handoffState')}</p> : null}
              {ended ? <p className="font-medium text-danger">{t('thread.ended')}</p> : null}
            </div>
          ) : null}

          <div className="border-t border-line px-4 py-3">
            <div className="caps mb-2 text-[10.5px] font-semibold text-subtle">{t('starters.title')}</div>
            <div className="flex flex-wrap gap-2">
              {starters.map((s) => (
                <button
                  key={s.text}
                  type="button"
                  disabled={sending || ended}
                  onClick={() => void send(s.text)}
                  title={s.expect === 'answer' ? undefined : t(`starters.${s.expect}Hint`)}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-pill border border-line bg-panel px-3 py-1.5 text-left text-[13px] hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50"
                >
                  <span className="min-w-0 [overflow-wrap:anywhere]">{s.text}</span>
                  {s.expect !== 'answer' ? (
                    <span className={s.expect === 'refuse' ? 'shrink-0 rounded-[4px] bg-danger/12 px-1.5 text-[10.5px] font-semibold text-danger' : 'shrink-0 rounded-[4px] bg-warning/15 px-1.5 text-[10.5px] font-semibold text-warning'}>
                      {t(`starters.${s.expect}`)}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>

          <Composer
            value={input}
            onChange={setInput}
            onSend={() => void send()}
            sending={sending}
            disabled={ended}
            clientId={workspace.id}
            locale={locale}
            placeholder={mode === 'copilot' ? t('composer.placeholderCopilot') : t('composer.placeholderAutopilot')}
            note={disclosureLine ? <p className="mb-2 text-xs text-subtle">{disclosureLine}</p> : null}
          />
        </Card>

        <div className="lg:sticky lg:top-4">
          <AssistPanel
            run={run}
            mode={mode}
            blocked={blocked}
            onCitation={openCitation}
            onHit={(h) => {
              setCitation(null)
              setHit(h)
            }}
            onAct={(draft, action, text) => void act(draft, action, text)}
            canManage={canManage}
            isOperator={isOperator}
          />
        </div>
      </div>

      <CitationDialog
        citation={citation}
        hit={hit}
        onClose={() => {
          setCitation(null)
          setHit(null)
        }}
        canOpenKb
      />
    </>
  )
}
