/**
 * The accounts app: sessions, registration, the two code-based email flows,
 * the customer profile, and the whole of admin user management.
 *
 * This is the one module where the mock has to imitate DRF's *serializers*
 * rather than its querysets, because almost every screen it serves renders the
 * error body inline. `utils/registerErrors.js` iterates `Object.entries` of
 * whatever 400 it is handed and localises exactly four field names by matching
 * the substrings `already registered` and `must be exactly`; both change-password
 * call sites render `Object.values(body).flat()[0]`; and the verify/reset pages
 * key off a machine-readable `code` string. So the sentences below are the
 * backend's own, verbatim — paraphrasing one silently switches a translated
 * message back to raw English.
 *
 * Two error shapes live side by side here and are not interchangeable:
 *
 *   · `{field: ['message']}` — anything a serializer rejected. DRF's
 *     `as_serializer_error()` wraps every value in a list on the way out, so
 *     even the several places that raise `ValidationError({'company_name':
 *     'Company name is required.'})` with a bare string arrive at the browser
 *     as a one-element array. `DemoApiError.validation()` does the same.
 *   · `{detail: 'sentence', code: 'invalid'}` — anything a *view* returned
 *     directly, which is every branch of login, verify-email and both halves
 *     of the password reset. Here `detail` is a plain string, never an array,
 *     and `code` is the reason the page branches on. Note the collision: in a
 *     request body `code` means the six digits the user typed; in a response
 *     body it means the machine-readable reason.
 *
 * ## Codes, in a demo with no email
 *
 * Upstream a registration or a "forgot password" sends a six-digit code and a
 * magic link by SMTP, and the database stores only their SHA-256 hashes. A
 * browser tab has no mail server and nothing to hash for, so the rows hold the
 * code and the token in clear (see `schema.md`) and — this is the deliberate
 * demo affordance — **every code the mock issues is a fixed, published value**:
 * `123456` to confirm an address, `654321` to reset a password, matching the two
 * seeded rows. The full link is also returned in the response body under
 * `demo_link` and logged to the console, so the magic-link screens can be walked
 * too. Nothing upstream had those fields; nothing in the app reads them; they
 * exist so a visitor can finish a flow that would otherwise dead-end on a
 * "check your email" screen. Everything else about the flow is real — the
 * ten-minute window, the thirty-minute one, the thirty-second resend cooldown,
 * the five-attempt lockout and the shared attempt counter all behave as they do
 * in production.
 *
 * Registration therefore produces a genuinely usable account: the new row is
 * unverified, the verify screen it lands on accepts `123456`, and the tokens
 * that come back sign the visitor in for the rest of the tab's life.
 */
import { issueTokens, blacklistRefreshToken, userForRefreshToken } from '../auth'
import { APP_BASE, mediaUrl } from '../base'
import {
  applyFilters, applyOrdering, applySearch, dateKey, paginate, shiftDayKey, todayKey,
} from '../query'
import { DemoApiError, notFound, register } from '../router'
import { hasField, isUpload, readBody, storeUpload } from '../serialize'
import {
  contractsForUser, nextId, ordersForUser,
  releaseObjectUrl, store, userByEmail, userById,
} from '../store'

const MINUTE = 60_000

/** `EMAIL_VERIFY_TTL_MINUTES` / `PASSWORD_RESET_TTL_MINUTES`. */
const TOKEN_TTL = { verify_email: 10 * MINUTE, password_reset: 30 * MINUTE }

/** `EmailVerificationToken.MAX_ATTEMPTS`. */
const MAX_ATTEMPTS = 5

/** `EMAIL_RESEND_COOLDOWN_SEC`. */
const RESEND_COOLDOWN_MS = 30_000

function now() {
  return new Date().toISOString()
}

/* ===================================================================== *
 *  Serializer field helpers
 *
 *  Just enough of `CharField` / `EmailField` / `BooleanField` to produce the
 *  messages the forms render. Each collects into a shared `errors` bag rather
 *  than throwing, because `to_internal_value` reports *every* bad field at
 *  once and Ant Design marks all of them; only `validate()` stops at the first
 *  problem.
 * ===================================================================== */

function raiseIfInvalid(errors) {
  if (Object.keys(errors).length) throw DemoApiError.validation(errors)
}

/** The single-field 400 a `validate()` body raises, one message at a time. */
function fieldError(field, message) {
  return DemoApiError.validation({ [field]: message })
}

function charField(data, name, errors, options = {}) {
  const { required = true, allowBlank = false, minLength, maxLength } = options
  const raw = data[name]

  if (raw === undefined || raw === null) {
    if (required) errors[name] = ['This field is required.']
    return undefined
  }
  // Multipart turns everything into a string on the way in; a JSON body may
  // hand over a number, which DRF's CharField would also have stringified.
  const value = String(raw).trim()
  if (!value) {
    if (!allowBlank) errors[name] = ['This field may not be blank.']
    return value
  }
  if (minLength !== undefined && value.length < minLength) {
    errors[name] = [`Ensure this field has at least ${minLength} characters.`]
    return undefined
  }
  if (maxLength !== undefined && value.length > maxLength) {
    errors[name] = [`Ensure this field has no more than ${maxLength} characters.`]
    return undefined
  }
  return value
}

// Django's `EmailValidator` in the shape that matters: a local part, one @, a
// dotted domain. It is deliberately looser than the real thing — the point is
// to reject "not an email", not to adjudicate RFC 5322.
const EMAIL_PATTERN = /^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/

function emailField(data, name, errors, options = {}) {
  const value = charField(data, name, errors, options)
  if (value === undefined || errors[name]) return value
  if (value && !EMAIL_PATTERN.test(value)) {
    errors[name] = ['Enter a valid email address.']
    return undefined
  }
  return value
}

/** `config/validators.py:phone_validator`. Blank passes — the column allows it. */
const PHONE_PATTERN = /^(\+?\d[\d\s\-()]{5,30}\d)?$/

function phoneField(data, name, errors) {
  const value = charField(data, name, errors, { required: false, allowBlank: true, maxLength: 20 })
  if (value === undefined || errors[name]) return value
  if (value && !PHONE_PATTERN.test(value)) {
    errors[name] = ['Enter a valid phone number.']
    return undefined
  }
  return value
}

/** DRF's `BooleanField` truthiness, which multipart depends on: `'false'` and
 *  `'0'` are false, not merely non-empty strings. */
function booleanField(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback
  if (typeof value === 'boolean') return value
  const text = String(value).toLowerCase()
  if (['true', 't', 'yes', 'y', '1'].includes(text)) return true
  if (['false', 'f', 'no', 'n', '0'].includes(text)) return false
  return fallback
}

/* ===================================================================== *
 *  Password strength
 *
 *  `AUTH_PASSWORD_VALIDATORS` is Django's stock four, and Django collects
 *  every failing validator rather than stopping at the first, so the list
 *  under `password` / `new_password` can hold several sentences in validator
 *  order.
 *
 *  Only three of the four can ever fire in this app. The fourth,
 *  `UserAttributeSimilarityValidator`, returns immediately when it is handed
 *  no user — and every call site here attaches `validate_password` as a bare
 *  field validator (`CharField(validators=[validate_password])`), which DRF
 *  invokes with the value alone. So a password matching the email address is
 *  accepted at registration, at admin creation, at reset and at change alike.
 *  That is production behaviour, not a gap in the port.
 * ===================================================================== */

