/** Small helpers shared by the wall's panels. */
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { CircleDot, Coffee, GraduationCap, Headset, NotebookPen, PowerOff, RotateCw, Users, UtensilsCrossed } from 'lucide-react'

import { Alert, Button } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import type { AgentStatus } from '@/types'
import type { WallAgentView } from '../api'

/** A clock for UI timers (time-in-status, call duration, countdowns), computed from timestamps. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

export const ICON = { size: 18, strokeWidth: 1.75 } as const

export function statusIcon(status: AgentStatus): ReactNode {
  switch (status.name) {
    case 'available':
      return <Headset {...ICON} />
    case 'wrap_up':
      return <NotebookPen {...ICON} />
    case 'break':
      return <Coffee {...ICON} />
    case 'lunch':
      return <UtensilsCrossed {...ICON} />
    case 'meeting':
      return <Users {...ICON} />
    case 'training':
      return <GraduationCap {...ICON} />
    case 'offline':
      return <PowerOff {...ICON} />
    default:
      return <CircleDot {...ICON} />
  }
}

export function statusPattern(view: WallAgentView): 'solid' | 'hatch' | 'outline' | 'call' {
  if (view.currentCall || view.status.name === 'on_call') return 'call'
  if (view.status.type === 'offline') return 'outline'
  if (view.status.type === 'paused') return 'hatch'
  return 'solid'
}

export type StatusGroup = 'onCall' | 'working' | 'paused' | 'offline'

export function groupOf(view: WallAgentView): StatusGroup {
  if (view.currentCall) return 'onCall'
  if (view.status.type === 'working') return 'working'
  if (view.status.type === 'paused') return 'paused'
  return 'offline'
}

/** Inline error with a retry button for a failed panel query. */
export function QueryError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation('wall')
  return (
    <Alert
      tone="danger"
      title={t('errors.load')}
      action={
        <Button size="sm" variant="outline" icon={<RotateCw {...ICON} />} onClick={onRetry}>
          {t('common:actions.retry')}
        </Button>
      }
    >
      {errorMessage(error)}
    </Alert>
  )
}
