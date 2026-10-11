/**
 * Mock backend entry (owner: data-core). Boots seed → store → session → API →
 * mirror, registers every handler, and runs the simulators in the leader tab.
 * `store.reset()` (DemoBar) restores the seed, the accounts, emits
 * 'demo:reset', tells other tabs and restarts the simulators.
 */
import { api } from './api'
import { broadcast, bus, emitLocal } from './bus'
import { isApplyingRemote, isLeader, onLeadershipChange, postReset, startMirror } from './mirror'
import { accounts, headlineAccounts, resetAccounts, roleHome, session } from './session'
import { resetDemo, store } from './store'
import './handlers'

interface SimulatorModule {
  start?: () => () => void
}

const simulatorModules = import.meta.glob<SimulatorModule>('./simulators/*.ts', { eager: true })
let stops: (() => void)[] = []

function stopSimulators(): void {
  for (const stop of stops) {
    try {
      stop()
    } catch (error) {
      console.error('[chiti] simulator stop failed', error)
    }
  }
  stops = []
}

function startSimulators(): void {
  stopSimulators()
  if (!isLeader()) return
  for (const [path, module] of Object.entries(simulatorModules)) {
    if (typeof module.start !== 'function') continue
    try {
      stops.push(module.start())
    } catch (error) {
      console.error(`[chiti] simulator ${path} failed to start`, error)
    }
  }
}

let currentData = store.data
store.subscribe(() => {
  if (store.data === currentData) return // a plain notify(), not a reset
  currentData = store.data
  resetAccounts()
  emitLocal('demo:reset', undefined)
  if (!isApplyingRemote()) postReset()
  startSimulators()
})

const stopMirror = startMirror()
const offLeadership = onLeadershipChange(() => startSimulators())
startSimulators()

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    stopSimulators()
    offLeadership()
    stopMirror()
  })
}

export { accounts, api, broadcast, bus, headlineAccounts, resetDemo, roleHome, session, store }
