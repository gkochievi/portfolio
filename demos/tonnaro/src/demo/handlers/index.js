/**
 * Side-effect entry point: importing this once registers every demo route.
 *
 * The handler modules call `register()` at module scope, so they have to be
 * imported exactly once and never lazily — `api/client.js` pulls this in before
 * its first `dispatch()`, and `demo/index.js` again before the first render.
 * Import order is irrelevant: the router resolves by pattern, not by
 * registration sequence.
 */
import './auth'
import './orders'
import './catalog'
import './pricing'
import './analytics'
import './site'
