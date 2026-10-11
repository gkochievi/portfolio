/** Registers every group's routes on the one mock API. Owner: architect (append-only). */
import { api } from '../api'
import { registerAuth } from './auth'
import { registerCore } from './core'
import { registerEventContent } from './event-content'
import { registerEvents } from './events'
import { registerInsights } from './insights'
import { registerPeople } from './people'
import { registerPlay } from './play'
import { registerPlayerHub } from './player-hub'
import { registerStandings } from './standings'

registerCore(api)
registerAuth(api)
registerPlay(api)
registerPlayerHub(api)
registerStandings(api)
registerEvents(api)
registerEventContent(api)
registerPeople(api)
registerInsights(api)
