/**
 * `/auth/*` — a port of `apps/users/views.py`: register, login, refresh,
 * logout, the session probe, the profile PATCH, change-password and the
 * forgot/reset OTP pair. Nine routes, all of them in `../routes.md` §1.
 *
 * Upstream this app is entirely about cookies and JWTs; here it is about one
 * integer. `store.session.userId` replaces the `access_token` /
 * `refresh_token` pair, because what the two SPAs actually observe is
 * "`GET /auth/me/` works" or "it 401s" — never a token, which is `HttpOnly` on
 * both ends of the wire. That collapse is why `/auth/refresh/` has nothing to
 * rotate and why `change-password` cannot sign anybody else out.
 *
 * ## Four deliberate deviations, all of them because this is a browser
 *
 * 1. **Passwords are compared in plain text** against `UserRow.password`.
 *    Django stores a PBKDF2 hash and `check_password()` is deliberately slow;
 *    there is nothing to protect here, because the server is a function call in
 *    the same tab and the demo banner will sign you in as an admin on request.
 *    The observable contract — right password 2xx, wrong password 401
 *    `credentials_invalid` — is identical.
 *
 * 2. **The OTP is stored in plain text and printed to the console.** Upstream
 *    keeps only `sha256(code)` and hands the plaintext to an SMS provider; the
 *    Celery task carries an explicit warning never to log or persist it. A
 *    browser tab has no inbox, so the reset flow would be uncompletable — the
 *    demo prints it in `ConsoleSMSProvider`'s own format (`[SMS] to=…: …`),
 *    which is exactly how a developer completes this flow against the real
 *    backend running with `SMS_PROVIDER=console`. Everything that is *behaviour*
 *    rather than transport is kept: the 15-minute TTL, the newest-usable-code
 *    selection, the five-attempt lockout, the one-shot consume.
 *
 * 3. **CSRF is not enforced.** `PATCH /auth/me/` and `POST /auth/change-password/`
 *    are the two cookie-authenticated unsafe methods upstream runs
 *    `CookieJWTAuthentication.enforce_csrf` on. Same-origin, same tab, no
 *    cross-site request to forge (DECISIONS #9). Both seams still read the
 *    cookie and send `X-CSRFToken`, because that code is the seam and stays
 *    shaped like the original.
 *
 * 4. **No throttling.** The dev backend nulls all four scoped rates, so `429`
 *    is not a state this demo can reach and it does not invent one
 *    (DECISIONS #8).
 *
 * Phone normalisation and password strength are hand-rolled rather than
 * imported: `phonenumbers` and Django's 20 000-entry common-password list are
 * both a metadata download this demo will not make. Both live in `base.ts`,
 * documented at their definitions with the acceptance sets they widen, because
 * upstream has exactly one of each and every serializer that takes a phone or a
 * password calls it — including two admin routes this module does not own.
 */

import {
  CLOCK,
  EMAIL_PATTERN,
  MINUTE,
  assertStrongPassword,
  bodyOf,
  fail,
  normalizePhone,
  nowIso,
  parseIso,
  toApiDateTime,
  validationError,
} from '../base';
import { register } from '../router';
import type { DemoRequest } from '../router';
import { serializeUser } from '../serialize';
import { isSignedIn, nextId, signIn, signOut, store, userByEmail, userByPhone } from '../store';
import type { PasswordResetOtpRow, UserRow } from '../types';

// --------------------------------------------------------------------------- //
//  Reading a request body
//
//  DRF gives a serializer a dict and lets each field pull its own key out, so
//  the helpers below are per-field rather than per-body. `CharField` trims
//  whitespace by default (`trim_whitespace=True`) and treats the result as
//  blank if nothing survives, which is why `"   "` is a `validation_error` on
//  every string field here — passwords included.
// --------------------------------------------------------------------------- //

/** A required `CharField`. Absent, non-string or blank-after-trim all fail alike. */
function requiredString(
  body: Record<string, unknown>,
  key: string,
  options: { field?: string; maxLength?: number } = {},
): string {
  const field = options.field ?? key;
  const raw = body[key];
  if (typeof raw !== 'string') throw validationError(field);
  const value = raw.trim();
  if (!value) throw validationError(field);
  if (options.maxLength !== undefined && value.length > options.maxLength) {
    throw validationError(field);
  }
  return value;
}