const MIN_PASSWORD_LENGTH = 8

/** A slice of Django's 20 000-entry list — enough that an obvious choice is
 *  caught, which is all the message needs to be believable. */
const COMMON_PASSWORDS = new Set([
  '123456', '1234567', '12345678', '123456789', '1234567890', 'password',
  'password1', 'password123', 'passw0rd', 'qwerty', 'qwerty123', 'qwertyuiop',
  'abc123', '1q2w3e4r', 'letmein', 'welcome', 'welcome1', 'admin', 'admin123',
  'iloveyou', 'monkey', 'dragon', 'sunshine', 'princess', 'football',
  'baseball', 'superman', 'trustno1', 'starwars', 'whatever', 'changeme',
  'secret', 'master', 'freedom', 'shadow', 'michael', 'jennifer', 'computer',
])

function passwordProblems(password) {
  const value = String(password ?? '')
  const problems = []
  if (value.length < MIN_PASSWORD_LENGTH) {
    problems.push(
      `This password is too short. It must contain at least ${MIN_PASSWORD_LENGTH} characters.`,
    )
  }
  if (COMMON_PASSWORDS.has(value.toLowerCase())) {
    problems.push('This password is too common.')
  }
  if (value && /^\d+$/.test(value)) {
    problems.push('This password is entirely numeric.')
  }
  return problems
}

/** A `CharField(validators=[validate_password])`: shape first, strength second. */
function passwordField(data, name, errors) {
  const value = charField(data, name, errors)
  if (value === undefined || errors[name]) return value
  const problems = passwordProblems(value)
  if (problems.length) {
    errors[name] = problems
    return undefined
  }
  return value
}

/* ===================================================================== *
 *  Serializers
 * ===================================================================== */

/**
 * `UserSerializer` — the object that ends up in `localStorage.user` and is
 * therefore the source of truth for every route guard until the next
 * `refreshProfile()`.
 *
 * Upstream `avatar_url` is absolute when the serializer has the request in
 * context (`GET /auth/profile/`) and relative when it does not (login,
 * register, verify-email), so a freshly signed-in session held the relative
 * form until its first profile fetch. That distinction cannot survive the port
 * — there is no host to build an absolute URL against, and `mediaUrl()` already
 * resolves against the build's base — so both fields carry the same string
 * everywhere, which is what the gotcha list asks for.
 */
