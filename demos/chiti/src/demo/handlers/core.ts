/** Core endpoints (data-core): operator presence, tenant settings, demo controls. */
import { DemoApiError } from '@portfolio/demo-kit'

import type { DemoControls } from '@/types'

import { api } from '../api'
import { currentOperator, currentTenantId, requireRole, tenantSettings } from '../context'
import { setOperatorStatus, updateDemoControls } from '../engine'
import { store } from '../store'

api.register('PATCH', '/operator/status', ({ body }) => {
  const operator = currentOperator()
  const status = (body as { status?: string } | null)?.status
  if (status !== 'online' && status !== 'away') throw DemoApiError.validation({ status: 'Status must be online or away.' })
  return setOperatorStatus(operator.id, status, 'self')
})

api.register('GET', '/tenant/settings', () => {
  requireRole('operator', 'admin', 'supervisor')
  const tenantId = currentTenantId()
  return {
    settings: tenantSettings(tenantId),
    customFields: store.data.customFields
      .filter((field) => field.tenantId === tenantId && field.enabled)
      .sort((left, right) => left.sortOrder - right.sortOrder),
  }
})

api.register('GET', '/demo/controls', () => store.data.demo)

const RESULTS: DemoControls['tiktokConnectResult'][] = ['connected', 'needs_reauth', 'blocked']

/**
 * Partial DemoControls. Convenience: `{ aiOutageSeconds: 45 }` opens the AI
 * circuit for that long (0 closes it).
 */
api.register('PATCH', '/demo/controls', ({ body }) => {
  const input = (body ?? {}) as Partial<DemoControls> & { aiOutageSeconds?: number }
  const patch: Partial<DemoControls> = {}
  if (typeof input.fastInactivity === 'boolean') patch.fastInactivity = input.fastInactivity
  if (typeof input.operatorDriving === 'boolean') patch.operatorDriving = input.operatorDriving
  if (typeof input.spawnerEnabled === 'boolean') patch.spawnerEnabled = input.spawnerEnabled
  if (typeof input.simulatedIp === 'string') {
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(input.simulatedIp)) throw DemoApiError.validation({ simulatedIp: 'Enter an IPv4 address.' })
    patch.simulatedIp = input.simulatedIp
  }
  if (input.tiktokConnectResult !== undefined) {
    if (!RESULTS.includes(input.tiktokConnectResult)) throw DemoApiError.validation({ tiktokConnectResult: 'Unknown result.' })
    patch.tiktokConnectResult = input.tiktokConnectResult
  }
  if (input.aiOutageUntil !== undefined) patch.aiOutageUntil = input.aiOutageUntil
  if (typeof input.aiOutageSeconds === 'number') {
    patch.aiOutageUntil = input.aiOutageSeconds > 0 ? new Date(Date.now() + input.aiOutageSeconds * 1000).toISOString() : null
  }
  return updateDemoControls(patch)
})
