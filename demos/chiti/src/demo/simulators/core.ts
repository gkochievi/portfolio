/**
 * Core timers (data-core): inactivity warn/close for the visitor's own chats,
 * the auto-assignment tick, response timeout, logout grace and the stale
 * waiting sweep. Runs only in the leader tab (see ../index.ts).
 */
import { every } from '@portfolio/demo-kit'

import type { ChatSession, Message } from '@/types'

import { broadcast } from '../bus'
import { demoMinutes } from '../clock'
import { autoAssign, endSession, requeueSession } from '../engine'
import { store } from '../store'

const MINUTE = 60_000
const STALE_WAITING_MS = 120 * MINUTE

/** Fast inactivity uses the demo clock (warn 45 s / close 90 s); otherwise real minutes. */
function inactivityMs(minutes: number): number {
  return store.data.demo.fastInactivity ? demoMinutes(minutes) : minutes * MINUTE
}

function lastRealMessage(sessionId: string): Message | undefined {
  let last: Message | undefined
  for (const message of store.data.messages) {
    if (message.sessionId !== sessionId || message.isPreChat || message.isAutoGreeting) continue
    if (!last || Date.parse(message.timestamp) >= Date.parse(last.timestamp)) last = message
  }
  return last
}

function checkSession(session: ChatSession, now: number): void {
  const settings = store.data.settings.find((row) => row.tenantId === session.tenantId)
  if (!settings) return

  const idleTracked = session.origin === 'visitor'
    && (session.status === 'active' || session.status === 'inactive' || (session.status === 'waiting' && session.aiState === 'bot'))
  if (idleTracked) {
    const lastActivity = Date.parse(session.lastActivity)
    const closeMs = inactivityMs(settings.inactiveDisconnectMinutes)
    const idle = now - lastActivity
    if (idle >= closeMs) {
      endSession(session.id, 'system', 'inactivity')
      return
    }
    if (idle >= inactivityMs(settings.inactiveWarningMinutes) && !session.warningIssuedAt) {
      const issued = new Date(now).toISOString()
      session.warningIssuedAt = issued
      if (session.status === 'active') {
        session.status = 'inactive'
        session.inactiveSince = issued
      }
      broadcast('session:upsert', session)
      broadcast('inactivity:warning', { sessionId: session.id, disconnectAt: new Date(lastActivity + closeMs).toISOString() })
    }
  }

  if (settings.operatorResponseMinutes > 0 && session.status === 'active' && session.operatorId && !session.adminInterventionActive) {
    const last = lastRealMessage(session.id)
    if (last?.sender === 'user' && now - Date.parse(last.timestamp) >= demoMinutes(settings.operatorResponseMinutes)) {
      requeueSession(session.id, 'response_timeout', true)
      return
    }
  }

  if (session.status === 'waiting' && session.origin !== 'seed' && now - Date.parse(session.startedAt) > STALE_WAITING_MS) {
    endSession(session.id, 'system', 'stale_waiting')
  }
}

function tick(): void {
  const now = Date.now()
  for (const session of [...store.data.sessions]) {
    if (session.status === 'ended') continue
    try {
      checkSession(session, now)
    } catch (error) {
      console.error('[chiti] core simulator', error)
    }
  }
  for (const operator of store.data.operators) {
    if (operator.status !== 'offline') continue
    const settings = store.data.settings.find((row) => row.tenantId === operator.tenantId)
    if (!settings || settings.operatorLogoutGraceMinutes <= 0) continue
    if (now - Date.parse(operator.lastSeen) < demoMinutes(settings.operatorLogoutGraceMinutes)) continue
    const held = store.data.sessions.filter((row) => row.operatorId === operator.id && (row.status === 'active' || row.status === 'inactive'))
    for (const session of held) requeueSession(session.id, 'logout_grace', false)
  }
}

function assignTick(): void {
  for (const tenant of store.data.tenants) {
    if (tenant.disabled || tenant.deletedAt) continue
    try {
      autoAssign(tenant.id)
    } catch (error) {
      console.error('[chiti] auto-assign', error)
    }
  }
}

export function start(): () => void {
  const stopTick = every(1_000, tick)
  const stopAssign = every(5_000, assignTick)
  return () => {
    stopTick()
    stopAssign()
  }
}