export function serializeUser(row) {
  // `Order.user` is nullable upstream (`on_delete=SET_NULL`), so
  // `user_detail` has to be able to be null rather than crash the order.
  if (!row) return null

  return {
    id: row.id,
    email: row.email,
    phone_number: row.phone_number ?? '',
    first_name: row.first_name ?? '',
    last_name: row.last_name ?? '',
    full_name: `${row.first_name ?? ''} ${row.last_name ?? ''}`,
    role: row.role,
    user_type: row.user_type,
    company_name: row.company_name ?? '',
    company_id: row.company_id ?? '',
    personal_id: row.personal_id ?? null,
    avatar: mediaUrl(row.avatar) ?? null,
    avatar_url: mediaUrl(row.avatar) ?? null,
    is_active: row.is_active,
    must_change_password: row.must_change_password,
    email_verified: row.email_verified,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

/**
 * `ProfileUpdateSerializer` — seven fields, deliberately not the user. The
 * profile page throws it away and re-fetches, but returning the full user here
 * would hide a mistake in `GET /auth/profile/` behind a payload nothing reads.
 */
function serializeProfileUpdate(row) {
  return {
    first_name: row.first_name ?? '',
    last_name: row.last_name ?? '',
    phone_number: row.phone_number ?? '',
    user_type: row.user_type,
    company_name: row.company_name ?? '',
    avatar: mediaUrl(row.avatar) ?? null,
    avatar_url: mediaUrl(row.avatar) ?? null,
  }
}

/**
 * `AdminUserSerializer` over the annotated queryset.
 *
 * Every key here is load-bearing twice over: the row shape the users table
 * renders, and — because `AdminUserFormPage` pipes the detail response straight
 * into `form.setFieldsValue(data)` — the initial value of every field on the
 * edit form. A key that is merely absent rather than empty leaves its input
 * blank, and the next PATCH writes that blank back over real data. So no field
 * is ever omitted: `''` for the blank-able columns, `null` only for
 * `personal_id`, which genuinely is null on a company account.
 */
function serializeAdminUser(row) {
  return {
    id: row.id,
    email: row.email,
    phone_number: row.phone_number ?? '',
    first_name: row.first_name ?? '',
    last_name: row.last_name ?? '',
    full_name: `${row.first_name ?? ''} ${row.last_name ?? ''}`,
    role: row.role,
    user_type: row.user_type,
    company_name: row.company_name ?? '',
    company_id: row.company_id ?? '',
    personal_id: row.personal_id ?? null,
    is_active: row.is_active,
    must_change_password: row.must_change_password,
    email_verified: row.email_verified,
    created_at: row.created_at,
    updated_at: row.updated_at,
    // `Count('orders', distinct=True)` / `Count('contracts', distinct=True)`.
    // Counted at request time rather than stored: an order placed in the
    // customer app has to move the number the admin sees.
    order_count: ordersForUser(row.id).length,
    contract_count: contractsForUser(row.id).length,
  }
}

/** `AdminCreateUserSerializer.data` — its own field list, not the user's, and
 *  `password` is write-only. Nothing reads it; it is right anyway. */
function serializeCreatedUser(row) {
  return {
    id: row.id,
    email: row.email,
    phone_number: row.phone_number ?? '',
    first_name: row.first_name ?? '',
    last_name: row.last_name ?? '',
    role: row.role,
    user_type: row.user_type,
    company_name: row.company_name ?? '',
    company_id: row.company_id ?? '',
    personal_id: row.personal_id ?? null,
    is_active: row.is_active,
  }
}

/** `CompanyContractSerializer`. `document` is write-only and never appears. */
function serializeContract(row) {
  const uploader = userById(row.uploaded_by)
  return {
    id: row.id,
    title: row.title ?? '',
    original_filename: row.original_filename ?? '',
    file_size: row.file_size ?? 0,
    document_url: mediaUrl(row.document) ?? null,
    uploaded_by: row.uploaded_by ?? null,
    // `source='uploaded_by.full_name', default=''` — an admin deleted since the
    // upload leaves the FK null (SET_NULL) and the name empty.
    uploaded_by_name: uploader ? `${uploader.first_name} ${uploader.last_name}` : '',
    created_at: row.created_at,
  }
}

/* ===================================================================== *
 *  Verification and reset codes
 *
 *  A port of `accounts/email_service.py`. The one substitution is at the top:
 *  upstream generates `secrets.randbelow(1_000_000)` and stores its hash, here
 *  the code is the published constant for its purpose so the flow can be
 *  finished without a mailbox. See the module header.
 * ===================================================================== */

export const DEMO_CODES = { verify_email: '123456', password_reset: '654321' }

/** Where the magic link in the email would have pointed, resolved against this
 *  build's base rather than `FRONTEND_BASE_URL`. */
const LINK_ROUTE = {
  verify_email: '/verify-email/confirm',
  password_reset: '/reset-password',
}

function randomToken() {
  // 43 urlsafe characters, the length `secrets.token_urlsafe(32)` produces —
  // which matters only because the serializer bounds the field at 10..128.
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * The newest *unused* row of a purpose, expired or not.
 *
 * `activeTokenFor()` in the store filters expiry out, which is right for the
 * question it answers but wrong here: `verify_token()` upstream picks the
 * newest unused row and only *then* decides it has expired, and that ordering
 * is what produces `code: 'expired'` instead of `code: 'invalid'` on the screen.
 */
function newestUnused(userId, purpose) {
  return store.verificationTokens
    .filter((row) => row.user_id === userId && row.purpose === purpose && !row.used_at)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0]
}

function newestOfPurpose(userId, purpose) {
  return store.verificationTokens
    .filter((row) => row.user_id === userId && row.purpose === purpose)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0]
}

/**
 * Issue a code + link, marking every still-active row of this (user, purpose)
 * used first — so only the newest code ever works, which is what makes
 * "resend" trustworthy.
 */
function issueToken(user, purpose) {
  for (const row of store.verificationTokens) {
    if (row.user_id === user.id && row.purpose === purpose && !row.used_at) {
      row.used_at = now()
    }
  }

  const issuedAt = now()
  const row = {
    id: nextId('verificationTokens'),
    user_id: user.id,
    purpose,
    code: DEMO_CODES[purpose],
    token: randomToken(),
    expires_at: new Date(Date.now() + TOKEN_TTL[purpose]).toISOString(),
    used_at: null,
    attempts: 0,
    created_at: issuedAt,
    last_sent_at: issuedAt,
  }
  store.verificationTokens.push(row)

  const link = `${APP_BASE}${LINK_ROUTE[purpose]}?token=${row.token}`
  // The demo's stand-in for opening the inbox. Deliberately noisy: this is the
  // only place outside the response body where the code surfaces.
  // eslint-disable-next-line no-console
  console.info(
    `[tonnaro demo] ${purpose === 'password_reset' ? 'Password reset' : 'Verification'} `
    + `code for ${user.email}: ${row.code}  ·  link: ${link}`,
  )

  return { code: row.code, token: row.token, link }
}

/** What a handler adds to a response so the code is reachable without email. */
function demoDisclosure(issued) {
  return { demo_code: issued.code, demo_link: issued.link }
}

/**
 * `email_service.verify_token()` — validate and *consume*.
 *
 * The distinction between `invalid` and `locked` when there is no live row is
 * the subtle half: a used row that reached the attempt ceiling means the last
 * code was burned by guessing, and the page should say "request a new one"
 * rather than "wrong code".
 */
function verifyToken(user, purpose, { code, token }) {
  if (!code && !token) return 'invalid'

  const row = newestUnused(user.id, purpose)
  if (!row) {
    const exhausted = store.verificationTokens.some(
      (entry) => entry.user_id === user.id
        && entry.purpose === purpose
        && entry.used_at
        && entry.attempts >= MAX_ATTEMPTS,
    )
    return exhausted ? 'locked' : 'invalid'
  }

  if (Date.parse(row.expires_at) <= Date.now()) return 'expired'

  if (code !== undefined && code !== null) {
    if (row.code === String(code)) {
      row.used_at = now()
      return 'ok'
    }
    row.attempts += 1
    if (row.attempts >= MAX_ATTEMPTS) {
      row.used_at = now()
      return 'locked'
    }
    return 'invalid'
  }

  if (row.token === token) {
    row.used_at = now()
    return 'ok'
  }
  // A wrong link is not a guessing attempt — the token space is too large to
  // brute-force — so the attempt counter is left alone, as upstream leaves it.
  return 'invalid'
}

/**
 * `email_service.check_code_only()` — step 1 of the two-step reset.
 *
 * Identical to the above except that a correct code leaves `used_at` NULL, so
 * the `/confirm/` call that follows can burn it. A *wrong* code still counts,
 * against the same counter, which is why five misses spread across the two
 * endpoints lock the row just as five against one would.
 */
function checkCodeOnly(user, purpose, code) {
  if (!code) return 'invalid'

  const row = newestUnused(user.id, purpose)
  if (!row) {
    const exhausted = store.verificationTokens.some(
      (entry) => entry.user_id === user.id
        && entry.purpose === purpose
        && entry.used_at
        && entry.attempts >= MAX_ATTEMPTS,
    )
    return exhausted ? 'locked' : 'invalid'
  }

  if (Date.parse(row.expires_at) <= Date.now()) return 'expired'
  if (row.code === String(code)) return 'ok'

  row.attempts += 1
  if (row.attempts >= MAX_ATTEMPTS) {
    row.used_at = now()
    return 'locked'
  }
  return 'invalid'
}

/** `email_service.can_resend()` — measured against `last_sent_at` on the newest
 *  row of the purpose, used or not. */
function canResend(user, purpose) {
  const row = newestOfPurpose(user.id, purpose)
  if (!row) return true
  return Date.now() - Date.parse(row.last_sent_at) >= RESEND_COOLDOWN_MS
}

/** The `{detail, code}` 400 every code screen branches on. */
const CODE_MESSAGES = {
  verify_email: {
    invalid: 'Incorrect or unknown code.',
    expired: 'This code has expired. Please request a new one.',
    locked: 'Too many attempts. Please request a new code.',
  },
  password_reset: {
    invalid: 'Incorrect code.',
    expired: 'This reset code has expired. Please request a new one.',
    locked: 'Too many attempts. Please request a new reset code.',
  },
}

function codeError(purpose, reason) {
  const detail = CODE_MESSAGES[purpose][reason] ?? 'Verification failed.'
  return new DemoApiError(400, detail, { detail, code: reason })
}

/* ===================================================================== *
 *  Identity rules
 *
 *  Shared by registration, admin creation and admin editing, because all three
 *  enforce the same thing and their messages are compared by substring
 *  downstream. Note the quirk being preserved on purpose: the company branch
 *  says "Company ID must be exactly 9 digits", `registerErrors.js` matches the
 *  fragment `must be exactly`, and the user is shown "Personal ID must be
 *  exactly 11 digits". Wrong, and shipped.
 * ===================================================================== */

function emailTaken(email, exceptId = null) {
  const wanted = String(email ?? '').trim().toLowerCase()
  return store.users.some(
    (user) => user.id !== exceptId && user.email.toLowerCase() === wanted,
  )
}

function personalIdTaken(personalId, exceptId = null) {
  return store.users.some(
    (user) => user.id !== exceptId && user.personal_id === personalId,
  )
}

const digitsOf = (value) => String(value ?? '').replace(/\D/g, '')

/**
 * `RegisterSerializer.validate`'s phone check, both halves: an exact match
 * against the canonical `+995XXXXXXXXX` the `PhoneInput` sends, and a
 * digits-only comparison that also catches a legacy row stored with spaces or
 * dashes.
 */
function phoneTaken(phone, exceptId = null) {
  const value = String(phone ?? '').trim()
  if (!value) return false
  const digits = digitsOf(value)
  return store.users.some((user) => {
    if (user.id === exceptId) return false
    if (user.phone_number === value) return true
    return Boolean(digits) && Boolean(user.phone_number) && digitsOf(user.phone_number) === digits
  })
}

/**
 * The company/personal fork, as all three serializers spell it. Mutates
 * `attrs` the way `validate()` does — a company account stores `personal_id`
 * as NULL rather than `''`, because the column is unique and Postgres counts
 * NULLs as distinct while it would reject a second empty string.
 */
function validateIdentity(attrs, { exceptId = null, companyNameMessage } = {}) {
  if (attrs.user_type === 'company') {
    if (!String(attrs.company_name ?? '').trim()) {
      throw fieldError('company_name', companyNameMessage ?? 'Company name is required.')
    }
    const companyId = String(attrs.company_id ?? '')
    if (!/^\d{9}$/.test(companyId)) {
      throw fieldError('company_id', 'Company ID must be exactly 9 digits.')
    }
    attrs.personal_id = null
    return
  }

  const personalId = String(attrs.personal_id ?? '')
  if (!/^\d{11}$/.test(personalId)) {
    throw fieldError('personal_id', 'Personal ID must be exactly 11 digits.')
  }
  if (personalIdTaken(personalId, exceptId)) {
    throw fieldError('personal_id', 'This personal ID is already registered.')
  }
}

/* ===================================================================== *
 *  Session
 * ===================================================================== */

/**
 * `CustomTokenObtainPairView`. Three failure branches the pages tell apart,
 * and the order they are checked in is itself the contract: credentials first,
 * so an unverified address can only ever be revealed to someone who already
 * knows the password.
 */
register('POST', '/auth/login/', (req) => {
  const data = readBody(req.body)
  const errors = {}
  const email = charField(data, 'email', errors)
  const password = charField(data, 'password', errors)
  // A missing field is a plain serializer 400 with no `detail`, which is why
  // both login pages fall back to their own "Invalid credentials" string here
  // rather than rendering anything from the body.
  raiseIfInvalid(errors)

  const user = userByEmail(email)
  if (!user || user.password !== password || !user.is_active) {
    // One message for a wrong password, an unknown address and a disabled
    // account alike — SimpleJWT's own, and the only 401 the mock ever raises
    // outside the token endpoint.
    throw new DemoApiError(401, 'No active account found with the given credentials')
  }

  if (!user.email_verified) {
    throw new DemoApiError(400, 'Please verify your email before signing in.', {
      detail: 'Please verify your email before signing in.',
      code: 'email_unverified',
    })
  }

  const tokens = issueTokens(user)
  return { refresh: tokens.refresh, access: tokens.access, user: serializeUser(user) }
}, { auth: 'public' })

/**
 * `TokenRefreshView` with `ROTATE_REFRESH_TOKENS` and `BLACKLIST_AFTER_ROTATION`.
 *
 * The axios interceptor in `api/client.js` is the only caller, and it stores
 * whatever `refresh` comes back, so the new one is not optional. Presenting a
 * spent token twice fails — which is the behaviour that makes the interceptor's
 * single-retry rule matter rather than being decorative.
 */
register('POST', '/auth/token/refresh/', (req) => {
  const data = readBody(req.body)
  const errors = {}
  const refresh = charField(data, 'refresh', errors)
  raiseIfInvalid(errors)

  const user = userForRefreshToken(refresh)
  if (!user) {
    throw new DemoApiError(401, 'Token is invalid or expired', {
      detail: 'Token is invalid or expired',
      code: 'token_not_valid',
      messages: [{
        token_class: 'RefreshToken',
        token_type: 'refresh',
        message: 'Token is invalid or expired',
      }],
    })
  }

  blacklistRefreshToken(refresh)
  return issueTokens(user)
}, { auth: 'public' })

/**
 * `LogoutView`. Upstream answers 205 with an empty body on success and 400 with
 * an empty body on anything else; the mock's empty success reads as 204 through
 * `api/client.js`, which no caller can tell apart because `AuthContext.logout`
 * wraps the whole call in an empty catch and clears local storage either way.
 */
register('POST', '/auth/logout/', (req) => {
  const data = readBody(req.body)
  const refresh = typeof data.refresh === 'string' ? data.refresh : null
  if (!refresh || !userForRefreshToken(refresh)) {
    throw new DemoApiError(400, 'Token is invalid or expired', {})
  }
  blacklistRefreshToken(refresh)
}, { auth: 'any' })

/* ===================================================================== *
 *  Registration
 * ===================================================================== */

register('POST', '/auth/register/', (req) => {
  const data = readBody(req.body)

  // `to_internal_value` first, collecting every bad field, in `Meta.fields`
  // order — which is the order the toast picks its one message from.
  const errors = {}
  const email = emailField(data, 'email', errors)
  const phone = phoneField(data, 'phone_number', errors)
  const firstName = charField(data, 'first_name', errors, { maxLength: 100 })
  const lastName = charField(data, 'last_name', errors, { maxLength: 100 })
  const userType = data.user_type === 'company' ? 'company' : 'personal'
  const companyName = charField(data, 'company_name', errors, {
    required: false, allowBlank: true, maxLength: 200,
  })
  const companyId = charField(data, 'company_id', errors, {
    required: false, allowBlank: true, maxLength: 11,
  })
  const personalId = charField(data, 'personal_id', errors, {
    required: false, allowBlank: true, minLength: 11, maxLength: 11,
  })
  const password = passwordField(data, 'password', errors)
  const confirmPassword = charField(data, 'confirm_password', errors)

  // The model's own unique validator, which runs at field level and is
  // case-*sensitive*. It fires before `validate()`, so an address that differs
  // only in case falls through to the friendlier message below — and this one,
  // Django's stock wording, is not among the four `registerErrors.js` localises.
  if (email && !errors.email && store.users.some((user) => user.email === email)) {
    errors.email = ['user with this email already exists.']
  }
  raiseIfInvalid(errors)

  // `validate()` — one message at a time, in the backend's own order.
  if (password !== confirmPassword) {
    throw fieldError('confirm_password', 'Passwords do not match.')
  }
  if (emailTaken(email)) {
    throw fieldError('email', 'Email already registered.')
  }
  if (phoneTaken(phone)) {
    throw fieldError('phone_number', 'This phone number is already registered.')
  }

  const attrs = {
    user_type: userType,
    company_name: companyName ?? '',
    company_id: companyId ?? '',
    personal_id: personalId ?? '',
  }
  validateIdentity(attrs)

  // T&C acceptance is enforced only when terms actually exist, so a deployment
  // that has not written any cannot lock itself out of registration. The demo
  // seeds them, which is what makes `TermsGate`'s scroll-gate visible.
  const terms = store.terms ?? {}
  const termsConfigured = ['en', 'ka', 'ru'].some((lang) => String(terms[lang] ?? '').trim())
  const acceptedTerms = booleanField(data.accepted_terms)
  if (termsConfigured && !acceptedTerms) {
    throw fieldError('accepted_terms', 'You must accept the Terms & Conditions to register.')
  }

  const stamp = now()
  const user = {
    id: nextId('users'),
    email,
    password,
    phone_number: phone ?? '',
    user_type: attrs.user_type,
    company_name: attrs.company_name,
    company_id: attrs.company_id,
    personal_id: attrs.personal_id,
    first_name: firstName,
    last_name: lastName,
    avatar: null,
    role: 'customer',
    is_active: true,
    is_staff: false,
    // The new account is deliberately unverified: the verify screen the page
    // navigates to next is the point, and `DEMO_CODES.verify_email` gets
    // through it.
    email_verified: false,
    must_change_password: false,
    // Only stamped when consent was actually required, so the column never
    // records agreement to terms that did not exist.
    accepted_terms_at: termsConfigured && acceptedTerms ? stamp : null,
    last_login: null,
    created_at: stamp,
    updated_at: stamp,
  }
  store.users.push(user)

  const issued = issueToken(user, 'verify_email')
  return {
    user: serializeUser(user),
    requires_verification: true,
    ...demoDisclosure(issued),
  }
}, { auth: 'public' })

/* ===================================================================== *
 *  Email verification
 * ===================================================================== */

/**
 * `VerifyEmailSerializer`: either `{email, code}` or `{token}`, and the
 * six-character bound is a real field constraint the pages can trip by pasting
 * a short string.
 */
function readCodeOrToken(data, { requirePassword = false } = {}) {
  const errors = {}
  const hasPair = data.email && data.code
  const email = data.email !== undefined
    ? emailField(data, 'email', errors, { required: false })
    : undefined
  const code = data.code !== undefined
    ? charField(data, 'code', errors, { required: false, minLength: 6, maxLength: 6 })
    : undefined
  const token = data.token !== undefined
    ? charField(data, 'token', errors, { required: false, minLength: 10, maxLength: 128 })
    : undefined
  const newPassword = requirePassword ? passwordField(data, 'new_password', errors) : undefined
  raiseIfInvalid(errors)

  if (!hasPair && !token) {
    const message = requirePassword
      ? 'Provide either {email, code, new_password} or {token, new_password}.'
      : 'Provide either {email, code} or {token}.'
    throw DemoApiError.validation({ non_field_errors: message })
  }
  return { email, code, token, newPassword }
}

register('POST', '/auth/verify-email/', (req) => {
  const { email, code, token } = readCodeOrToken(readBody(req.body))

  let user
  let reason
  if (token) {
    // Link mode resolves the user *from* the token, so an unknown link cannot
    // be distinguished from an expired one — hence its own wording.
    const row = store.verificationTokens
      .filter((entry) => entry.purpose === 'verify_email' && entry.token === token && !entry.used_at)
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0]
    if (!row) {
      throw new DemoApiError(400, 'Invalid or expired verification link.', {
        detail: 'Invalid or expired verification link.',
        code: 'invalid',
      })
    }
    user = userById(row.user_id)
    reason = verifyToken(user, 'verify_email', { token })
  } else {
    user = userByEmail(email)
    if (!user) {
      // Not enumerable: an unknown address answers exactly as a wrong code does.
      throw new DemoApiError(400, 'Invalid code.', { detail: 'Invalid code.', code: 'invalid' })
    }
    reason = verifyToken(user, 'verify_email', { code })
  }

  if (reason !== 'ok') throw codeError('verify_email', reason)

  user.email_verified = true
  const tokens = issueTokens(user)
  // The auto-login after verification: the page reads `user.role` off this and
  // routes to `/admin` or `/app` without a second trip through the login form.
  return { user: serializeUser(user), refresh: tokens.refresh, access: tokens.access }
}, { auth: 'public' })

