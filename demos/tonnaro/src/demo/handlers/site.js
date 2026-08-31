/**
 * The four singletons behind the public site: landing content, branding, terms
 * and SEO.
 *
 * Django had a row per table pinned at pk=1 and a `get_instance()` that could
 * not miss, so none of these endpoints has ever returned a 404 and none of the
 * pages that read them guards against one. `AdminLandingPage` in particular
 * sets `loading = false` in a `finally` and then reads `data.hero_title` — a
 * failed load there is a white screen, not an empty form. So every read below
 * is total.
 *
 * ## Why the writes matter more here than anywhere else
 *
 * Editing the landing page and watching `/` change is the single most
 * demonstrable thing in the product, and it works here for a slightly boring
 * reason worth stating: the public GET and the admin PUT are looking at the
 * *same object*. `store.landingSettings` is mutated in place, so the next
 * `GET /landing/` is the edit — there is no cache, no second copy and no
 * invalidation step to forget. The same is true of the branding payload, which
 * matters because `AdminSettingsPage.handleSave` saves and then immediately
 * calls `refreshBranding()`; if that follow-up read did not reflect the write,
 * the accent colour would visibly revert one frame after the success toast.
 *
 * ## Three shapes of 400
 *
 * The three admin forms in this slice do not agree on error handling, and the
 * mock has to speak all three dialects:
 *
 *   · `SeoFormSection` is the one place in the whole app that renders a server
 *     message — `Object.values(data).flat()[0]`, printed when it is a string.
 *     Every SEO validator below therefore produces a real DRF sentence rather
 *     than a placeholder, because those sentences are user-visible.
 *   · `LandingPageSerializer.validate()` raises with **string** values
 *     (`{'benefits': 'Item 0: "color" contains unsafe CSS value…'}`) where a
 *     DRF field validator would have produced an array. `landingError()` keeps
 *     that asymmetry rather than tidying it away.
 *   · `AdminSettingsPage` swallows the body entirely. Its validators still
 *     exist, because a mock that accepts a value Django rejected teaches the
 *     admin a workflow the real product does not have.
 *
 * One deliberate divergence: DRF collects every field's error into one body,
 * while these fail on the first. All three forms display a single message, so
 * the difference is invisible — but it is a difference.
 *
 * ## What is not here
 *
 * `/site-settings/admin/time-windows/` and `.../time-windows/<id>/`. CLAUDE.md
 * still documents them; the table behind them was deleted in
 * `site_settings/migrations/0011_delete_restrictedtimewindow_and_more.py` and
 * `site_settings/urls.py` has held exactly four routes ever since. Restricted
 * time windows are now per transport category, edited nested inside the
 * category form and read back through `/categories/` — they belong to the
 * catalogue module, not to this one.
 */
import { mediaUrl } from '../base'
import { DemoApiError, register } from '../router'
import {
  cleanI18n, isUpload, parseJsonField, readBody, requireList, storeUpload,
} from '../serialize'
import { releaseObjectUrl, store } from '../store'

/* ------------------------------------------------------------------ errors */

/**
 * A DRF field validator's 400: `{field: ['message']}`. What `clean_i18n`,
 * `require_list` and every declared field on `SiteSettingsSerializer` and
 * `SeoSettingsSerializer` produce.
 */
function fieldError(field) {
  return (message) => DemoApiError.validation({ [field]: message })
}

/**
 * The landing serializer's 400: `{field: 'message'}`, a bare string, because
 * it raises from inside `validate()` with a hand-built dict rather than
 * letting DRF wrap a field error. Nothing renders it today — `AdminLandingPage`
 * shows a translated generic — but the shape is part of the contract and the
 * next person to add error rendering will be looking at it.
 */
function landingError(field) {
  return (message) => new DemoApiError(400, message, { [field]: message })
}

/* -------------------------------------------------------------- validators
 *
 * Django ran these three ways at once — model field validators, DRF field
 * kwargs derived from the column, and hand-written `validate_<field>` methods —
 * and the messages below are the ones each of those actually emits, verbatim.
 * They are worth being fussy about only because SeoFormSection prints them.
 */