/**
 * An `EmailField(required=False, allow_null=True, allow_blank=True)`.
 *
 * Returns `undefined` when the key is absent — which `PATCH /me/` needs to tell
 * "leave the email alone" from "clear it" — and `null` for both `""` and an
 * explicit `null`, because the unique index treats NULLs as distinct and `""`
 * would collide the moment a second user left it empty.
 */
function optionalEmail(body: Record<string, unknown>, key = 'email'): string | null | undefined {
  if (!(key in body)) return undefined;
  const raw = body[key];
  if (raw === null) return null;
  if (typeof raw !== 'string') throw validationError(key);
  const value = raw.trim();
  if (!value) return null;
  if (value.length > 254 || !EMAIL_PATTERN.test(value)) throw validationError(key);
  return value;
}

/**
 * The gate has already run — `auth: 'any'` cannot reach a handler with a null
 * user — so this narrows the type rather than deciding anything. It throws the
 * gate's own error instead of asserting, so a future route registered `'public'`
 * by mistake answers 401 rather than crashing on `null.first_name`.
 */
function signedInUser(request: DemoRequest): UserRow {
  if (!request.user) throw fail('not_authenticated');
  return request.user;
}

// --------------------------------------------------------------------------- //
//  The OTP
// --------------------------------------------------------------------------- //

const OTP_TTL_MINUTES = 15;
const OTP_MAX_ATTEMPTS = 5;

/**
 * Six digits, leading zeros allowed, from a golden-ratio walk rather than
 * `secrets.choice` — the same trick `base.ts::nextLatency` uses. A demo does
 * not need entropy it cannot check; it needs a code that differs from the last
 * one and a run that reproduces exactly, so a screenshot of the console still
 * matches the flow it came from.
 */
const GOLDEN = 0.618033988749895;
let otpTick = 0;

function nextOtpCode(): string {
  otpTick += 1;
  const position = (otpTick * GOLDEN) % 1;
  return String(Math.floor(position * 1_000_000)).padStart(6, '0');
}

/**
 * `ResetPasswordView`'s queryset: the newest **unconsumed, unexpired,
 * under-five-attempts** code for this user. The `attempts` bound is what makes
 * a locked-out code reject even the correct value — it drops out of the filter
 * rather than being marked, so `consumed_at` stays null and the old password
 * keeps working until a fresh code is issued.
 */
function liveOtpFor(userId: number, now: number): PasswordResetOtpRow | undefined {
  return store.password_reset_otps
    .filter(
      (row) =>
        row.user_id === userId &&
        row.consumed_at === null &&
        row.attempts < OTP_MAX_ATTEMPTS &&
        parseIso(row.expires_at) > now,
    )
    .sort((left, right) => parseIso(right.created_at) - parseIso(left.created_at) || right.id - left.id)[0];
}

/**
 * `NotificationLog.template_key` is a free-text `CharField` upstream, and the
 * reset SMS is an f-string in the view rather than a `NotificationTemplate`
 * row — so this key has no template behind it. `NotificationLogRow` types the
 * column as `TemplateKey | 'password_reset'` for exactly this row; the key is
 * deliberately **not** in `TEMPLATE_KEYS`, which is what `validateSeed` counts
 * the 16 seeded templates against.
 */
const PASSWORD_RESET_LOG_KEY = 'password_reset';

/**
 * The whole of `ForgotPasswordView`'s side effect, for a phone that resolved to
 * an active account.
 *
 * `booking_id` is null — the column is nullable precisely because not every
 * message is about an appointment — and the row is written directly rather than
 * through `logNotification()`, which renders a booking template and would have
 * nothing to render here. No `notification_templates` row exists for a reset
 * code upstream either: the OTP text is an f-string in the view.
 */