/**
 * `ResendVerificationView` — deliberately non-enumerable. An unknown address,
 * an already-verified user and a request inside the thirty-second cooldown all
 * answer `{detail: 'OK'}`, and the page starts its own countdown regardless.
 *
 * `demo_code` therefore appears only when a code was really issued, which does
 * leak existence to anyone reading the response — an acceptable trade in a demo
 * whose entire user table is in the bundle, and the only way the flow can be
 * finished without a mailbox.
 */
register('POST', '/auth/verify-email/resend/', (req) => {
  const data = readBody(req.body)
  const errors = {}
  const email = emailField(data, 'email', errors)
  raiseIfInvalid(errors)

  const user = userByEmail(email)
  if (!user || user.email_verified || !canResend(user, 'verify_email')) {
    return { detail: 'OK' }
  }
  return { detail: 'OK', ...demoDisclosure(issueToken(user, 'verify_email')) }
}, { auth: 'public' })

/* ===================================================================== *
 *  Password reset
 * ===================================================================== */

register('POST', '/auth/password-reset/request/', (req) => {
  const data = readBody(req.body)
  const errors = {}
  const email = emailField(data, 'email', errors)
  raiseIfInvalid(errors)

  const user = userByEmail(email)
  if (!user || !canResend(user, 'password_reset')) return { detail: 'OK' }
  return { detail: 'OK', ...demoDisclosure(issueToken(user, 'password_reset')) }
}, { auth: 'public' })

