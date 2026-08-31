/**
 * Tokens.
 *
 * Upstream this is SimpleJWT: a 60-minute access token, a 7-day refresh token,
 * rotation with blacklisting. Here the tokens are shaped like real JWTs —
 * three base64url segments, a readable payload, an `exp` that is actually
 * enforced — and signed with the literal string `demo`.
 *
 * That is not a shortcut, it is the honest design. A JWT is *stateless*: the
 * server keeps no session row, it just reads the claims and trusts the
 * signature. So a token minted before a reload still names a real user
 * afterwards, which is why the demo keeps you signed in across a refresh while
 * the data underneath resets to the pristine seed — precisely what a real JWT
 * does across a server restart. There is nothing to forge, either: the
 * "server" is a function call in the same tab, and anyone who wants to be an
 * admin can simply click the admin account on the login screen.
 *
 * Rotation is reproduced (a used refresh token is blacklisted, and the
 * blacklist is per-tab like everything else), because the app's axios
 * interceptor stores whatever `refresh` comes back and would quietly break if
 * that field ever went missing.
 */
import { store } from './store'

const ACCESS_TTL_MS = 60 * 60 * 1000 // SIMPLE_JWT ACCESS_TOKEN_LIFETIME
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000 // REFRESH_TOKEN_LIFETIME

/** Refresh tokens already spent by a rotation. Cleared with the store. */
const blacklist = new Set()

/* ------------------------------------------------------------- base64url */

function encode(payload) {
  const json = JSON.stringify(payload)
  // `unescape(encodeURIComponent(…))` is the standard way to get btoa to
  // accept non-Latin-1 text; a Georgian name in a claim would break it
  // otherwise.
  const binary = unescape(encodeURIComponent(json))
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decode(segment) {
  try {
    const padded = segment.replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
    return JSON.parse(decodeURIComponent(escape(binary)))
  } catch {
    return null
  }
}

const HEADER = encode({ alg: 'none', typ: 'JWT' })

/* ---------------------------------------------------------------- minting */

let jti = 1

function mint(user, type, ttl) {
  const now = Date.now()
  const payload = {
    token_type: type,
    // SimpleJWT's default claim for the primary key.
    user_id: user.id,
    // Not something SimpleJWT ships, but the demo has no user endpoint to
    // consult before the gate runs and this keeps role checks honest.
    role: user.role,
    exp: Math.floor((now + ttl) / 1000),
    iat: Math.floor(now / 1000),
    // eslint-disable-next-line no-plusplus
    jti: `demo-${jti++}`,
  }
  return `${HEADER}.${encode(payload)}.demo`
}

/** The pair `/auth/login/`, `/auth/verify-email/` and a rotation hand back. */
export function issueTokens(user) {
  return {
    access: mint(user, 'access', ACCESS_TTL_MS),
    refresh: mint(user, 'refresh', REFRESH_TTL_MS),
  }
}

/* --------------------------------------------------------------- reading */

function claims(token) {
  if (typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 3) return null

  const payload = decode(parts[1])
  if (!payload || typeof payload.user_id !== 'number') return null
  if (typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now()) return null
  return payload
}

/**
 * The user a bearer token names, or null. Resolving through the store rather
 * than trusting the claim is what makes a token for a deleted user read as
 * signed out, the way `JWTAuthentication` raises when the row is gone.
 */
export function userForAccessToken(token) {
  const payload = claims(token)
  if (!payload || payload.token_type !== 'access') return null
  return store.users.find((user) => user.id === payload.user_id && user.is_active) ?? null
}

/** As above for the refresh endpoint, honouring the rotation blacklist. */
export function userForRefreshToken(token) {
  const payload = claims(token)
  if (!payload || payload.token_type !== 'refresh') return null
  if (blacklist.has(payload.jti)) return null
  return store.users.find((user) => user.id === payload.user_id && user.is_active) ?? null
}

/** ROTATE_REFRESH_TOKENS + BLACKLIST_AFTER_ROTATION: a spent token is dead. */
export function blacklistRefreshToken(token) {
  const payload = claims(token)
  if (payload?.jti) blacklist.add(payload.jti)
}

export function clearBlacklist() {
  blacklist.clear()
}
