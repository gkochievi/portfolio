/**
 * Tokens.
 *
 * Upstream this is django-ninja-jwt: a 30-minute access token, a 7-day refresh
 * token, both signed with `SECRET_KEY`. Here the tokens are shaped like real JWTs
 * — three base64url segments, a readable payload, an `exp` that is genuinely
 * enforced — and "signed" with the literal string `demo`.
 *
 * That is not a shortcut, it is the honest design. A JWT is *stateless*: the
 * server keeps no session row, it reads the claims and trusts the signature. So
 * the gate in `router.ts` can be the real gate, `exp` can really expire, and a
 * token naming a deactivated user can really read as signed out — all without a
 * session table. There is nothing to forge either: the "server" is a function
 * call in the same tab, and anyone who wants to be an admin can click the admin
 * button on the banner.
 *
 * **Rotation is not reproduced, because upstream does not rotate.** `SIMPLE_JWT`'s
 * `ROTATE_REFRESH_TOKENS` never comes into play: `/api/auth/refresh` is
 * hand-written in `accounts/api.py` and answers `{"access": …}` alone, leaving the
 * caller holding the refresh token it started with. So there is no blacklist in
 * this file — an absence, not an omission.
 *
 * The tokens themselves live only in the two module-level variables inside
 * `src/lib/api.ts`'s `tokenStore`, never in `localStorage` or `sessionStorage`.
 * A reload therefore signs you out, which is the honest reading of "session-only
 * state" — and it is also what a real JWT would do if the tab had never written
 * one down.
 */

import { CLOCK, MINUTE } from './base';
import { store } from './store';
import type { Role, UserRow } from './types';

/** `SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"] = timedelta(minutes=30)`. */
const ACCESS_TTL_MS = 30 * MINUTE;

/** `SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"] = timedelta(days=7)`. */
const REFRESH_TTL_MS = 7 * 24 * 60 * MINUTE;

type TokenType = 'access' | 'refresh';

/** The claims django-ninja-jwt writes, plus `role`. See `mint()` for why `role` is there. */
interface Claims {
  token_type: TokenType;
  user_id: number;
  role: Role;
  /** Seconds, not milliseconds — JWT's unit, and the reason for the `* 1000` on the way back. */
  exp: number;
  iat: number;
  jti: string;
}

// --------------------------------------------------------------------------- //
//  base64url
//
//  `btoa` only accepts Latin-1, and half the payloads this demo could carry are
//  Georgian, so the JSON goes through `TextEncoder` and back rather than through
//  the old `unescape(encodeURIComponent(…))` trick — same result, no deprecated
//  globals, and it survives `strict` without a cast.
// --------------------------------------------------------------------------- //

function encodeSegment(payload: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeSegment(segment: string): unknown {
  try {
    const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

/**
 * `alg: "none"` rather than a `HS256` the third segment does not honour. A header
 * that claims an algorithm nobody ran is a small lie in a place people paste into
 * jwt.io; this one says plainly what it is.
 */
const HEADER = encodeSegment({ alg: 'none', typ: 'JWT' });

// --------------------------------------------------------------------------- //
//  Minting
// --------------------------------------------------------------------------- //

/** A counter, not a random id: this mock has no `Math.random()` anywhere. */
let jtiCounter = 0;

function mint(user: UserRow, type: TokenType, ttlMs: number): string {
  const now = CLOCK.now();
  const claims: Claims = {
    token_type: type,
    // django-ninja-jwt's `USER_ID_CLAIM`.
    user_id: user.id,
    // Not a claim upstream ships. It is here because a token is readable in the
    // console, and a demo whose payload says which role it carries explains a
    // 403 better than one that does not. The gate never trusts it: `router.ts`
    // resolves the row and reads `role` off the store.
    role: user.role,
    exp: Math.floor((now + ttlMs) / 1000),
    iat: Math.floor(now / 1000),
    jti: `demo-${(jtiCounter += 1)}`,
  };
  return `${HEADER}.${encodeSegment(claims)}.demo`;
}

/** The pair `/auth/login` and `/auth/register` hand back under `tokens`. */
export function issueTokens(user: UserRow): { access: string; refresh: string } {
  return {
    access: mint(user, 'access', ACCESS_TTL_MS),
    refresh: mint(user, 'refresh', REFRESH_TTL_MS),
  };
}

/**
 * `/auth/refresh` answers with `{access}` and nothing else — the hand-written
 * endpoint upstream returns `str(RefreshToken(...).access_token)` alone, and
 * `api.ts::tryRefresh` re-stores the refresh token it already had. Returning a
 * second, rotated refresh token here would be inventing a field the caller does
 * not read.
 */
export function issueAccessToken(user: UserRow): string {
  return mint(user, 'access', ACCESS_TTL_MS);
}

// --------------------------------------------------------------------------- //
//  Reading
// --------------------------------------------------------------------------- //

function claimsOf(token: string | null | undefined): Claims | null {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const payload = decodeSegment(parts[1]);
  if (!payload || typeof payload !== 'object') return null;
  const candidate = payload as Partial<Claims>;
  if (typeof candidate.user_id !== 'number') return null;
  // The one claim that is actually enforced. Seconds → milliseconds.
  if (typeof candidate.exp === 'number' && candidate.exp * 1000 <= CLOCK.now()) return null;
  return candidate as Claims;
}

/**
 * Resolving through the store rather than trusting the claim is what makes a
 * token for a user an admin has just deactivated read as signed out on the very
 * next request — which is exactly what `JWTAuth.get_user` does when the row it
 * fetches fails `is_active`. Without it, deactivating a signed-in colleague would
 * be a no-op until their token expired.
 */
export function userForAccessToken(token: string | null): UserRow | null {
  const claims = claimsOf(token);
  if (!claims || claims.token_type !== 'access') return null;
  return store.users.find((user) => user.id === claims.user_id && user.is_active) ?? null;
}

/** The same for `/auth/refresh`. No blacklist to consult — see the module note. */
export function userForRefreshToken(token: string | null): UserRow | null {
  const claims = claimsOf(token);
  if (!claims || claims.token_type !== 'refresh') return null;
  return store.users.find((user) => user.id === claims.user_id && user.is_active) ?? null;
}