/**
 * Step 1 of the two-step reset UI: is this code right, without spending it.
 *
 * The row has to survive so `/confirm/` can burn it a moment later; if it did
 * not, step 2 would fail for everyone who got step 1 right.
 */
register('POST', '/auth/password-reset/verify-code/', (req) => {
  const { email, code } = readCodeOrToken(readBody(req.body))
  if (!email || !code) {
    throw new DemoApiError(400, 'Email and code are required.', {
      detail: 'Email and code are required.',
      code: 'invalid',
    })
  }

  const user = userByEmail(email)
  if (!user) {
    throw new DemoApiError(400, 'Invalid code.', { detail: 'Invalid code.', code: 'invalid' })
  }

  const reason = checkCodeOnly(user, 'password_reset', code)
  if (reason !== 'ok') throw codeError('password_reset', reason)
  return { detail: 'Code accepted.' }
}, { auth: 'public' })

register('POST', '/auth/password-reset/confirm/', (req) => {
  const { email, code, token, newPassword } = readCodeOrToken(readBody(req.body), {
    requirePassword: true,
  })

  let user
  if (token) {
    const row = store.verificationTokens
      .filter((entry) => entry.purpose === 'password_reset' && entry.token === token && !entry.used_at)
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0]
    if (!row) {
      throw new DemoApiError(400, 'Invalid or expired reset link.', {
        detail: 'Invalid or expired reset link.',
        code: 'invalid',
      })
    }
    user = userById(row.user_id)
  } else {
    user = userByEmail(email)
    if (!user) {
      throw new DemoApiError(400, 'Invalid code.', { detail: 'Invalid code.', code: 'invalid' })
    }
  }

  // Guarded before the token is consumed, so someone who typed their existing
  // password can try again on the same code. The page depends on the ordering:
  // `same_password` keeps it on step 2 with the fields cleared, while an
  // invalid or expired code throws it back to step 1.
  if (user.password === newPassword) {
    const detail = 'New password must be different from your current password.'
    throw new DemoApiError(400, detail, { detail, code: 'same_password' })
  }

  const reason = verifyToken(user, 'password_reset', token ? { token } : { code })
  if (reason !== 'ok') throw codeError('password_reset', reason)

  user.password = newPassword
  user.updated_at = now()

  // Upstream this also blacklists every `OutstandingToken` for the user, kicking
  // their other devices. Not reproduced, and deliberately not half-reproduced:
  // the demo's tokens are stateless and there is no outstanding-token table to
  // walk, and the only session in play is this tab — the one that just reset the
  // password and is about to sign in with it.
  return { detail: 'Password reset successful. You can now sign in.' }
}, { auth: 'public' })

