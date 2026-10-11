/** Registers every group's handlers. */
import type { MockApi } from '@portfolio/demo-kit'

import { register as auth } from './auth'
import { register as agentWorkspace } from './agent-workspace'
import { register as supervisorWall } from './supervisor-wall'
import { register as reports } from './reports'
import { register as campaigns } from './campaigns'
import { register as adminUsers } from './admin-users'
import { register as adminConfig } from './admin-config'

export function registerAllHandlers(api: MockApi): void {
  for (const register of [auth, agentWorkspace, supervisorWall, reports, campaigns, adminUsers, adminConfig]) register(api)
}