function choiceField(value, allowed, error) {
  const text = value === null || value === undefined ? '' : String(value)
  if (!allowed.includes(text)) throw error(`"${text}" is not a valid choice.`)
  return text
}

function charField(value, maxLength, error) {
  const text = value === null || value === undefined ? '' : String(value)
  if (text.length > maxLength) {
    throw error(`Ensure this field has no more than ${maxLength} characters.`)
  }
  return text
}

/** `config/validators.py:phone_validator` — lenient on purpose: it accepts
 *  '+995 322 55 07 40', '995322550740' and ''. */
const PHONE_RE = /^(\+?\d[\d\s\-()]{5,30}\d)?$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const URL_RE = /^(https?|ftps?):\/\/[^\s/$.?#][^\s]*$/i
const HEX_COLOR_RE = /^(#[0-9A-Fa-f]{6})?$/
const COUNTRY_RE = /^([A-Za-z]{2})?$/
const TIME_RE = /^\d{2}:\d{2}$/

/**
 * `LandingPageSerializer._SAFE_COLOR`. Permissive by design — hex, rgb()/rgba()
 * or a bare CSS keyword — and it is the frontend, not this regex, that insists
 * on six hex digits: the benefit card builds its tint as `` `${color}1a` ``, so
 * `#fff` or `tomato` validates here and then renders a transparent tile.
 */
const SAFE_COLOR_RE = /^(#[0-9a-fA-F]{3,8}|rgba?\([0-9.,\s%]+\)|[a-zA-Z]{1,30})$/

/**
 * A `DecimalField(max_digits, decimal_places)` with range validators, which is
 * both halves of the geo coordinate contract: it rejects what Django rejected,
 * and it returns the **string** DRF's `COERCE_DECIMAL_TO_STRING` produced —
 * quantized to the column's scale, so 41.7 comes back as '41.700000'.
 */
function decimalField(value, { places, digits, min, max }, error) {
  const text = String(value ?? '').trim()
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(text)) throw error('A valid number is required.')

  const [whole, fraction = ''] = text.replace(/^[+-]/, '').split('.')
  if (fraction.length > places) {
    throw error(`Ensure that there are no more than ${places} decimal places.`)
  }
  if (whole.replace(/^0+(?=\d)/, '').length + places > digits) {
    throw error(`Ensure that there are no more than ${digits} digits in total.`)
  }

  const number = Number(text)
  if (number < min) throw error(`Ensure this value is greater than or equal to ${min}.`)
  if (number > max) throw error(`Ensure this value is less than or equal to ${max}.`)
  return number.toFixed(places)
}

/* ------------------------------------------------------------------ images
 *
 * An `ImageField` write, minus the storage. Pillow's "is this actually an
 * image" check survives as a MIME sniff — worth keeping, because a demo that
 * accepts a PDF as a logo and then renders a broken tile is teaching the wrong
 * lesson about the product.
 */

const NOT_AN_IMAGE = 'Upload a valid image. The file you uploaded was either not an image or a corrupted image.'
const NOT_A_FILE = 'The submitted data was not a file. Check the encoding type on the form.'

function writeUpload(row, field, file, error) {
  if (!file.type || !file.type.startsWith('image/')) throw error(NOT_AN_IMAGE)
  // `register_file_cleanup`'s pre_save half: the image being replaced goes
  // away. A no-op when the old value was a seed path rather than a blob.
  releaseObjectUrl(row[field])
  row[field] = storeUpload(file)
}

/**
 * The landing and SEO images, which the admin *can* clear: the form appends
 * `about_image=''` / `seo_og_image=''` and `to_internal_value` maps the empty
 * string to None.
 */
function writeClearableImage(row, field, value, error) {
  if (isUpload(value)) {
    writeUpload(row, field, value, error)
    return
  }
  if (value === '' || value === null) {
    releaseObjectUrl(row[field])
    row[field] = null
    return
  }
  throw error(NOT_A_FILE)
}

function nowIso() {
  return new Date().toISOString()
}

/* ============================================================ site settings */

const HEADER_DISPLAY = ['both', 'logo_only', 'name_only']
const COLOR_THEMES = ['green', 'blue', 'purple', 'orange', 'red', 'teal', 'indigo', 'rose']
const SEARCH_SCOPES = ['georgia', 'worldwide', 'custom']

/**
 * `SiteSettingsSerializer`.
 *
 * Note that `site_logo` is in `Meta.fields` and is *not* declared write-only,
 * unlike landing's `about_image` and SEO's `seo_og_image`. So DRF's FileField
 * rendered it as an absolute URL and the payload carried the same string twice,
 * under `site_logo` and `site_logo_url`. Nothing reads the first one; it is
 * emitted because a payload that quietly differs from the contract it claims is
 * a trap for whoever writes against it next.
 *
 * `terms_text` is deliberately absent — it is the one field kept off this
 * serializer so the large HTML is not on every page load.
 */
function serializeSiteSettings() {
  const row = store.siteSettings
  return {
    site_name: row.site_name,
    site_title: row.site_title,
    header_display: row.header_display,
    color_theme: row.color_theme,
    site_logo: mediaUrl(row.site_logo),
    site_logo_url: mediaUrl(row.site_logo),
    site_logo_dark: mediaUrl(row.site_logo_dark),
    site_logo_dark_url: mediaUrl(row.site_logo_dark),
    favicon: mediaUrl(row.favicon),
    favicon_url: mediaUrl(row.favicon),
    contact_phone: row.contact_phone,
    whatsapp_number: row.whatsapp_number,
    contact_email: row.contact_email,
    default_search_scope: row.default_search_scope,
    default_search_countries: row.default_search_countries,
    footer_text: row.footer_text,
    updated_at: row.updated_at,
  }
}

function updateSiteSettings(req) {
  const row = store.siteSettings
  const data = readBody(req.body)
  const sent = (key) => Object.prototype.hasOwnProperty.call(data, key)

  if (sent('site_name')) row.site_name = charField(data.site_name, 200, fieldError('site_name'))
  if (sent('site_title')) row.site_title = charField(data.site_title, 200, fieldError('site_title'))
  if (sent('header_display')) {
    row.header_display = choiceField(data.header_display, HEADER_DISPLAY, fieldError('header_display'))
  }
  if (sent('color_theme')) {
    row.color_theme = choiceField(data.color_theme, COLOR_THEMES, fieldError('color_theme'))
  }
  if (sent('default_search_scope')) {
    row.default_search_scope = choiceField(
      data.default_search_scope, SEARCH_SCOPES, fieldError('default_search_scope'),
    )
  }

  for (const field of ['contact_phone', 'whatsapp_number']) {
    if (!sent(field)) continue
    const error = fieldError(field)
    const value = charField(data[field], 40, error)
    if (!PHONE_RE.test(value)) throw error('Enter a valid phone number.')
    row[field] = value
  }

  if (sent('contact_email')) {
    const error = fieldError('contact_email')
    const value = charField(data.contact_email, 254, error)
    if (value && !EMAIL_RE.test(value)) throw error('Enter a valid email address.')
    row.contact_email = value
  }

  if (sent('default_search_countries')) {
    const error = fieldError('default_search_countries')
    const codes = requireList(parseJsonField(data.default_search_countries), error)
    codes.forEach((code, index) => {
      if (typeof code !== 'string') throw error(`Item ${index} must be a string country code.`)
      if (!code) throw error(`Item ${index} must not be an empty string.`)
    })
    row.default_search_countries = codes
  }

  if (sent('footer_text')) {
    row.footer_text = cleanI18n(parseJsonField(data.footer_text), fieldError('footer_text'))
  }

  // The three images are write-only in practice, and only ever replaced. The
  // admin page's "remove" buttons clear the local preview and nothing else —
  // `handleSave` never appends the key unless a File was picked — so a logo,
  // once set, cannot be unset through the UI. That is upstream behaviour, not
  // an omission here; reproducing it is what keeps an admin from reporting a
  // phantom bug against the demo.
  for (const field of ['site_logo', 'site_logo_dark', 'favicon']) {
    if (!sent(field)) continue
    const error = fieldError(field)
    if (!isUpload(data[field])) throw error(NOT_A_FILE)
    writeUpload(row, field, data[field], error)
  }

  row.updated_at = nowIso()
  return serializeSiteSettings()
}

register('GET', '/site-settings/', serializeSiteSettings, { auth: 'public' })
register('GET', '/site-settings/admin/', serializeSiteSettings, { auth: 'admin' })
register('PUT', '/site-settings/admin/', updateSiteSettings, { auth: 'admin' })
// The view's `patch()` is one line: `return self.put(request)`. Both are
// partial — the verb carries no meaning here beyond what the client happens to
// send, which is PUT.
register('PATCH', '/site-settings/admin/', updateSiteSettings, { auth: 'admin' })

/* =================================================================== terms */

const TERMS_LANGS = ['en', 'ka', 'ru']
const TERMS_MAX_CHARS = 100_000

/**
 * `_terms_payload()`. Always exactly three keys with '' for a language nobody
 * has written, on read and on write alike, because `TermsGate` does
 * `terms[lang] || terms.en || ''` and then gates registration on whether the
 * result is blank — a missing key and an empty one have to mean the same thing.
 */
function termsPayload() {
  const terms = store.terms ?? {}
  return Object.fromEntries(TERMS_LANGS.map((lang) => [lang, terms[lang] || '']))
}

/**
 * `TermsSerializer`. The lone JSON-body write in this module: the rich-text
 * editor posts `{terms_text: {en, ka, ru}}` rather than multipart, because
 * there is no file to carry.
 */
function updateTerms(req) {
  const data = readBody(req.body)
  const value = data.terms_text

  if (value === undefined || value === null) {
    throw DemoApiError.validation({ terms_text: 'This field is required.' })
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw DemoApiError.validation({
      terms_text: `Expected a dictionary of items but got type "${typeof value}".`,
    })
  }

  // A `DictField(child=CharField)` reports a bad child under the child's own
  // key rather than as a list, so this one 400 is nested where its neighbours
  // are flat. Built by hand because `DemoApiError.validation` flattens to
  // arrays, which is right for every other case.
  for (const [lang, text] of Object.entries(value)) {
    if (typeof text !== 'string' && text !== null && text !== undefined) {
      throw new DemoApiError(400, 'Not a valid string.', {
        terms_text: { [lang]: ['Not a valid string.'] },
      })
    }
  }

  // Unknown languages are dropped and missing ones default to '', so storage is
  // always canonical however partial the payload was.
  const cleaned = Object.fromEntries(TERMS_LANGS.map((lang) => [lang, value[lang] || '']))
  for (const [lang, text] of Object.entries(cleaned)) {
    if (text.length > TERMS_MAX_CHARS) {
      throw DemoApiError.validation({
        terms_text: `"${lang}" exceeds the maximum allowed length of `
          + `${TERMS_MAX_CHARS.toLocaleString('en-US')} characters.`,
      })
    }
  }

  store.terms = cleaned
  // `terms_text` is physically a column on SiteSettings, and the view saves it
  // with `update_fields=['terms_text', 'updated_at']`. The demo keeps the HTML
  // in its own table for the same reason the serializer excludes it, but the
  // timestamp it moves is still the branding row's.
  store.siteSettings.updated_at = nowIso()
  return termsPayload()
}

register('GET', '/site-settings/terms/', termsPayload, { auth: 'public' })
register('GET', '/site-settings/admin/terms/', termsPayload, { auth: 'admin' })
register('PUT', '/site-settings/admin/terms/', updateTerms, { auth: 'admin' })

/* ================================================================= landing */

const LANDING_I18N_FIELDS = [
  'hero_title', 'hero_description',
  'about_eyebrow', 'about_title', 'about_description',
  'steps_title', 'benefits_title',
  'cta_title', 'cta_description', 'cta_button_text',
]

/**
 * `LandingPageSerializer`.
 *
 * `about_image` itself is write-only and absent from the payload; the two URLs
 * beside it are not the same field twice. `about_image_webp_url` is a separate
 * seed column rather than a derived name because upstream it is only non-null
 * when a `.webp` companion actually exists in storage — the serializer probes
 * for it. A row with `about_image_webp: null` is what exercises `PictureImage`'s
 * plain-`<img>` path, and an image uploaded through the admin form always lands
 * there: nothing in a browser tab is going to transcode it.
 */
function serializeLanding() {
  const row = store.landingSettings
  return {
    hero_title: row.hero_title,
    hero_description: row.hero_description,
    stats: row.stats,
    about_eyebrow: row.about_eyebrow,
    about_title: row.about_title,
    about_description: row.about_description,
    about_image_url: mediaUrl(row.about_image),
    about_image_webp_url: row.about_image ? mediaUrl(row.about_image_webp) : null,
    steps_title: row.steps_title,
    steps: row.steps,
    benefits_title: row.benefits_title,
    benefits: row.benefits,
    cta_title: row.cta_title,
    cta_description: row.cta_description,
    cta_button_text: row.cta_button_text,
    section_order: row.section_order,
    updated_at: row.updated_at,
  }
}

/** `_list_of_dicts`. The error lands under the list's own name, so a bad item
 *  inside `stats` is reported as `{stats: '…'}` rather than per index. */
function listOfDicts(value, error) {
  const list = requireList(value, error)
  list.forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw error(`Item ${index} must be an object.`)
    }
  })
  return list
}