/* ===================================================================== *
 *  Profile
 *
 *  Registered as `auth: 'any'` rather than `'customer'`: upstream these are
 *  plain `IsAuthenticated` views, and `AuthContext` fetches the profile for
 *  admins too — an admin who reloads `/admin/orders` with no cached user would
 *  otherwise be signed straight back out.
 * ===================================================================== */

register('GET', '/auth/profile/', (req) => serializeUser(req.user), { auth: 'any' })

/**
 * `ProfileUpdateSerializer`. Three request shapes reach it: the JSON edit
 * modal, multipart carrying an avatar File, and multipart carrying
 * `avatar: ''` — which `to_internal_value` turns into None so the image is
 * cleared. Distinguishing "sent empty" from "not sent" is the whole of it,
 * which is why this reads `hasField()` rather than testing for a falsy value.
 */
register('PATCH', '/auth/profile/', (req) => {
  const user = req.user
  const data = readBody(req.body)
  const errors = {}

  if (hasField(req.body, 'first_name')) {
    const value = charField(data, 'first_name', errors, { maxLength: 100 })
    if (value !== undefined) user.first_name = value
  }
  if (hasField(req.body, 'last_name')) {
    const value = charField(data, 'last_name', errors, { maxLength: 100 })
    if (value !== undefined) user.last_name = value
  }
  if (hasField(req.body, 'phone_number')) {
    const value = phoneField(data, 'phone_number', errors)
    if (value !== undefined) user.phone_number = value
  }
  if (hasField(req.body, 'company_name')) {
    const value = charField(data, 'company_name', errors, {
      required: false, allowBlank: true, maxLength: 200,
    })
    if (value !== undefined) user.company_name = value
  }
  raiseIfInvalid(errors)

  // The one field the serializer refuses outright, and the only error body this
  // endpoint produces that the page could have rendered — except it does not:
  // every failure here shows a flat "could not update profile" toast.
  if (hasField(req.body, 'user_type') && data.user_type !== user.user_type) {
    throw fieldError('user_type', 'Account type can only be changed by an administrator.')
  }

  if (hasField(req.body, 'avatar')) {
    const value = data.avatar
    if (isUpload(value)) {
      // `register_file_cleanup` deleted the file an image field was replacing;
      // here that is a revoke of the previous object URL, and a no-op when the
      // previous value was a seeded media path rather than a blob.
      releaseObjectUrl(user.avatar)
      user.avatar = storeUpload(value)
    } else if (value === '' || value === null) {
      releaseObjectUrl(user.avatar)
      user.avatar = null
    }
  }

  user.updated_at = now()
  return serializeProfileUpdate(user)
}, { auth: 'any' })

/**
 * `ChangePasswordSerializer`. Both call sites render
 * `Object.values(body).flat()[0]`, so every failure has to be a dict of arrays;
 * a bare sentence would fall through to the generic toast.
 *
 * The forced-change path is the interesting one: `old_password` may be omitted
 * only while `must_change_password` is set, and success clears that flag —
 * which is precisely what releases `ForcePasswordChangeGuard` once the page
 * re-fetches the profile.
 */
register('POST', '/auth/profile/change-password/', (req) => {
  const user = req.user
  const data = readBody(req.body)

  const errors = {}
  const newPassword = passwordField(data, 'new_password', errors)
  const confirm = charField(data, 'confirm_password', errors)
  raiseIfInvalid(errors)

  const oldPassword = String(data.old_password ?? '')

  if (!user.must_change_password) {
    if (!oldPassword) throw fieldError('old_password', 'Current password is required.')
    if (oldPassword !== user.password) {
      throw fieldError('old_password', 'Current password is incorrect.')
    }
  }
  if (newPassword !== confirm) {
    throw fieldError('confirm_password', 'Passwords do not match.')
  }
  if (oldPassword && newPassword === oldPassword) {
    throw fieldError('new_password', 'New password must be different from the current one.')
  }

  user.password = newPassword
  user.must_change_password = false
  user.updated_at = now()
  return { detail: 'Password updated successfully.' }
}, { auth: 'any' })

/**
 * `ProfileStatsView`.
 *
 * `offer_sent` is not counted as active here, although the orders UI treats an
 * outstanding offer as very much live. The two numbers legitimately disagree
 * upstream and they disagree here for the same reason: this is the backend's
 * rule, copied, not the interface's.
 */
const PROFILE_ACTIVE = new Set(['new', 'under_review', 'approved', 'in_progress'])

register('GET', '/auth/profile/stats/', (req) => {
  const orders = ordersForUser(req.user.id)
  return {
    total_orders: orders.length,
    active_orders: orders.filter((order) => PROFILE_ACTIVE.has(order.status)).length,
    completed_orders: orders.filter((order) => order.status === 'completed').length,
    cancelled_orders: orders.filter((order) => order.status === 'cancelled').length,
  }
}, { auth: 'any' })

/**
 * A bare array, not a paginated envelope — the page does
 * `Array.isArray(data) ? data : []`, so wrapping this in `{results: [...]}`
 * would render as the empty state with no error to explain it.
 *
 * A personal account gets `[]` rather than a 403, so one profile page can serve
 * both account types without branching on the response.
 */
register('GET', '/auth/profile/contracts/', (req) => (
  req.user.user_type === 'company'
    ? contractsForUser(req.user.id).map(serializeContract)
    : []
), { auth: 'any' })

/* ===================================================================== *
 *  Admin — users
 * ===================================================================== */

function mustFindUser(req) {
  const user = userById(Number(req.path.id))
  if (!user) throw notFound('User not found.')
  return user
}

/**
 * The only list in this app that is genuinely filtered and paginated on the
 * server. Everything else the admin browses arrives whole and is narrowed in
 * the browser; this one honours `page`, `search`, `email_q`, `phone_q`, `role`,
 * `is_active` and `user_type`, because that is what `AdminUsersPage` sends and
 * what its pager counts against.
 *
 * `email_q` and `phone_q` exist alongside `search` rather than inside it so an
 * admin can scope to an address without the term also matching a name — the
 * generic `search` covers all four columns at once.
 */
