/**
 * The few row → payload helpers that more than one handler module needs.
 *
 * Nearly all serialisation belongs next to the endpoint that uses it — a
 * serializer read apart from its view is a serializer that drifts — so what
 * lands here is only what two modules would otherwise have written twice: the
 * body-reading Django got from its request parsers, the one label table that
 * three unrelated payloads embed, and the trick that makes an uploaded file
 * visible in a demo with no storage backend.
 */
import { mediaUrl } from './base'
import { trackObjectUrl } from './store'

/* ------------------------------------------------------------------ bodies */

function isFormData(body) {
  return typeof FormData !== 'undefined' && body instanceof FormData
}

/**
 * The request body as a plain object, however it arrived.
 *
 * Django read multipart through a `QueryDict`, where `data[key]` is the *last*
 * value posted under a name and repeated names are only reachable through
 * `getlist()` — which is what `readFiles()` is for. A JSON body already has the
 * right shape and passes through untouched, so a handler can treat the two the
 * same everywhere except where the endpoint genuinely cares.
 */
export function readBody(body) {
  if (!body) return {}
  if (isFormData(body)) {
    const out = {}
    for (const [key, value] of body.entries()) out[key] = value
    return out
  }
  return typeof body === 'object' ? body : {}
}

/**
 * Whether the caller sent the key at all — which is a different question from
 * what it holds. A DRF `PATCH` only writes the fields present in
 * `initial_data`, and three conventions in this app hang off exactly that:
 * `image=''` clears a photo while omitting `image` leaves it alone, omitting
 * `restricted_time_windows` leaves the windows alone, and naming a read-only
 * field at all is a 400 rather than a silent no-op.
 */
export function hasField(body, name) {
  if (!body) return false
  if (isFormData(body)) return body.has(name)
  return typeof body === 'object' && Object.prototype.hasOwnProperty.call(body, name)
}

/** `request.FILES.getlist(name)` — the several files posted under one name. */
export function readFiles(body, name) {
  if (!isFormData(body)) return []
  return body.getAll(name).filter((value) => isUpload(value))
}

export function isUpload(value) {
  return typeof Blob !== 'undefined' && value instanceof Blob
}

/**
 * An uploaded file, in the field the seed keeps a media path in.
 *
 * There is no storage to write to, so the row holds an object URL instead and
 * `base.js:mediaUrl()` passes it through untouched. That is what makes a photo
 * actually appear in the gallery a moment after it is picked, rather than
 * resolving to a URL the demo could never serve. `store.js` owns the registry
 * so a reset can revoke them all.
 */
export function storeUpload(file) {
  return trackObjectUrl(URL.createObjectURL(file))
}

/** Media on a payload: an absolute URL, or null when the column is empty. */
export function mediaField(path) {
  return mediaUrl(path) ?? null
}

/* ------------------------------------------------------------------ labels */

/**
 * `Order.get_status_display()`. It lives here because three payloads outside
 * the orders module embed it — a vehicle's active jobs, a driver's, and a car
 * owner's recent work — and the admin's StatusBadge renders whatever it is
 * handed.
 */
const ORDER_STATUS_LABELS = {
  new: 'New',
  under_review: 'Under Review',
  offer_sent: 'Offer Sent',
  approved: 'Approved',
  rejected: 'Rejected',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export function orderStatusDisplay(status) {
  return ORDER_STATUS_LABELS[status] ?? status
}

/* ================================================================== inbound
 *
 * The other direction: what a request has to be put through before a handler
 * may write it. Same rule as above — these are here because several modules
 * need the identical answer. `clean_i18n` and `require_list` were literally
 * one shared module upstream (`config/validators.py`), imported by the SEO,
 * site-settings, landing, category and service serializers alike; six private
 * copies here would drift apart within a week.
 */

/**
 * A field that travels as JSON text under `multipart/form-data`. The Python
 * this mirrors swallows a parse failure and leaves the raw string in place, so
 * that the field's own validator is what reports the shape error — which is
 * what keeps the message the admin sees identical to Django's.
 */
export function parseJsonField(value) {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

const I18N_LANGS = ['en', 'ka', 'ru']

/**
 * `config/validators.py:clean_i18n`. Returns an `{en, ka, ru}` dict of strings,
 * drops unknown language keys silently, maps null and '' to `{}`, and rejects
 * everything else.
 *
 * `error` builds the exception to throw, because two callers need different
 * bodies out of one rule: a DRF field validator produces `{field: ['message']}`
 * while the landing serializer raises from inside `validate()` with a bare
 * string value, and the admin forms render whichever they are handed. Passing
 * the constructor in keeps a single copy of the rule and lets each module keep
 * its own error shape.
 */
export function cleanI18n(value, error) {
  if (value === null || value === undefined || value === '') return {}
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw error('Must be a localized object like {"en":"...","ka":"...","ru":"..."}.')
  }
  const out = {}
  for (const [key, text] of Object.entries(value)) {
    if (!I18N_LANGS.includes(key)) continue
    if (typeof text !== 'string') throw error(`"${key}" must be text.`)
    out[key] = text
  }
  return out
}

/** `config/validators.py:require_list`. null and '' become `[]`; anything else
 *  that is not a list is an error. */
export function requireList(value, error) {
  if (value === null || value === undefined || value === '') return []
  if (!Array.isArray(value)) throw error('Must be a list.')
  return value
}
