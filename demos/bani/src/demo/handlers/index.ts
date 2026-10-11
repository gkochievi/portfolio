/**
 * Every handler group in one place. `registerAllHandlers()` is called once by
 * `@/demo` (which `@/lib/api` imports), so all routes exist before the first
 * request. Each group's file owns its routes and simulators; a group that has
 * nothing to register yet exports an empty `register()`.
 */
import { register as registerAuth } from './auth'
import { register as registerCalls } from './calls'
import { register as registerArchive } from './archive'
import { register as registerAgents } from './agents'
import { register as registerCampaigns } from './campaigns'
import { register as registerExtensions } from './extensions'
import { register as registerHealth } from './health'
import { register as registerPeople } from './people'
import { register as registerAccess } from './access'

export const handlerGroups = [
  ['auth', registerAuth],
  ['calls', registerCalls],
  ['archive', registerArchive],
  ['agents', registerAgents],
  ['campaigns', registerCampaigns],
  ['extensions', registerExtensions],
  ['health', registerHealth],
  ['people', registerPeople],
  ['access', registerAccess],
] as const

let registered = false

export function registerAllHandlers(): void {
  if (registered) return
  registered = true
  for (const [, register] of handlerGroups) register()
}