register('GET', '/auth/admin/users/', (req) => {
  let rows = store.users

  rows = applySearch(rows, req.params, [
    (user) => user.email,
    (user) => user.first_name,
    (user) => user.last_name,
    (user) => user.phone_number,
  ])

  const emailQuery = (req.params.email_q ?? '').trim().toLowerCase()
  if (emailQuery) {
    rows = rows.filter((user) => user.email.toLowerCase().includes(emailQuery))
  }
  const phoneQuery = (req.params.phone_q ?? '').trim().toLowerCase()
  if (phoneQuery) {
    rows = rows.filter((user) => (user.phone_number ?? '').toLowerCase().includes(phoneQuery))
  }

  rows = applyFilters(rows, req.params, {
    role: (user) => user.role,
    is_active: (user) => user.is_active,
    user_type: (user) => user.user_type,
  })

  rows = applyOrdering(rows, req.params, {
    created_at: (user) => user.created_at,
    email: (user) => user.email,
    first_name: (user) => user.first_name,
  }, ['-created_at'])

  return paginate(rows, req.params, '/auth/admin/users/', serializeAdminUser)
}, { auth: 'admin' })

/**
 * `AdminCreateUserSerializer`. Unlike registration there is no
 * `confirm_password`, no terms gate and no case-insensitive duplicate check —
 * only the model's own unique validator, so two addresses differing in case
 * would both be accepted here and neither could then sign the other out.
 * Reproduced rather than tidied.
 */
register('POST', '/auth/admin/users/create/', (req) => {
  const data = readBody(req.body)

  const errors = {}
  const email = emailField(data, 'email', errors)
  const phone = phoneField(data, 'phone_number', errors)
  const firstName = charField(data, 'first_name', errors, { maxLength: 100 })
  const lastName = charField(data, 'last_name', errors, { maxLength: 100 })
  const companyName = charField(data, 'company_name', errors, {
    required: false, allowBlank: true, maxLength: 200,
  })
  const companyId = charField(data, 'company_id', errors, {
    required: false, allowBlank: true, maxLength: 11,
  })
  const personalId = charField(data, 'personal_id', errors, {
    required: false, allowBlank: true, minLength: 11, maxLength: 11,
  })
  const password = passwordField(data, 'password', errors)
  if (email && !errors.email && store.users.some((user) => user.email === email)) {
    errors.email = ['user with this email already exists.']
  }
  raiseIfInvalid(errors)

  const attrs = {
    user_type: data.user_type === 'company' ? 'company' : 'personal',
    company_name: companyName ?? '',
    company_id: companyId ?? '',
    personal_id: personalId ?? '',
  }
  validateIdentity(attrs)

  const stamp = now()
  const user = {
    id: nextId('users'),
    email,
    password,
    phone_number: phone ?? '',
    user_type: attrs.user_type,
    company_name: attrs.company_name,
    company_id: attrs.company_id,
    personal_id: attrs.personal_id,
    first_name: firstName,
    last_name: lastName,
    avatar: null,
    role: data.role === 'admin' ? 'admin' : 'customer',
    is_active: booleanField(data.is_active, true),
    is_staff: data.role === 'admin',
    // An admin-created account skips the code screen entirely: nobody sent it a
    // verification email, and `create_user` leaves the flag at its default.
    // That is why `mark-verified` and `resend-verification` exist.
    email_verified: false,
    must_change_password: false,
    accepted_terms_at: null,
    last_login: null,
    created_at: stamp,
    updated_at: stamp,
  }
  store.users.push(user)
  return serializeCreatedUser(user)
}, { auth: 'admin' })

/**
 * The payload `AdminUserFormPage` feeds straight into
 * `form.setFieldsValue(data)`. Every field on that form must come back as a
 * key — see `serializeAdminUser`.
 */
register('GET', '/auth/admin/users/:id/', (req) => serializeAdminUser(mustFindUser(req)), {
  auth: 'admin',
})

/**
 * A partial update, and partial is the operative word: the list page's
 * enable/disable switch PATCHes `{is_active}` alone. `AdminUserSerializer.validate`
 * still re-runs the whole identity rule against the *effective* values — the
 * ones in the payload where present, the row's own otherwise — so toggling a
 * company account off will 400 if that account is missing its nine-digit
 * company ID. Faithful, and worth knowing about when seeding.
 */
register('PATCH', '/auth/admin/users/:id/', (req) => {
  const user = mustFindUser(req)
  const data = readBody(req.body)
  const errors = {}

  const patch = {}
  if (hasField(req.body, 'email')) patch.email = emailField(data, 'email', errors)
  if (hasField(req.body, 'phone_number')) patch.phone_number = phoneField(data, 'phone_number', errors)
  if (hasField(req.body, 'first_name')) {
    patch.first_name = charField(data, 'first_name', errors, { maxLength: 100 })
  }
  if (hasField(req.body, 'last_name')) {
    patch.last_name = charField(data, 'last_name', errors, { maxLength: 100 })
  }
  if (hasField(req.body, 'company_name')) {
    patch.company_name = charField(data, 'company_name', errors, {
      required: false, allowBlank: true, maxLength: 200,
    })
  }
  if (hasField(req.body, 'company_id')) {
    patch.company_id = charField(data, 'company_id', errors, {
      required: false, allowBlank: true, maxLength: 11,
    })
  }
  if (hasField(req.body, 'personal_id')) {
    const raw = data.personal_id
    patch.personal_id = raw === null || raw === '' ? null : String(raw).trim()
    // `validate_personal_id` is a *field* validator, so its messages arrive as
    // arrays and alongside any other field's — unlike everything `validate()`
    // raises below, which stops at the first problem.
    if (patch.personal_id !== null) {
      if (!/^\d{11}$/.test(patch.personal_id)) {
        errors.personal_id = ['Personal ID must be exactly 11 digits.']
      } else if (personalIdTaken(patch.personal_id, user.id)) {
        errors.personal_id = ['This personal ID is already registered.']
      }
    }
  }
  if (hasField(req.body, 'role')) patch.role = data.role === 'admin' ? 'admin' : 'customer'
  if (hasField(req.body, 'user_type')) {
    patch.user_type = data.user_type === 'company' ? 'company' : 'personal'
  }
  if (hasField(req.body, 'is_active')) patch.is_active = booleanField(data.is_active, user.is_active)
  raiseIfInvalid(errors)

  const effective = {
    user_type: patch.user_type ?? user.user_type,
    company_name: patch.company_name ?? user.company_name,
    company_id: patch.company_id ?? user.company_id,
    personal_id: patch.personal_id ?? user.personal_id,
  }
  validateIdentity(effective, {
    exceptId: user.id,
    // The admin serializer words this one differently from the register path.
    companyNameMessage: 'Company name is required for company accounts.',
  })
  patch.personal_id = effective.personal_id

  Object.assign(user, patch)
  if (patch.role === 'admin') user.is_staff = true
  user.updated_at = now()
  return serializeAdminUser(user)
}, { auth: 'admin' })

/**
 * The legacy "admin types the new password" flow, kept for users whose email is
 * broken. Its side effect is the only way anyone enters
 * `/force-password-change`, which is why the seed also carries one account
 * already flagged.
 */
register('POST', '/auth/admin/users/:id/reset-password/', (req) => {
  const target = mustFindUser(req)
  const data = readBody(req.body)
  const errors = {}
  const newPassword = passwordField(data, 'new_password', errors)
  raiseIfInvalid(errors)

  target.password = newPassword
  target.must_change_password = true
  target.updated_at = now()
  return { detail: 'Password reset. User must change it on next login.' }
}, { auth: 'admin' })

