/**
 * Side-effect entry point: importing this once registers every demo route.
 *
 * The handler modules call `register()` at module scope, so they must be
 * imported exactly once and nothing may import them lazily — `lib/api.ts`
 * pulls this in before its first `dispatch()`.
 */
import './auth'
import './fleet'
import './records'
