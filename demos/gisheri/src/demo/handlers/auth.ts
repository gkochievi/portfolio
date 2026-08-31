/**
 * `/auth/*` — a port of `accounts/api.py`: register, login, refresh, the session
 * probe, the profile PATCH, change-password, the forgot/reset pair, and a logout
 * that does nothing. Nine routes, all of them in `../routes.md` §1.
 *
 * ## What is different here, and why
 *
 * 1. **Passwords are compared in plain text** against `UserRow.password`. Django
 *    stores a PBKDF2 hash and `check_password()` is deliberately slow; there is
 *    nothing to protect when the server is a function call in the same tab and
 *    the demo banner will sign you in as an administrator on request. The
 *    observable contract — right password 2xx, wrong password 401
 *    `invalid_credentials` — is identical.
 *
 * 2. **The reset email is printed to the console.** Django's dev configuration is
 *    `console.EmailBackend`, which does exactly this: a developer completing a
 *    reset against the real backend reads the link out of the runserver log.
 *    A browser tab has no inbox, so without it the flow would be unwalkable. The
 *    200 body is unchanged, the one-hour TTL is real, and the token is a real
 *    64-character URL-safe string.
 *
 * 3. **Nothing is ever blacklisted.** Upstream does not blacklist either:
 *    `SIMPLE_JWT["BLACKLIST_AFTER_ROTATION"]` is false, `/auth/logout` is
 *    documented in its own docstring as existing "for symmetry", and changing a
 *    password leaves every outstanding token valid. All three are reproduced as
 *    the no-ops they are.
 *
 * ## The one asymmetry worth knowing about
 *
 * `register` matches an existing account **case-insensitively** (`email__iexact`)
 * and `login` matches **case-sensitively** — because login goes through Django's
 * `ModelBackend`, which calls `get_by_natural_key()`, which is a plain `=`. So an
 * account created as `Ana@gmail.com` cannot be re-registered as `ana@gmail.com`,
 * but neither can it be signed into as `ana@gmail.com`. That is upstream's
 * behaviour, not a slip, and it is why this module uses `userByEmail()` in one
 * place and a bare comparison in the other. The **domain** half escapes it
 * entirely — see `readNormalizedEmail`.
 *
 * Wire keys are **camelCase** (`firstName`, `currentPassword`): `CamelSchema` sets
 * `alias_generator=to_camel`, and every call site in `src/lib` and
 * `src/context/auth.tsx` sends the alias. `populate_by_name=True` means Ninja
 * would also accept the snake_case spelling, but nothing sends it, so the readers
 * below name the alias alone.
 */

import {
  CLOCK,
  bodyOf,
  fail,
  nowIso,
  nowIsoOffset,
  parseIso,
  readEmail,
  readString,
  unauthorized,
} from '../base';
import { APP_BASE } from '../base-path';
import { issueAccessToken, issueTokens, userForRefreshToken } from '../auth-tokens';
import { register } from '../router';
import type { DemoRequest } from '../router';
import { serializeUser } from '../serialize';
import type { UserOut } from '../serialize';
import {
  PASSWORD_RESET_TTL_MS,
  nextId,
  store,
  syncRoleFlags,
  userByEmail,
  userById,
} from '../store';
import type { UserRow } from '../types';

/** `accounts/schemas.py::MessageOut` — the one-key body four of these routes answer with. */
interface MessageOut {
  detail: string;
}

/** `accounts/schemas.py::AuthResponse`. `register` and `login` answer with exactly this. */
interface AuthResponseOut {
  user: UserOut;
  tokens: { access: string; refresh: string };
}

/**
 * The gate has already run — an `auth: 'any'` route cannot reach a handler with a
 * null user — so this narrows the type rather than deciding anything. It throws
 * the gate's own 401 instead of asserting, so a route registered `'public'` by
 * mistake answers `Unauthorized` rather than crashing on `null.first_name`.
 */
function signedInUser(request: DemoRequest): UserRow {
  if (!request.user) throw unauthorized();
  return request.user;
}

/**
 * `EmailStr`, including the half of it that is easy to miss.
 *
 * Pydantic hands the address to `email-validator` and keeps the **normalised**
 * form it gives back: the domain lower-cased, the local part left exactly as
 * typed, because the local part is case-sensitive by RFC and neither library will
 * guess. Django's `BaseUserManager.normalize_email` then does the same thing
 * again inside `create_user`, by which time it is a no-op.
 *
 * Simplifying it to `.toLowerCase()` would be wrong in both directions, and it
 * shows at exactly one place: `login` compares with `=`, so `demo@GISHERI.GE`
 * signs in and `DEMO@gisheri.ge` does not. The stored casing is also what the
 * admin user list renders.
 */