/** Support's escape hatch for "I never got the email". */
register('POST', '/auth/admin/users/:id/mark-verified/', (req) => {
  const target = mustFindUser(req)
  if (target.email_verified) {
    throw new DemoApiError(400, 'Already verified.')
  }
  target.email_verified = true
  target.updated_at = now()
  return { detail: 'User marked as verified.' }
}, { auth: 'admin' })

/** Admin-initiated, so the per-user thirty-second cooldown does not apply — a
 *  support call must not be blocked by the caller's own recent attempt. */
register('POST', '/auth/admin/users/:id/resend-verification/', (req) => {
  const target = mustFindUser(req)
  if (target.email_verified) {
    throw new DemoApiError(400, 'User is already verified.')
  }
  return { detail: 'Verification email sent.', ...demoDisclosure(issueToken(target, 'verify_email')) }
}, { auth: 'admin' })

/**
 * The default flow on the user management page: the admin triggers the email
 * and never learns the password, because the user picks it themselves on the
 * same two-step reset screen a customer would use.
 */
register('POST', '/auth/admin/users/:id/send-password-reset/', (req) => {
  const target = mustFindUser(req)
  if (!target.is_active) {
    throw new DemoApiError(400, 'Cannot send password reset to an inactive user.')
  }
  return {
    detail: 'Password reset email sent.',
    ...demoDisclosure(issueToken(target, 'password_reset')),
  }
}, { auth: 'admin' })

/* ===================================================================== *
 *  Admin — company contracts
 * ===================================================================== */

const CONTRACT_EXTENSIONS = new Set([
  'pdf', 'doc', 'docx', 'odt', 'rtf', 'txt', 'jpg', 'jpeg', 'png', 'webp',
])
const MAX_CONTRACT_SIZE = 20 * 1024 * 1024

/** A bare array again, and again ordered newest first. */
register('GET', '/auth/admin/users/:id/contracts/', (req) => (
  contractsForUser(mustFindUser(req).id).map(serializeContract)
), { auth: 'admin' })

register('POST', '/auth/admin/users/:id/contracts/', (req) => {
  const target = mustFindUser(req)
  // Checked before the file is looked at, so an admin who picked the wrong row
  // is told why rather than being told their PDF is unacceptable.
  if (target.user_type !== 'company') {
    throw new DemoApiError(400, 'Contracts can only be uploaded for company users.')
  }

  const data = readBody(req.body)
  const document = data.document
  if (!isUpload(document)) {
    throw DemoApiError.validation({ document: 'No file was uploaded.' })
  }
  const filename = document.name ?? ''
  const extension = filename.includes('.') ? filename.split('.').pop().toLowerCase() : ''
  if (!CONTRACT_EXTENSIONS.has(extension)) {
    throw DemoApiError.validation({
      document: 'Unsupported file type. Allowed: PDF, DOC, DOCX, ODT, RTF, TXT, JPG, PNG, WEBP.',
    })
  }
  if (document.size > MAX_CONTRACT_SIZE) {
    throw DemoApiError.validation({ document: 'File exceeds the 20MB limit.' })
  }

  const title = String(data.title ?? '').trim()
  const row = {
    id: nextId('companyContracts'),
    user_id: target.id,
    // No disk and no Spaces bucket: the "path" is an object URL, which the
    // download button opens in a new tab exactly as it would a real file.
    document: storeUpload(document),
    // The visible label drops the extension, so a picked file reads as
    // "Service Agreement" rather than "Service Agreement.pdf".
    title: title || filename.replace(/\.[^.]+$/, '') || 'Contract',
    original_filename: filename,
    file_size: document.size ?? 0,
    uploaded_by: req.user.id,
    created_at: now(),
  }
  store.companyContracts.push(row)
  return serializeContract(row)
}, { auth: 'admin' })

/**
 * Scoped by user as well as by id, so a contract id guessed from another
 * account resolves to nothing rather than to someone else's document.
 */
register('DELETE', '/auth/admin/users/:id/contracts/:contractId/', (req) => {
  const userId = Number(req.path.id)
  const contractId = Number(req.path.contractId)
  const index = store.companyContracts.findIndex(
    (row) => row.id === contractId && row.user_id === userId,
  )
  if (index < 0) throw notFound('Contract not found.')

  // `FileField` cleanup: the row and its file go together.
  releaseObjectUrl(store.companyContracts[index].document)
  store.companyContracts.splice(index, 1)
}, { auth: 'admin' })

/* ===================================================================== *
 *  Admin — dashboard
 * ===================================================================== */

/** `AdminDashboardStatsView`. Every number is counted over the live store, so a
 *  status an admin changes on one screen has moved the tiles on the other by
 *  the time they navigate back. */
register('GET', '/auth/admin/dashboard/', () => {
  const orders = store.orders
  const users = store.users
  const countStatus = (status) => orders.filter((order) => order.status === status).length

  const openStatuses = new Set(['new', 'under_review', 'approved', 'in_progress'])
  const openOrders = orders.filter((order) => openStatuses.has(order.status))

  // Seven days ending today, inclusive, bucketed in Tbilisi — the same day
  // boundary the date filters and the order list draw, so "3 today" on the
  // chart and "3 today" in the table are the same three orders.
  const today = todayKey()
  const weekStart = shiftDayKey(today, -6)
  const prevWeekStart = shiftDayKey(weekStart, -7)

  const dailyTrend = []
  for (let offset = 0; offset < 7; offset += 1) {
    const day = shiftDayKey(weekStart, offset)
    const placed = orders.filter((order) => dateKey(order.created_at) === day)
    dailyTrend.push({
      date: day,
      total: placed.length,
      completed: placed.filter((order) => order.status === 'completed').length,
    })
  }

  const placedSince = (from, before) => orders.filter((order) => {
    const key = dateKey(order.created_at)
    return key >= from && (before === undefined || key < before)
  }).length

  return {
    total_users: users.length,
    active_users: users.filter((user) => user.is_active).length,
    new_orders: countStatus('new'),
    under_review_orders: countStatus('under_review'),
    approved_orders: countStatus('approved'),
    in_progress_orders: countStatus('in_progress'),
    // Note the asymmetry with `open_urgency` below and with the profile stats
    // above: this one excludes 'new'. Three definitions of "active" in one
    // codebase, all deliberate upstream.
    active_orders: orders.filter(
      (order) => ['under_review', 'approved', 'in_progress'].includes(order.status),
    ).length,
    completed_orders: countStatus('completed'),
    rejected_orders: countStatus('rejected'),
    cancelled_orders: countStatus('cancelled'),
    total_orders: orders.length,
    total_vehicles: store.vehicles.length,
    total_drivers: store.drivers.length,
    open_urgency: {
      low: openOrders.filter((order) => order.urgency === 'low').length,
      normal: openOrders.filter((order) => order.urgency === 'normal').length,
      high: openOrders.filter((order) => order.urgency === 'high').length,
      urgent: openOrders.filter((order) => order.urgency === 'urgent').length,
    },
    daily_trend: dailyTrend,
    current_week_total: placedSince(weekStart),
    prev_week_total: placedSince(prevWeekStart, weekStart),
  }
}, { auth: 'admin' })