function updateLanding(req) {
  const row = store.landingSettings
  const data = readBody(req.body)
  const sent = (key) => Object.prototype.hasOwnProperty.call(data, key)

  for (const field of LANDING_I18N_FIELDS) {
    if (!sent(field)) continue
    row[field] = cleanI18n(parseJsonField(data[field]), landingError(field))
  }

  if (sent('stats')) {
    const error = landingError('stats')
    const stats = listOfDicts(parseJsonField(data.stats), error)
    row.stats = stats.map((item, index) => {
      const next = { ...item }
      if ('label' in next) {
        next.label = cleanI18n(next.label, landingError(`stats[${index}].label`))
      }
      // The stat is rendered raw, so a number posted as a number would print
      // '500' where the seed prints '500+'. Django coerced; so does this.
      if ('number' in next && typeof next.number !== 'string') next.number = String(next.number)
      return next
    })
  }

  if (sent('steps')) {
    const error = landingError('steps')
    const steps = listOfDicts(parseJsonField(data.steps), error)
    row.steps = steps.map((item, index) => {
      const next = { ...item }
      if ('title' in next) next.title = cleanI18n(next.title, landingError(`steps[${index}].title`))
      if ('description' in next) {
        next.description = cleanI18n(next.description, landingError(`steps[${index}].description`))
      }
      return next
    })
  }

  if (sent('benefits')) {
    const error = landingError('benefits')
    const benefits = listOfDicts(parseJsonField(data.benefits), error)
    row.benefits = benefits.map((item, index) => {
      const next = { ...item }
      if ('title' in next) {
        next.title = cleanI18n(next.title, landingError(`benefits[${index}].title`))
      }
      if ('description' in next) {
        next.description = cleanI18n(next.description, landingError(`benefits[${index}].description`))
      }
      const color = next.color
      if (color !== null && color !== undefined && color !== '' && !SAFE_COLOR_RE.test(String(color))) {
        throw error(
          `Item ${index}: "color" contains unsafe CSS value. `
          + 'Use a hex code (#rrggbb), rgb()/rgba(), or a CSS keyword.',
        )
      }
      return next
    })
  }

  if (sent('section_order')) {
    const error = landingError('section_order')
    const sections = listOfDicts(parseJsonField(data.section_order), error)
    sections.forEach((item, index) => {
      if ('key' in item && typeof item.key !== 'string') {
        throw error(`Item ${index}: "key" must be a string.`)
      }
      if ('enabled' in item && typeof item.enabled !== 'boolean') {
        throw error(`Item ${index}: "enabled" must be a boolean.`)
      }
    })
    // Unknown keys are kept, exactly as the serializer keeps them: the two
    // resolvers on the frontend disagree about them on purpose — the public
    // page ignores what it cannot render, the admin drag list drops them — and
    // a mock that pruned here would hide that.
    row.section_order = sections
  }

  if (sent('about_image')) {
    writeClearableImage(row, 'about_image', data.about_image, landingError('about_image'))
    // Upstream `register_image_optimization` writes a .webp companion on save
    // and `about_image_webp_url` starts resolving a moment later. There is no
    // encoder here, so a freshly uploaded about image has no companion — which
    // is a real state upstream too, between the save and the signal finishing.
    row.about_image_webp = null
  }

  row.updated_at = nowIso()
  return serializeLanding()
}