function issueResetOtp(user: UserRow): void {
  const now = CLOCK.now();
  const code = nextOtpCode();

  store.password_reset_otps.push({
    id: nextId('password_reset_otps'),
    user_id: user.id,
    code,
    expires_at: toApiDateTime(now + OTP_TTL_MINUTES * MINUTE),
    consumed_at: null,
    attempts: 0,
    created_at: nowIso(),
  });

  const message = `Your reset code: ${code} (expires in ${OTP_TTL_MINUTES} minutes).`;

  store.notification_logs.push({
    id: nextId('notification_logs'),
    booking_id: null,
    template_key: PASSWORD_RESET_LOG_KEY,
    channel: 'sms',
    // The reset SMS is an untranslated English f-string upstream, not a
    // template row, so it carries no language choice to make.
    language: 'en',
    recipient: user.phone,
    subject: '',
    body: message,
    success: true,
    error: '',
    created_at: nowIso(),
  });

  // `ConsoleSMSProvider.send()` verbatim — `print(f"[SMS] to={phone}: {message}")`.
  // This is the demo's inbox, and the only way the reset flow is completable in
  // a tab. Upstream a developer running `SMS_PROVIDER=console` reads the code
  // out of exactly this line.
  console.info(`[SMS] to=${user.phone}: ${message}`);
}

// --------------------------------------------------------------------------- //
//  POST /auth/register/
// --------------------------------------------------------------------------- //

/**
 * Always creates a `customer`: `role` is not settable through any auth endpoint,
 * and a `role` key in the body is one of the many `RegisterSerializer` ignores
 * rather than rejects.
 *
 * The two-phase order is load-bearing. DRF runs every field validator first
 * (`is_valid(raise_exception=True)`) and only then hits the database, so a
 * request carrying both an invalid phone and an already-taken email reports
 * `phone_invalid` — never `email_taken`. Within phase one the fields are
 * checked in declaration order, because the exception handler reports the first
 * failure and throws the rest away.
 */
register(
  'POST',
  '/auth/register/',
  (request) => {
    const body = bodyOf(request);

    const rawPhone = requiredString(body, 'phone');
    const phone = normalizePhone(rawPhone);
    if (!phone) throw fail('phone_invalid');

    const password = requiredString(body, 'password');
    assertStrongPassword(password, 'password');

    const firstName = requiredString(body, 'first_name', { maxLength: 80 });
    const lastName = requiredString(body, 'last_name', { maxLength: 80 });
    const email = optionalEmail(body) ?? null;

    // Phase two: what Postgres' unique indexes would have raised. Upstream this
    // is an `IntegrityError` caught in `create()` and told apart by sniffing the
    // constraint name for "phone" or "email"; a pre-check is the same answer
    // without the string matching, and single-threaded JS has no race to lose.
    if (userByPhone(phone)) throw fail('phone_taken');
    // A null email skips the check entirely: NULLs are distinct in that index,
    // so any number of accounts may leave it empty.
    if (email && userByEmail(email)) throw fail('email_taken');

    const user: UserRow = {
      id: nextId('users'),
      password,
      // Never written: the views mint tokens rather than calling
      // `django.contrib.auth.login()`, and SimpleJWT's UPDATE_LAST_LOGIN is off.
      last_login: null,
      is_superuser: false,
      phone,
      email,
      first_name: firstName,
      last_name: lastName,
      role: 'customer',
      notes: '',
      is_active: true,
      // `User.save()` recomputes this from the role on every write.
      is_staff: false,
      date_joined: nowIso(),
    };
    store.users.push(user);

    // 201 upstream; the seam sees a body, not a status, so the difference from
    // the 200 on `/login/` is invisible on this side of the wire.
    signIn(user);
    return serializeUser(user);
  },
  { auth: 'public' },
);

// --------------------------------------------------------------------------- //
//  POST /auth/login/
// --------------------------------------------------------------------------- //

/**
 * One answer for four different failures — unknown phone, wrong password,
 * deactivated account, unparseable phone — because any distinction between them
 * is an account-existence oracle. `LoginSerializer.validate_phone` swallows the
 * normalisation error and hands the raw string to `authenticate()` for exactly
 * that reason, so a malformed phone matches nothing and surfaces as 401 rather
 * than as `phone_invalid`.
 */