function readNormalizedEmail(body: Record<string, unknown>, key: string): string {
  const value = readEmail(body, key, { required: true });
  const at = value.lastIndexOf('@');
  // Unreachable — `EMAIL_PATTERN` has already insisted on an `@` — but a bare
  // `slice(at + 1)` on a -1 would quietly mangle the address rather than fail.
  if (at < 0) return value;
  return `${value.slice(0, at)}@${value.slice(at + 1).toLowerCase()}`;
}

// --------------------------------------------------------------------------- //
//  POST /auth/register
// --------------------------------------------------------------------------- //

/**
 * Always creates a `customer`. `role` is not settable through any auth endpoint —
 * `RegisterIn` does not declare it, and Pydantic drops what it was not asked
 * about — so a body that tries to promote itself is created as a customer with a
 * 201 and no complaint.
 *
 * Field order matters and is not the order the view reads in. Pydantic validates
 * the whole model before the view runs a single query, so a request carrying both
 * a malformed email and an already-taken address reports the 422, never
 * `email_taken`. Within the model the fields are checked in declaration order,
 * because only the first failure is reported.
 */
register(
  'POST',
  '/auth/register',
  (request): AuthResponseOut => {
    const body = bodyOf(request);

    const email = readNormalizedEmail(body, 'email');
    const password = readString(body, 'password', { required: true, min: 8, max: 128 });
    const firstName = readString(body, 'firstName', { max: 150 });
    const lastName = readString(body, 'lastName', { max: 150 });

    // `User.objects.filter(email__iexact=…).exists()` — case-insensitive over the
    // whole address, so an existing `Ana@gmail.com` blocks `ana@gmail.com` too.
    // This is the check `login` does **not** do; see the module note.
    if (userByEmail(email)) throw fail('email_taken');

    const user: UserRow = {
      id: nextId('users'),
      // Plain text. See the module note.
      password,
      email,
      first_name: firstName,
      last_name: lastName,
      role: 'customer',
      is_active: true,
      is_staff: false,
      is_superuser: false,
      // `date_joined` is `default=timezone.now`, so it is stamped on create; the
      // `+00:00` shape is what `AdminUserOut` renders for this column and the
      // seed's own rows carry it too.
      date_joined: nowIsoOffset(),
      // Never written by this API: the views mint tokens rather than calling
      // `django.contrib.auth.login()`, and nothing here updates last_login.
      last_login: null,
    };
    // `User.save()` recomputes `is_staff` / `is_superuser` from `role` on every
    // write. Calling the port of that keeps the new row honest even though a
    // customer's flags are both false either way.
    syncRoleFlags(user);
    store.users.push(user);

    // 201 upstream; the seam sees a body rather than a status, so the difference
    // from `login`'s 200 is invisible on this side of the wire.
    return { user: serializeUser(user), tokens: issueTokens(user) };
  },
  { auth: 'public' },
);

// --------------------------------------------------------------------------- //
//  POST /auth/login
// --------------------------------------------------------------------------- //

/**
 * One answer for three different failures — unknown address, wrong password,
 * deactivated account — because any distinction between them is an
 * account-existence oracle. `authenticate()` returns `None` for the first two and
 * for the third (`ModelBackend.user_can_authenticate` tests `is_active`), and the
 * view then tests `is_active` a second time for good measure.
 *
 * A malformed address never reaches any of that: `LoginIn.email` is an `EmailStr`,
 * so it is a 422 from Pydantic and reads in the UI as `Request failed (422)`.
 */
register(
  'POST',
  '/auth/login',
  (request): AuthResponseOut => {
    const body = bodyOf(request);
    const email = readNormalizedEmail(body, 'email');
    const password = readString(body, 'password', { required: true });

    // Case-**sensitive**, unlike everywhere else in this file: `ModelBackend`
    // calls `UserModel._default_manager.get_by_natural_key(username)`, which is a
    // plain `email = …` lookup. See the module note.
    const user = store.users.find((row) => row.email === email);
    if (!user || !user.is_active || user.password !== password) {
      throw fail('invalid_credentials');
    }

    return { user: serializeUser(user), tokens: issueTokens(user) };
  },
  { auth: 'public' },
);

// --------------------------------------------------------------------------- //
//  POST /auth/refresh
// --------------------------------------------------------------------------- //

/**
 * `{access}` and nothing else — **no rotation**, no second refresh token.
 * `ROTATE_REFRESH_TOKENS` is on in `SIMPLE_JWT`, but this endpoint is
 * hand-written and answers `str(RefreshToken(payload.refresh).access_token)`,
 * so the setting never comes into play and the caller keeps the refresh token it
 * arrived with. `api.ts::tryRefresh` re-stores exactly that.
 *
 * **Registered `'public'` on purpose.** A refresh has to work precisely when the
 * access token is the thing that expired, so the seam sends this one request with
 * `token: null`. If this route required a session, every silent refresh would
 * become a sign-out.
 *
 * One deliberate divergence: upstream mints the new access token from the refresh
 * token's claims without touching the database, so a *deactivated* user's refresh
 * still yields an access token — which then 401s at `JWTAuth.get_user` on the very
 * next call. Here `userForRefreshToken` resolves through the store, so the 401
 * lands one request earlier. Both end signed out; only the console log differs.
 */
