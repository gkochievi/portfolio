/**
 * Boot the in-browser backend.
 *
 * One side-effect import, pulled in by `src/index.js` before the first render.
 * Order matters: the two network stubs have to be in place before any
 * component can call out, and the route handlers have to be registered before
 * `api/client.js` dispatches its first request.
 *
 * Everything the demo adds lives under this directory. Nothing above
 * `api/client.js` imports from here, which is what keeps the 70 ported files
 * unaware that Django is gone.
 */
import { installGeocoder } from './nominatim'
import { installGeolocation } from './geolocation'
import './handlers'

installGeocoder()
installGeolocation()