register(
  'POST',
  '/auth/login/',
  (request) => {
    const body = bodyOf(request);
    const rawPhone = requiredString(body, 'phone');
    const password = requiredString(body, 'password');

    const user = userByPhone(normalizePhone(rawPhone) ?? rawPhone);
    if (!user || !user.is_active || user.password !== password) {
      throw fail('credentials_invalid');
    }

    signIn(user);
    return serializeUser(user);
  },
  { auth: 'public' },
);

// --------------------------------------------------------------------------- //
//  POST /auth/refresh/
// --------------------------------------------------------------------------- //

/**
 * The one route whose usual right answer is a failure.
 *
 * Only the console calls it, from the single-flight `refreshSession()` its
 * fetch wrapper fires on a 401. With no tokens to rotate there is nothing to do
 * but report whether a session exists — and reporting "yes" unconditionally
 * would put that wrapper into a refresh-and-retry loop on every signed-out 401,
 * which is what makes the 401 branch here load-bearing rather than defensive.
 *
 * Upstream answers 200 with a zero-byte body; this answers 204. Both seams read
 * only `res.ok`, so the two are indistinguishable to every caller
 * (`routes.md` §1).
 */
register(
  'POST',
  '/auth/refresh/',
  () => {
    if (!isSignedIn()) throw fail('not_authenticated');
    return undefined;
  },
  { auth: 'public' },
);

// --------------------------------------------------------------------------- //
//  POST /auth/logout/
// --------------------------------------------------------------------------- //

/** `AllowAny` and unconditionally 204 — there is no error path to reach. */
register(
  'POST',
  '/auth/logout/',
  () => {
    signOut();
    return undefined;
  },
  { auth: 'public' },
);

// --------------------------------------------------------------------------- //
//  GET /auth/me/  ·  PATCH /auth/me/
// --------------------------------------------------------------------------- //

/**
 * The session probe. Both SPAs mount it as `useMe()` with `retry: false` and
 * treat any failure as "signed out", so its 401 is the normal answer for a
 * visitor who has not signed in and not an error worth dressing up.
 *
 * `role` is the half that matters: the console's `<RequireStaff>` reads it out
 * of this payload and admits `admin` and nothing else.
 */
register('GET', '/auth/me/', (request) => serializeUser(signedInUser(request)));

/**
 * Exactly three editable fields. `phone`, `role`, `is_active`, `notes` and `id`
 * are dropped in silence rather than rejected — `MeUpdateSerializer` does not
 * declare them, and DRF ignores what it was not asked about — so a body that
 * tries to promote its own account returns 200 with the role unchanged.
 *
 * An empty body is valid (`partial=True`) and returns the user untouched.
 */
register('PATCH', '/auth/me/', (request) => {
  const user = signedInUser(request);
  const body = bodyOf(request);

  // Read every field before writing any of them: only the first failure is ever
  // reported, and a half-applied PATCH would leave the row in a state no
  // request asked for.
  const firstName = 'first_name' in body ? requiredString(body, 'first_name', { maxLength: 80 }) : undefined;
  const lastName = 'last_name' in body ? requiredString(body, 'last_name', { maxLength: 80 }) : undefined;
  const email = optionalEmail(body);

  // `email__iexact`, excluding this user — the one lookup upstream does
  // case-insensitively, which is why `store.userByEmail` is case-insensitive too.
  if (email) {
    const owner = userByEmail(email);
    if (owner && owner.id !== user.id) throw fail('email_taken');
  }

  if (firstName !== undefined) user.first_name = firstName;
  if (lastName !== undefined) user.last_name = lastName;
  if (email !== undefined) user.email = email;

  return serializeUser(user);
});

// --------------------------------------------------------------------------- //
//  POST /auth/change-password/
// --------------------------------------------------------------------------- //