register('GET', '/landing/', serializeLanding, { auth: 'public' })
register('GET', '/landing/admin/', serializeLanding, { auth: 'admin' })
register('PUT', '/landing/admin/', updateLanding, { auth: 'admin' })
register('PATCH', '/landing/admin/', updateLanding, { auth: 'admin' })

/* ===================================================================== seo */

const ROBOTS = ['index,follow', 'noindex,follow', 'noindex,nofollow']
const SCHEMA_TYPES = ['MovingCompany', 'LocalBusiness', 'AutomotiveBusiness']

/** `SeoSettingsSerializer`. `seo_og_image` is write-only and absent. */
function serializeSeo() {
  const row = store.seoSettings
  return {
    seo_title: row.seo_title,
    seo_description: row.seo_description,
    seo_keywords: row.seo_keywords,
    seo_og_image_url: mediaUrl(row.seo_og_image),
    seo_og_image_alt: row.seo_og_image_alt,
    seo_canonical_url: row.seo_canonical_url,
    seo_robots: row.seo_robots,
    seo_theme_color: row.seo_theme_color,
    legal_name: row.legal_name,
    address_street: row.address_street,
    address_locality: row.address_locality,
    address_region: row.address_region,
    address_postal_code: row.address_postal_code,
    address_country: row.address_country,
    // Decimals, so strings — `SeoFormSection` does `parseFloat(...)` guarded by
    // `!= null`, which means a genuine null and a 0 behave differently: the
    // null leaves the input empty and unsent, the 0 renders and round-trips.
    geo_latitude: row.geo_latitude,
    geo_longitude: row.geo_longitude,
    opening_hours: row.opening_hours,
    same_as: row.same_as,
    schema_type: row.schema_type,
    updated_at: row.updated_at,
  }
}

