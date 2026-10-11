/**
 * Agent workspace (`/agent`, operator only): status + lead on the left, the
 * call stage in the centre, forced dispositions + today's calls on the right,
 * and the carbon dial bar. Hotkeys: M mute, H hold, E hang up, 1-9 pick a
 * disposition, Enter submit (ignored while typing).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { TopBarPortal } from '@/app/TopBarPortal'
import { useMe } from '@/app/controls'
import { Alert, Button, Dialog } from '@/components/ui'
import { bus } from '@/demo/bus'
import { errorMessage, fieldErrors, isApiError } from '@/lib/api'
import { toDateTimeInput } from '@/lib/format'
import { useLocalized } from '@/lib/localized'
import { toast, toastError } from '@/lib/toast'
import type { OperatorCall } from '@/types'
import {
  useCallAction,
  useDispose,
  useDispositions,
  useHold,
  useMyCall,
  useMyCalls,
  useMyCampaigns,
  useMyKpis,
  useMyState,
  useNextLead,
  useStatuses,
  useTransfer,
} from '../api'
import { IdleStage, InCallStage, IncomingBanner, ProgressStage } from '../components/CenterZone'
import { DialBar } from '../components/DialBar'
import { KpiCard, LeadCard, SoftphoneChip, StatusCard } from '../components/LeftZone'
import { DispositionPanel, TodayCalls, type DispositionDraft } from '../components/RightZone'
import { isTypingTarget, useMediaQuery } from '../components/shared'
import { AgentStateMenu, CampaignSwitcher } from '../components/TopBarControls'

/** API messages we know, shown in the visitor's language. */
const KNOWN_ERRORS: Record<string, string> = {
  'Please select a campaign first': 'errors.selectCampaign',
  'No more numbers available in this campaign': 'errors.noNumbers',
  'Set your status to Available to take calls': 'errors.notWorking',
  'Submit the disposition for the last call first': 'errors.dispositionFirst',
  'This campaign is not active': 'errors.campaignInactive',
  'You are not assigned to this campaign': 'errors.notAssigned',
  'You are already on a call': 'errors.alreadyOnCall',
  'Choose a disposition': 'disposition.choose',
  'Choose a callback date and time': 'disposition.callbackRequired',
  'The callback time cannot be in the past': 'disposition.callbackPast',
  'Enter an extension (3-6 digits)': 'dialbar.extensionInvalid',
}

function defaultCallback(): string {
  const at = new Date(Date.now() + 60 * 60 * 1000)
  at.setMinutes(Math.ceil(at.getMinutes() / 15) * 15, 0, 0)
  return toDateTimeInput(at)
}

const emptyDraft = (): DispositionDraft => ({ code: null, callbackAt: defaultCallback(), notes: '' })