register(
  'POST',
  '/auth/refresh',
  (request): { access: string } => {
    const body = bodyOf(request);
    const refresh = readString(body, 'refresh', { required: true });

    const user = userForRefreshToken(refresh);
    // django-ninja-jwt's own wording, carried through `str(exc)` — deliberately
    // not the same sentence as the other two 401s.
    if (!user) throw fail('invalid_refresh');

    return { access: issueAccessToken(user) };
  },
  { auth: 'public' },
);

// --------------------------------------------------------------------------- //
//  GET /auth/me  ·  PATCH /auth/me
// --------------------------------------------------------------------------- //

/**
 * The session probe. `AuthProvider.refresh()` mounts it on every page load and
 * handles exactly two outcomes: a `UserOut`, or an `ApiError` with `status === 401`
 * which it treats as "signed out". **Anything else it rethrows**, straight into an
 * unhandled promise rejection inside a `useEffect` — so this route must be a 200
 * or a clean 401 and can never be allowed to become a 500.
 */
register('GET', '/auth/me', (request): UserOut => serializeUser(signedInUser(request)));

/**
 * Exactly two editable fields, and **both are always written**.
 *
 * `ProfileUpdateIn` declares `first_name` and `last_name` with a default of `""`
 * and the view assigns both unconditionally — it is not a partial update despite
 * the verb. A body carrying only `{firstName: 'Ana'}` therefore *blanks* the
 * surname. `AccountPage` always sends both, which is why nobody has ever noticed;
 * reproducing it matters because the admin user editor is a different endpoint
 * with different semantics and the two are easy to conflate.
 *
 * `email`, `role` and `is_active` are dropped in silence rather than rejected —
 * the schema does not declare them — so a body that tries to promote its own
 * account returns 200 with the role unchanged.
 */
register('PATCH', '/auth/me', (request): UserOut => {
  const user = signedInUser(request);
  const body = bodyOf(request);

  user.first_name = readString(body, 'firstName', { max: 150 });
  user.last_name = readString(body, 'lastName', { max: 150 });

  return serializeUser(user);
});

// --------------------------------------------------------------------------- //
//  POST /auth/me/password
// --------------------------------------------------------------------------- //

/**
 * Order matters and is not the order it reads in: `new_password`'s length bounds
 * are a Pydantic field constraint, so they are checked before the view has looked
 * at `current_password` at all. A request with a wrong current password *and* a
 * six-character new one answers 422, not `current_password_wrong`.
 *
 * Existing tokens stay valid — upstream calls `set_password` and saves, and
 * nothing blacklists. So the caller stays signed in and so does every other tab.
 */
register('POST', '/auth/me/password', (request): MessageOut => {
  const user = signedInUser(request);
  const body = bodyOf(request);

  const currentPassword = readString(body, 'currentPassword', { required: true });
  const newPassword = readString(body, 'newPassword', { required: true, min: 8, max: 128 });

  if (user.password !== currentPassword) throw fail('current_password_wrong');

  user.password = newPassword;
  return { detail: 'Password changed.' };
});

// --------------------------------------------------------------------------- //
//  POST /auth/password/reset
// --------------------------------------------------------------------------- //

/**
 * `secrets.token_urlsafe(48)` — 48 bytes of base64url, which is 64 characters.
 *
 * A counter walked through xorshift32 rather than a random source: this mock has
 * no `Math.random()` anywhere, because a demo does not need entropy nobody can
 * check — it needs a token that differs from the last one and a run that
 * reproduces exactly, so a console screenshot still matches the flow it came
 * from. The alphabet is base64url's, minus nothing: `-` and `_` are URL-safe and
 * `useSearchParams` hands them back untouched.
 */
const TOKEN_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

let tokenTick = 0;

function nextResetToken(): string {
  tokenTick += 1;
  // Any non-zero seed will do; xorshift is only ever zero if it starts there.
  let state = ((tokenTick * 0x9e3779b1) >>> 0) || 1;
  let token = '';
  for (let index = 0; index < 64; index += 1) {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    token += TOKEN_ALPHABET[state % TOKEN_ALPHABET.length];
  }
  return token;
}

/**
 * `settings.FRONTEND_BASE_URL` was the origin the SPA was served from, and here
 * the SPA *is* this tab — so the link is built against the deploy base rather
 * than a hard-coded origin. `APP_BASE` carries the `#` under hash routing, so the
 * one expression produces a link that works for either router.
 */