/** Plain `CharField`s with nothing but a length limit, and their columns. */
const SEO_TEXT_FIELDS = {
  seo_og_image_alt: 255,
  legal_name: 200,
  address_street: 255,
  address_locality: 120,
  address_region: 120,
  address_postal_code: 20,
}

function updateSeo(req) {
  const row = store.seoSettings
  const data = readBody(req.body)
  const sent = (key) => Object.prototype.hasOwnProperty.call(data, key)

  for (const field of ['seo_title', 'seo_description', 'seo_keywords']) {
    if (!sent(field)) continue
    row[field] = cleanI18n(parseJsonField(data[field]), fieldError(field))
  }

  for (const [field, maxLength] of Object.entries(SEO_TEXT_FIELDS)) {
    if (!sent(field)) continue
    row[field] = charField(data[field], maxLength, fieldError(field))
  }

  if (sent('seo_canonical_url')) {
    const error = fieldError('seo_canonical_url')
    const value = charField(data.seo_canonical_url, 200, error)
    // Two checks in the order Django ran them: the URLField's own validator
    // first — which accepts ftp:// — then the serializer's tighter one, which
    // exists because this value lands in <link rel="canonical">.
    if (value && !URL_RE.test(value)) throw error('Enter a valid URL.')
    if (value && !/^https?:\/\//.test(value)) {
      throw error('Canonical URL must start with https:// or http://')
    }
    row.seo_canonical_url = value
  }

  if (sent('seo_robots')) {
    row.seo_robots = choiceField(data.seo_robots, ROBOTS, fieldError('seo_robots'))
  }
  if (sent('schema_type')) {
    row.schema_type = choiceField(data.schema_type, SCHEMA_TYPES, fieldError('schema_type'))
  }

  if (sent('seo_theme_color')) {
    const error = fieldError('seo_theme_color')
    const value = charField(data.seo_theme_color, 7, error)
    if (!HEX_COLOR_RE.test(value)) {
      throw error('Must be a 6-digit hex color (e.g. #F97316) or blank.')
    }
    row.seo_theme_color = value
  }

  if (sent('address_country')) {
    const error = fieldError('address_country')
    const value = charField(data.address_country, 2, error)
    if (!COUNTRY_RE.test(value)) throw error('Country must be a 2-letter code.')
    row.address_country = value
  }

  for (const [field, bound] of [['geo_latitude', 90], ['geo_longitude', 180]]) {
    if (!sent(field)) continue
    const error = fieldError(field)
    const raw = data[field]
    // The form only appends these when they are non-null, so clearing a
    // coordinate through the UI is impossible — the same one-way street the
    // logo fields are on. An explicit null is still honoured, for a caller
    // that sends one.
    row[field] = raw === '' || raw === null
      ? null
      : decimalField(raw, { places: 6, digits: 9, min: -bound, max: bound }, error)
  }

  if (sent('opening_hours')) {
    const error = fieldError('opening_hours')
    const hours = requireList(parseJsonField(data.opening_hours), error)
    hours.forEach((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw error(`Item ${index} must be an object.`)
      }
      for (const key of ['opens', 'closes']) {
        if (!(key in item)) continue
        if (typeof item[key] !== 'string' || !TIME_RE.test(item[key])) {
          throw error(`Item ${index}: "${key}" must be in HH:MM format (e.g. "09:00").`)
        }
      }
      if ('dayOfWeek' in item) {
        if (!Array.isArray(item.dayOfWeek)) {
          throw error(`Item ${index}: "dayOfWeek" must be a list of strings.`)
        }
        item.dayOfWeek.forEach((day, dayIndex) => {
          if (typeof day !== 'string') {
            throw error(`Item ${index}: "dayOfWeek[${dayIndex}]" must be a string.`)
          }
        })
      }
    })
    row.opening_hours = hours
  }

  if (sent('same_as')) {
    const error = fieldError('same_as')
    const links = requireList(parseJsonField(data.same_as), error)
    links.forEach((link, index) => {
      if (typeof link !== 'string') throw error(`Item ${index} must be a string URL.`)
      if (!/^https?:\/\//.test(link)) {
        throw error(`Item ${index}: URL must start with https:// or http://`)
      }
    })
    row.same_as = links
  }

  if (sent('seo_og_image')) {
    writeClearableImage(row, 'seo_og_image', data.seo_og_image, fieldError('seo_og_image'))
  }

  row.updated_at = nowIso()
  return serializeSeo()
}

// Public, and unreached: upstream this is fetched by an inline script in
// index.html that patches the static <title> and <meta> tags before React
// boots, and the port drops that script — it would run before anything the mock
// could answer from, and the demo's own tags are the fallback it would land on
// anyway. The route stays because the admin screen that edits these values is
// still here and still works, and a public endpoint that exists in the contract
// but not in the router is a 404 waiting for whoever restores the script.
register('GET', '/seo/', serializeSeo, { auth: 'public' })
register('GET', '/seo/admin/', serializeSeo, { auth: 'admin' })
register('PATCH', '/seo/admin/', updateSeo, { auth: 'admin' })
register('PUT', '/seo/admin/', updateSeo, { auth: 'admin' })
