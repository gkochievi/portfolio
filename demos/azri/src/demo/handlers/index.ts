/**
 * Registers every handler module with the mock API. Import order is
 * registration order. Each feature group fills its own module; this file
 * only wires them in.
 *
 * Owner: seed agent.
 */
import './meta'
import './auth'
import './survey'
import './launcher'
import './insights'
import './campaigns'
import './staff'