function resetLink(token: string): string {
  return `${window.location.origin}${APP_BASE}/reset-password?token=${token}`;
}

/**
 * **Always 200, always the same sentence** — a known address, an unknown one and a
 * deactivated account are indistinguishable, because any difference turns this
 * endpoint into an account-existence oracle. Upstream goes to some trouble for it:
 * `send_mail(..., fail_silently=True)` swallows a broken mail server so an outage
 * cannot become a 500 that only happens for addresses that exist.
 *
 * A malformed address is still a 422 — `EmailStr` rejects it before the lookup, so
 * answering it cannot leak anything.
 *
 * Nothing invalidates a previously issued token: several may be outstanding at
 * once, and `confirm` simply takes the one it is handed.
 */
register(
  'POST',
  '/auth/password/reset',
  (request): MessageOut => {
    const body = bodyOf(request);
    const email = readNormalizedEmail(body, 'email');

    // `email__iexact` — the case-insensitive half of the asymmetry in the module
    // note, and the reason a reset works for an address login would refuse.
    const user = userByEmail(email);
    if (user) {
      const token = nextResetToken();
      store.password_reset_tokens.push({
        id: nextId('password_reset_tokens'),
        user_id: user.id,
        token,
        created_at: nowIso(),
        used_at: null,
      });

      // Django's `console.EmailBackend`, which is what `DJANGO_EMAIL_BACKEND`
      // resolves to in development. This is the demo's inbox and the only way the
      // reset flow is completable in a tab; the copy is upstream's, rebranded.
      console.info(
        [
          `[email] from=noreply@gisheri.ge to=${user.email}`,
          'Subject: Reset your Gisheri password',
          '',
          'Use the link below to reset your Gisheri password. This link expires in 1 hour.',
          '',
          resetLink(token),
          '',
          'If you did not request a reset, you can ignore this email.',
        ].join('\n'),
      );
    }

    return { detail: 'If that email exists, a reset link has been sent.' };
  },
  { auth: 'public' },
);

// --------------------------------------------------------------------------- //
//  POST /auth/password/reset/confirm
// --------------------------------------------------------------------------- //

/**
 * Two distinguishable failures, and the order is the view's: no matching *unused*
 * row is `reset_token_invalid`, and only a row that passed that test can be
 * `reset_token_expired`. A spent token is therefore "invalid" rather than
 * "expired", however old it is — the queryset filters `used_at__isnull=True`
 * before the clock is ever consulted.
 *
 * The TTL is evaluated here, at read time, because there is no sweep in this demo
 * and there is none upstream either — no Celery beat, no management command,
 * just this subtraction.
 *
 * On success the user is **not** signed in and existing tokens are **not**
 * invalidated. `ResetPasswordPage` navigates to `/login` and the visitor types the
 * new password.
 */
register(
  'POST',
  '/auth/password/reset/confirm',
  (request): MessageOut => {
    const body = bodyOf(request);
    const token = readString(body, 'token', { required: true });
    const password = readString(body, 'password', { required: true, min: 8, max: 128 });

    const record = store.password_reset_tokens.find(
      (row) => row.token === token && row.used_at === null,
    );
    if (!record) throw fail('reset_token_invalid');

    if (CLOCK.now() - parseIso(record.created_at) > PASSWORD_RESET_TTL_MS) {
      throw fail('reset_token_expired');
    }

    // The FK is `on_delete=CASCADE`, so a token cannot outlive its user and
    // `select_related("user")` upstream can never come back empty. The guard is
    // the type narrowing, and it answers sensibly if a seed ever broke that.
    const user = userById(record.user_id);
    if (!user) throw fail('reset_token_invalid');

    // No `is_active` check anywhere in this flow: a deactivated account can have
    // its password reset and still not be able to sign in. Upstream's behaviour.
    user.password = password;
    record.used_at = nowIso();

    return { detail: 'Password has been reset.' };
  },
  { auth: 'public' },
);

// --------------------------------------------------------------------------- //
//  POST /auth/logout
// --------------------------------------------------------------------------- //

/**
 * Purely symbolic — the view's own docstring says so: "Stateless JWT —
 * client-side discards the token. Endpoint exists for symmetry." Nothing is
 * blacklisted, the token that called it still works, and `logout()` in
 * `context/auth.tsx` fires it with `.catch(() => undefined)` and clears the store
 * regardless.
 *
 * It is nevertheless `auth=jwt_auth`, so a signed-out caller gets a 401 that
 * nobody reads. Reproduced, because "the endpoint that requires the credential it
 * is about to throw away" is exactly the kind of detail a port gets wrong.
 */
register('POST', '/auth/logout', (): MessageOut => ({ detail: 'Logged out.' }));