/**
 * Order matters and is not the order it reads in: `new_password`'s strength is
 * a serializer field validator, so it runs during `is_valid()` — before the
 * view has looked at `old_password` at all. A request with a wrong old password
 * *and* a weak new one therefore answers `password_weak`, not
 * `credentials_invalid`.
 *
 * Upstream this also blacklists every outstanding refresh token, signing the
 * account out of every other device while re-issuing a fresh pair for this one.
 * There is one session here and it is this one, so the observable half — the
 * caller stays signed in — is all there is to reproduce.
 */
register('POST', '/auth/change-password/', (request) => {
  const user = signedInUser(request);
  const body = bodyOf(request);

  const oldPassword = requiredString(body, 'old_password');
  const newPassword = requiredString(body, 'new_password');
  assertStrongPassword(newPassword, 'new_password');

  if (user.password !== oldPassword) throw fail('credentials_invalid');

  user.password = newPassword;
  return undefined;
});

// --------------------------------------------------------------------------- //
//  POST /auth/forgot-password/
// --------------------------------------------------------------------------- //

/**
 * **Always 204.** Unknown phone, deactivated account, unparseable input, a
 * provider that would have thrown — every one of them answers with the same
 * zero bytes, because any difference at all turns this endpoint into an
 * account-existence oracle. Upstream goes to some length for this: the
 * normalisation error is swallowed, the SMS is enqueued through Celery, and the
 * enqueue failure is caught and logged rather than raised, so a provider outage
 * cannot become a 500 that only happens when the phone exists.
 *
 * Nothing invalidates a previously issued code — several may be outstanding at
 * once, and `reset-password` simply takes the newest usable one.
 */
register(
  'POST',
  '/auth/forgot-password/',
  (request) => {
    const body = bodyOf(request);
    // The one thing that is still a 400: a request with no `phone` key at all
    // never reaches the lookup, so answering it cannot leak anything.
    const rawPhone = requiredString(body, 'phone');

    const phone = normalizePhone(rawPhone) ?? rawPhone;
    const user = userByPhone(phone);
    if (user?.is_active) issueResetOtp(user);

    return undefined;
  },
  { auth: 'public' },
);

// --------------------------------------------------------------------------- //
//  POST /auth/reset-password/
// --------------------------------------------------------------------------- //

/**
 * Every way this can fail after field validation answers `otp_invalid`: no such
 * user, an inactive one, no code ever issued, an expired code, a consumed one, a
 * locked-out one, or a mismatch. `otp_expired` exists in the registry and is
 * translated in both front ends, but no backend path emits it — expiry collapses
 * into `otp_invalid` like everything else, and this reproduces that rather than
 * "fixing" it.
 *
 * A mismatch also spends an attempt, and the fifth spent attempt kills the code
 * for good: `liveOtpFor` stops returning it, so the correct value typed sixth is
 * refused too. The way out is a new `forgot-password/`, whose fresh row is both
 * newer and back at zero attempts.
 *
 * On success the user is **not** signed in — the customer app routes to `/login`
 * and shows `auth.login.password_reset_success`.
 */
register(
  'POST',
  '/auth/reset-password/',
  (request) => {
    const body = bodyOf(request);

    // Declaration order phone → code → new_password, because only the first
    // problem is reported. A malformed phone raises `otp_invalid` rather than
    // `phone_invalid`, and it is the one place the code carries `field: "phone"`.
    const rawPhone = requiredString(body, 'phone');
    const phone = normalizePhone(rawPhone);
    if (!phone) throw fail('otp_invalid', 'phone');

    // `CharField(min_length=6, max_length=6)` — a string, so a code with a
    // leading zero survives JSON. Anything else six characters long is simply a
    // guess that will not match.
    const code = requiredString(body, 'code');
    if (code.length !== 6) throw validationError('code');

    const newPassword = requiredString(body, 'new_password');
    assertStrongPassword(newPassword, 'new_password');

    const user = userByPhone(phone);
    if (!user?.is_active) throw fail('otp_invalid');

    const otp = liveOtpFor(user.id, CLOCK.now());
    if (!otp) throw fail('otp_invalid');

    if (otp.code !== code) {
      otp.attempts += 1;
      throw fail('otp_invalid');
    }

    otp.consumed_at = nowIso();
    user.password = newPassword;
    return undefined;
  },
  { auth: 'public' },
);