export default function AgentWorkspacePage() {
  const { t } = useTranslation('agent')
  const l = useLocalized()
  const me = useMe()
  const userId = me.user?.id

  const state = useMyState()
  const campaigns = useMyCampaigns()
  const kpis = useMyKpis()
  const todayCalls = useMyCalls()
  const statuses = useStatuses()
  const dispositions = useDispositions()
  const callQuery = useMyCall(userId)
  const call = callQuery.data ?? null

  const next = useNextLead()
  const action = useCallAction()
  const hold = useHold()
  const transfer = useTransfer()
  const dispose = useDispose()

  const wide = useMediaQuery('(min-width: 1280px)')
  const [muted, setMuted] = useState(false)
  const [draft, setDraft] = useState<DispositionDraft>(emptyDraft)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [nextError, setNextError] = useState<string | null>(null)
  const [lastCall, setLastCall] = useState<OperatorCall | null>(null)

  const say = useCallback(
    (error: unknown) => {
      const message = errorMessage(error)
      const key = KNOWN_ERRORS[message]
      return key ? t(key) : message
    },
    [t],
  )

  // A new call (or none) starts a fresh draft.
  const callId = call?.callId ?? null
  useEffect(() => {
    setDraft(emptyDraft())
    setErrors({})
    setMuted(false)
    if (callId) setNextError(null)
  }, [callId])

  useEffect(() => {
    if (call) setLastCall(call)
  }, [call])

  useEffect(() => bus.on('demo:reset', () => setLastCall(null)), [])

  // NO_ANSWER / BUSY come preselected.
  const suggested = call?.awaitingDisposition ? call.suggestedDisposition : null
  useEffect(() => {
    if (suggested) setDraft((d) => (d.code ? d : { ...d, code: suggested }))
  }, [suggested])

  // Toasts for things the engine does on its own.
  useEffect(() => {
    if (!userId) return
    const seen = new Map<string, string>()
    return bus.on('operator:call', ({ agentId, call: next }) => {
      if (agentId !== userId || !next) return
      const key = `${next.phase}:${next.endReason ?? ''}`
      if (seen.get(next.callId) === key) return
      seen.set(next.callId, key)
      if (next.phase !== 'ended') return
      if (next.endReason === 'NO_ANSWER') toast.warning(t('toast.noAnswer'))
      else if (next.endReason === 'BUSY') toast.warning(t('toast.busy'))
      else if (next.endReason === 'CUSTOMER') toast.info(t('toast.customerHungUp'))
      else if (next.endReason === 'REJECTED') toast.info(t('toast.missed'))
    })
  }, [userId, t])

  const campaignList = campaigns.data
  const focusId = call?.campaignId ?? state.data?.campaign?.id
  const campaign = campaignList?.find((c) => c.id === focusId)
  const leadCall = call ?? lastCall
  const leadCampaign = campaignList?.find((c) => c.id === leadCall?.campaignId)
  const connected = call?.phase === 'answered'
  const ringing = !!call && ['requesting', 'dialing', 'ringing'].includes(call.phase)
  const awaiting = !!call?.awaitingDisposition

  /* ----------------------------------------------------------- actions */

  const onNext = () => {
    setNextError(null)
    next.mutate(state.data?.campaign?.id ?? null, { onError: (error) => setNextError(say(error)) })
  }
  const runAction = (kind: 'answer' | 'reject' | 'hangup') => {
    if (!call) return
    action.mutate(
      { callId: call.callId, action: kind },
      {
        onSuccess: () => {
          if (kind === 'reject') toast.info(t('toast.rejected'))
        },
        onError: (error) => toast.error(say(error)),
      },
    )
  }
  const onHangup = () => {
    if (!call) return
    if (call.phase === 'incoming') runAction('reject')
    else if (connected || ringing) runAction('hangup')
  }
  const onHold = () => {
    if (!call || !connected) return
    hold.mutate({ callId: call.callId, onHold: !call.onHold }, { onError: (error) => toast.error(say(error)) })
  }
  const onMute = () => {
    if (!connected) return
    setMuted((m) => {
      toast.message(m ? t('toast.unmuted') : t('toast.muted'))
      return !m
    })
  }
  const onTransfer = async (extension: string): Promise<boolean> => {
    if (!call) return false
    try {
      await transfer.mutateAsync({ callId: call.callId, extension })
      toast.success(t('dialbar.transferred', { ext: extension }))
      return true
    } catch (error) {
      toast.error(say(error))
      return false
    }
  }
  const onSubmit = () => {
    if (!call || !call.awaitingDisposition || dispose.isPending) return
    const chosen = dispositions.data?.find((d) => d.code === draft.code)
    const local: Record<string, string> = {}
    if (!chosen) local.code = t('disposition.choose')
    let callbackAt: string | null = null
    if (chosen?.scheduleCallback) {
      const at = draft.callbackAt ? new Date(draft.callbackAt).getTime() : Number.NaN
      if (!Number.isFinite(at)) local.callbackAt = t('disposition.callbackRequired')
      else if (at < Date.now() - 60_000) local.callbackAt = t('disposition.callbackPast')
      else callbackAt = new Date(at).toISOString()
    }
    setErrors(local)
    if (!chosen || Object.keys(local).length > 0) return
    dispose.mutate(
      { callId: call.callId, code: chosen.code, note: draft.notes.trim() || undefined, callbackAt },
      {
        onSuccess: () => toast.success(t('disposition.submitted', { name: l(chosen.name) })),
        onError: (error) => {
          const fields = fieldErrors(error)
          if (Object.keys(fields).length > 0) {
            setErrors(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, KNOWN_ERRORS[v] ? t(KNOWN_ERRORS[v]) : v])))
          } else if (isApiError(error)) toast.error(say(error))
          else toastError(error)
        },
      },
    )
  }

  /* ----------------------------------------------------------- hotkeys */

  const keys = useRef({ onMute, onHold, onHangup, onSubmit, call, awaiting, dispositions: dispositions.data, draftCode: draft.code })
  keys.current = { onMute, onHold, onHangup, onSubmit, call, awaiting, dispositions: dispositions.data, draftCode: draft.code }
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.repeat) return
      if (isTypingTarget(event.target)) return
      const k = keys.current
      const key = event.key.toLowerCase()
      if (key === 'm') k.onMute()
      else if (key === 'h') k.onHold()
      else if (key === 'e') k.onHangup()
      else if (/^[1-9]$/.test(key)) {
        if (!k.call || k.call.phase === 'incoming') return
        const disposition = k.dispositions?.find((d) => d.isActive && d.sortOrder === Number(key))
        if (disposition) setDraft((d) => ({ ...d, code: disposition.code }))
      } else if (key === 'enter') {
        const target = event.target as HTMLElement | null
        if (target && target.closest('button, a, [role="button"]')) return
        if (k.awaiting && k.draftCode) {
          event.preventDefault()
          k.onSubmit()
        }
      } else return
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /* ------------------------------------------------------------ render */

  const name = me.name || l(state.data?.agent.displayName)
  const patchDraft = (patch: Partial<DispositionDraft>) => {
    setDraft((d) => ({ ...d, ...patch }))
    if (patch.code !== undefined || patch.callbackAt !== undefined) setErrors({})
  }
  const dispositionPanel = (bare: boolean) => (
    <DispositionPanel
      dispositions={dispositions.data}
      recentCodes={kpis.data?.recentDispositionCodes ?? []}
      call={call}
      draft={draft}
      onDraft={patchDraft}
      onSubmit={onSubmit}
      submitting={dispose.isPending}
      errors={errors}
      bare={bare}
    />
  )

  let stage
  if (state.isError) {
    stage = (
      <Alert tone="danger" title={t('errors.loadTitle')} action={<Button size="sm" onClick={() => void state.refetch()}>{t('common:actions.retry')}</Button>}>
        {say(state.error)}
      </Alert>
    )
  } else if (!call) {
    stage = <IdleStage campaign={campaign} error={nextError} pending={next.isPending} onNext={onNext} />
  } else if (call.phase === 'incoming') {
    stage = (
      <IncomingBanner
        key={call.callId}
        call={call}
        campaign={campaign}
        busy={action.isPending}
        onAnswer={() => runAction('answer')}
        onReject={() => runAction('reject')}
      />
    )
  } else if (ringing) {
    stage = <ProgressStage call={call} cancelling={action.isPending} onCancel={() => runAction('hangup')} />
  } else {
    stage = <InCallStage call={call} campaign={campaign} notes={draft.notes} onNotes={(notes) => patchDraft({ notes })} muted={muted} />
  }

  return (
    <div className="-mb-24 flex min-h-[calc(100dvh-56px)] flex-col">
      <TopBarPortal>
        <div className="flex min-w-0 items-center gap-2">
          <CampaignSwitcher campaigns={campaignList} state={state.data} locked={!!call} />
          <AgentStateMenu state={state.data} statuses={statuses.data} locked={!!call} />
        </div>
      </TopBarPortal>
      <h1 className="sr-only">{t('pages.AgentWorkspacePage')}</h1>

      <div className="grid flex-1 content-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_340px]">
        <div className="order-2 grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-4 lg:order-1">
          <StatusCard state={state.data} name={name} />
          <SoftphoneChip extension={state.data?.agent.sipExtension ?? me.user?.sipExtension ?? null} />
          <KpiCard kpis={kpis.data} />
          <LeadCard call={leadCall} live={!!call} campaign={leadCampaign} />
        </div>

        <div className="order-1 grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-4 lg:order-2">
          {stage}
        </div>

        <div className="order-3 grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-4 lg:col-span-2 xl:col-span-1">
          {(wide || !awaiting) && dispositionPanel(false)}
          <TodayCalls calls={todayCalls.data} loading={todayCalls.isLoading} />
        </div>
      </div>

      {!wide && (
        <Dialog
          open={awaiting}
          onOpenChange={() => {}}
          hideClose
          size="md"
          title={t('disposition.modalTitle')}
          description={call ? t(`endReason.${call.endReason ?? 'AGENT'}`) : undefined}
        >
          {dispositionPanel(true)}
        </Dialog>
      )}

      <DialBar
        call={call}
        state={state.data}
        muted={muted}
        onMute={onMute}
        onHold={onHold}
        onHangup={onHangup}
        onTransfer={onTransfer}
        transferPending={transfer.isPending}
      />
    </div>
  )
}
