/**
 * The mock's primitives: the error it fails with, the clock it reads, the
 * latency it spends, the request bodies it parses and the number formats Ninja
 * put on the wire.
 *
 * A port of `ninja.errors.HttpError` (the one-key envelope), of Pydantic's 422
 * body, of `TIME_ZONE = "UTC"` / `USE_TZ = True`, and of Ninja's Decimal
 * encoding. **Nothing here reads the store**, so every other module in
 * `src/demo/` can import it without a cycle — including `store.ts` itself, which
 * needs the clock while it is still rebasing a table set the `store` binding does
 * not point at yet.
 *
 * Three rules this file exists to enforce:
 *
 * - **One clock.** `Date.now()` appears exactly once in the whole mock, in
 *   `CLOCK.now()`. Every filter, every `auto_now`, every expiry test and every
 *   rebase decision reads that one function, so they can never disagree — and a
 *   future "advance time" control would have one knob to turn.
 * - **One failure.** `DemoApiError` is the only way a handler fails, and its
 *   `body` is what the seam hands to `ApiError`. A handler never writes a status
 *   number: it names a code and the registry settles the rest.
 * - **One money format.** Every price crossing this boundary is a 2-dp string,
 *   and arithmetic that must be exact happens in integer tetri.
 */

import type { DateKey, IsoDateTime, IsoOffset, Money } from './types';

// --------------------------------------------------------------------------- //
//  The error registry — 25 codes, the complete catalogue
//
//  Django-Ninja's `HttpError(status, msg)` renders `{"detail": msg}` and nothing
//  else. There is no `code`, no `field`, no per-field dict: DRF's three-key
//  envelope belongs to a different backend and must not creep in here, because
//  the app reads `detail` and only `detail`.
//
//  The message is the exact English string the backend sends, because the app
//  renders it verbatim — there are no i18n keys for API errors anywhere in this
//  front end. A wrong string here is a wrong string on screen.
//
//  A value is either the literal detail or a function that builds it from the
//  handler's arguments; `fail()` types those arguments off this table, so
//  `fail('discount_min_order')` is a compile error and
//  `fail('discount_min_order', '100.00')` is not.
// --------------------------------------------------------------------------- //

const MESSAGE_TABLE = {
  // --- 401: no usable identity ---------------------------------------------
  /** Ninja's own text when an `auth=` callable returns `None`. */
  unauthorized: 'Unauthorized',
  invalid_credentials: 'Invalid email or password.',
  /** django-ninja-jwt's wording, and deliberately not the same as the two above. */
  invalid_refresh: 'Token is invalid or expired',

  // --- 403: identity known, role wrong -------------------------------------
  staff_required: 'Staff or admin role required.',
  admin_required: 'Admin role required.',

  // --- 404 / 405: routing ---------------------------------------------------
  /**
   * `get_object_or_404` → `Http404` → Ninja's default handler. Object-level
   * scoping answers with this too: someone else's order is 404, never 403.
   */
  not_found: 'Not Found',
  method_not_allowed: 'Method Not Allowed',

  // --- 400: everything a handler raises deliberately -------------------------
  email_taken: 'An account with this email already exists.',
  current_password_wrong: 'Current password is incorrect.',
  reset_token_invalid: 'Invalid or already-used token.',
  reset_token_expired: 'Token has expired. Request a new reset email.',
  self_role_change: 'You cannot change your own role from admin.',
  self_deactivate: 'You cannot deactivate your own account.',
  collection_slug_taken: 'A collection with this slug already exists.',
  discount_code_taken: 'A discount with this code already exists.',
  page_seo_path_taken: 'An override for this path already exists.',

  /**
   * `f"Unknown product id(s): {missing}"` where `missing` is a Python **list**,
   * so `str()` renders it with square brackets and a space after each comma:
   * `Unknown product id(s): [4099, 4100]`. Upstream builds the list with
   * `[pid for pid in product_ids if pid not in products]`, which preserves the
   * payload's order and repeats a duplicate id — reproduce that, do not sort or
   * de-duplicate.
   */
  unknown_products: (missing: readonly number[]) => `Unknown product id(s): [${missing.join(', ')}]`,

  /**
   * All three redeemability failures — inactive, expired, exhausted — collapse
   * into this one string. The client cannot tell them apart, and that is the
   * upstream contract, not an oversight to repair.
   */
  discount_invalid: 'Invalid or expired discount code.',

  /**
   * Checked **after** redeemability, and the only discount failure with its own
   * message. The number is a raw `Decimal` interpolated by an f-string: two
   * decimals, no currency symbol, no thousands separator — `100.00`, not `₾100`.
   */
  discount_min_order: (minOrderTotal: Money) =>
    `This code requires a minimum order of ${minOrderTotal}.`,

  /** The em-dash is upstream's. `Can't` uses a plain ASCII apostrophe, also upstream's. */
  last_item: "Can't remove the last item — cancel the order instead.",

  /** Python `repr` of a sorted list of extensions, single-quoted, spaces after the commas. */
  upload_type: "Unsupported file type. Allowed: ['.gif', '.jpeg', '.jpg', '.png', '.webp']",
  upload_too_large: 'File too large (max 8MB).',

  /**
   * **The one place this mock is deliberately kinder than upstream.** Deleting a
   * product an `OrderItem` still points at trips `on_delete=PROTECT`, and Django
   * raises `ProtectedError`, which Ninja does not catch — so the real server
   * answers 500 with an HTML debug page. A 500 in a demo reads as a broken demo,
   * so this is a 400 with a sentence that says what happened. Named as the single
   * divergence in the README.
   */
  product_protected: 'Cannot delete a product that appears on an order.',

  // --- 409 -----------------------------------------------------------------
  items_pending_only: 'Items can only be edited on pending orders.',

  // --- 500 -----------------------------------------------------------------
  server_error: 'Internal Server Error',
} as const;

/** The 25 codes a handler may name. `validation_error` is not one of them — see `validationError()`. */
export type ErrorCode = keyof typeof MESSAGE_TABLE;

/**
 * What `DemoApiError.code` can carry: a registry code, the 422 pseudo-code, or
 * `unknown` for a status the mock produced without naming a reason.
 */
export type FailureCode = ErrorCode | 'validation_error' | 'unknown';

/** The arguments each code's message needs — `[]` for the literals. */
type MessageArgs = {
  [K in ErrorCode]: (typeof MESSAGE_TABLE)[K] extends (...args: infer A) => string ? A : [];
};

/**
 * Anything absent is 400, which is what `HttpError(400, …)` accounts for in all
 * but nine cases. A handler never writes a status number; it names the code.
 */
const STATUS_BY_CODE: Partial<Record<ErrorCode, number>> = {
  unauthorized: 401,
  invalid_credentials: 401,
  invalid_refresh: 401,
  staff_required: 403,
  admin_required: 403,
  not_found: 404,
  method_not_allowed: 405,
  items_pending_only: 409,
  server_error: 500,
};

export function statusForCode(code: ErrorCode): number {
  return STATUS_BY_CODE[code] ?? 400;
}

export function messageForCode<C extends ErrorCode>(code: C, ...args: MessageArgs[C]): string {
  const entry = MESSAGE_TABLE[code] as string | ((...rest: unknown[]) => string);
  return typeof entry === 'function' ? entry(...(args as unknown[])) : entry;
}

/** Ninja's only error body. One key, always. */
export interface ErrorBody {
  detail: string;
}

/** One entry of Pydantic's 422 list. Never rendered by this app — see `validationError()`. */
export interface ValidationIssue {
  type: string;
  loc: string[];
  msg: string;
}

/** The 422 body: `detail` is an **array**, which is the whole point. */
export interface ValidationErrorBody {
  detail: ValidationIssue[];
}

/**
 * The only way a handler fails.
 *
 * `detail` is the string the app will display and `body` is the literal response
 * body. For every 4xx and 5xx those agree — `body` is `{detail}` — and for a 422
 * they deliberately do not: see `validationError()`.
 *
 * The seam rethrows as `new ApiError(err.status, err.detail, err.body)`, so
 * `detail` is what reaches every toast, every red line under a form field, and
 * every `error.detail` the pages read.
 */
export class DemoApiError extends Error {
  readonly status: number;

  readonly code: FailureCode;

  readonly detail: string;

  readonly body: unknown;

  constructor(status: number, code: FailureCode, detail: string, body?: unknown) {
    super(detail);
    this.name = 'DemoApiError';
    this.status = status;
    this.code = code;
    this.detail = detail;
    this.body = body ?? ({ detail } satisfies ErrorBody);
  }
}

/**
 * The idiomatic failure: name the code and let the registry settle the status and
 * the wording. `fail('items_pending_only')` is a 409 because the table says so.
 */
export function fail<C extends ErrorCode>(code: C, ...args: MessageArgs[C]): DemoApiError {
  return new DemoApiError(statusForCode(code), code, messageForCode(code, ...args));
}

export function notFound(): DemoApiError {
  return fail('not_found');
}

export function unauthorized(): DemoApiError {
  return fail('unauthorized');
}

export function staffRequired(): DemoApiError {
  return fail('staff_required');
}

export function adminRequired(): DemoApiError {
  return fail('admin_required');
}

export function methodNotAllowed(): DemoApiError {
  return fail('method_not_allowed');
}

export function serverError(): DemoApiError {
  return fail('server_error');
}

/**
 * Pydantic's 422, reproduced including the fact that the app cannot read it.
 *
 * The body is `{detail: [{type, loc, msg}]}` — an **array**, because that is what
 * Ninja sends when request validation fails. `api.ts:123-128` extracts `detail`
 * only when it is a *string*, so the app falls back to `` `Request failed (${status})` ``
 * and the visitor sees `Request failed (422)` with no field named. That is
 * upstream's real behaviour on a bad payload and reproducing it is the point.
 *
 * The seam takes `DemoApiError.detail` directly rather than re-deriving it from
 * the body, so the degradation has to be baked in here: `detail` is the string
 * the app would have computed, `body` is the array it would have discarded. Both
 * are true at once, which is the only way to be faithful to both call paths.
 *
 * `loc` upstream is `['body', '<parameter name>', '<field>']`; the readers below
 * emit `['body', '<field>']` because the parameter name is a Ninja implementation
 * detail no reader could know and nothing renders the array anyway.
 */
export function validationError(loc: string[], msg: string, type = 'value_error'): DemoApiError {
  const body: ValidationErrorBody = { detail: [{ type, loc, msg }] };
  return new DemoApiError(422, 'validation_error', 'Request failed (422)', body);
}

// --------------------------------------------------------------------------- //
//  Reading a request body
//
//  Pydantic hands a model a dict and lets each field pull its own key out, so
//  these are per-field rather than per-body. The messages are Pydantic v2's own,
//  which costs nothing and means a `console.log` of a rejected body reads exactly
//  like the real one — even though the UI only ever shows `Request failed (422)`.
//
//  `fallback` is the field's declared default. Absent key + no default + not
//  `required` returns the type's empty value for the three types that have one
//  (`''`, `false`, `[]`) and throws for the rest, because every upstream integer
//  and decimal field either is required or carries an explicit default.
// --------------------------------------------------------------------------- //

export interface ReadOptions {
  required?: boolean;
}

export interface StringOptions extends ReadOptions {
  /** Pydantic `min_length`. */
  min?: number;
  /** Pydantic `max_length`. */
  max?: number;
  fallback?: string;
}

export interface IntOptions extends ReadOptions {
  /** Pydantic `ge`. */
  min?: number;
  /** Pydantic `le`. */
  max?: number;
  fallback?: number;
}

export interface DecimalOptions extends ReadOptions {
  min?: number;
  max?: number;
  fallback?: Money;
}

export interface EnumOptions<T extends string> extends ReadOptions {
  fallback?: T;
}

export interface BooleanOptions extends ReadOptions {
  fallback?: boolean;
}

export interface StringArrayOptions extends ReadOptions {
  fallback?: string[];
}

/**
 * The request body as a JSON object. A list, a scalar, `null` and a `FormData`
 * all read as `{}` — the same thing Pydantic sees when it is handed something it
 * cannot map onto a model.
 *
 * Takes the request **structurally** rather than as a `DemoRequest`, so this file
 * stays free of any import from `router.ts` and the module graph keeps its one
 * direction.
 */
export function bodyOf(request: { body: unknown }): Record<string, unknown> {
  const { body } = request;
  if (body === null || typeof body !== 'object') return {};
  if (Array.isArray(body) || body instanceof FormData) return {};
  return body as Record<string, unknown>;
}

/**
 * `key in payload.model_fields_set`.
 *
 * An explicit `undefined` counts as **absent**: JSON has no such value, so a key
 * that arrives holding it can only have come from an object literal the caller
 * built, where `{adminNotes: undefined}` means "I did not send this" while
 * `{adminNotes: null}` would mean something else entirely. `JSON.stringify` drops
 * the first and keeps the second, and so does this.
 */
export function has(body: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(body, key) && body[key] !== undefined;
}

/** Pydantic's `EmailStr` reduced to the shape every real address has. */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function missing(key: string): DemoApiError {
  return validationError(['body', key], 'Field required', 'missing');
}

export function readString(
  body: Record<string, unknown>,
  key: string,
  options: StringOptions = {},
): string {
  if (!has(body, key)) {
    if (options.required) throw missing(key);
    return options.fallback ?? '';
  }
  const raw = body[key];
  if (typeof raw !== 'string') {
    throw validationError(['body', key], 'Input should be a valid string', 'string_type');
  }
  if (options.min !== undefined && raw.length < options.min) {
    throw validationError(
      ['body', key],
      `String should have at least ${options.min} character${options.min === 1 ? '' : 's'}`,
      'string_too_short',
    );
  }
  if (options.max !== undefined && raw.length > options.max) {
    throw validationError(
      ['body', key],
      `String should have at most ${options.max} character${options.max === 1 ? '' : 's'}`,
      'string_too_long',
    );
  }
  return raw;
}

/** `EmailStr`. Rejected addresses carry Pydantic's own `value_error` wording. */
export function readEmail(
  body: Record<string, unknown>,
  key: string,
  options: StringOptions = {},
): string {
  const value = readString(body, key, options);
  if (value === '' && !options.required) return value;
  if (!EMAIL_PATTERN.test(value)) {
    throw validationError(
      ['body', key],
      'value is not a valid email address: An email address must have an @-sign.',
    );
  }
  return value;
}

/**
 * Pydantic `int`: the JSON number when it is integral, or a string of digits,
 * which `int` mode accepts. A float with a fractional part is rejected rather
 * than truncated — silently rounding `quantity: 2.5` to 2 would put a number on
 * an order nobody asked for.
 */
export function readInt(
  body: Record<string, unknown>,
  key: string,
  options: IntOptions = {},
): number {
  if (!has(body, key)) {
    if (options.required || options.fallback === undefined) throw missing(key);
    return options.fallback;
  }
  const raw = body[key];
  let value: number;
  if (typeof raw === 'number') {
    if (!Number.isInteger(raw)) {
      throw validationError(
        ['body', key],
        'Input should be a valid integer, got a number with a fractional part',
        'int_from_float',
      );
    }
    value = raw;
  } else if (typeof raw === 'string' && /^[+-]?\d+$/.test(raw.trim())) {
    value = Number(raw.trim());
  } else {
    throw validationError(['body', key], 'Input should be a valid integer', 'int_type');
  }
  if (options.min !== undefined && value < options.min) {
    throw validationError(
      ['body', key],
      `Input should be greater than or equal to ${options.min}`,
      'greater_than_equal',
    );
  }
  if (options.max !== undefined && value > options.max) {
    throw validationError(
      ['body', key],
      `Input should be less than or equal to ${options.max}`,
      'less_than_equal',
    );
  }
  return value;
}

/** `int | None`. An explicit `null` clears the column; an absent key takes the default. */
export function readNullableInt(
  body: Record<string, unknown>,
  key: string,
  options: IntOptions = {},
): number | null {
  if (!has(body, key)) {
    if (options.required) throw missing(key);
    return options.fallback ?? null;
  }
  if (body[key] === null) return null;
  return readInt(body, key, options);
}

/**
 * Pydantic `Decimal`, normalised to the store's 2-dp string.
 *
 * A JSON number and a numeric string are both accepted, because the app sends
 * both: `CartPage` posts `subtotal.toFixed(2)` as a string while the admin
 * discount form posts `value` as a number.
 */
export function readDecimal(
  body: Record<string, unknown>,
  key: string,
  options: DecimalOptions = {},
): Money {
  if (!has(body, key)) {
    if (options.required || options.fallback === undefined) throw missing(key);
    return options.fallback;
  }
  const raw = body[key];
  const numeric = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw.trim()) : NaN;
  if (!Number.isFinite(numeric) || (typeof raw === 'string' && raw.trim() === '')) {
    throw validationError(['body', key], 'Input should be a valid decimal', 'decimal_parsing');
  }
  if (options.min !== undefined && numeric < options.min) {
    throw validationError(
      ['body', key],
      `Input should be greater than or equal to ${options.min}`,
      'greater_than_equal',
    );
  }
  if (options.max !== undefined && numeric > options.max) {
    throw validationError(
      ['body', key],
      `Input should be less than or equal to ${options.max}`,
      'less_than_equal',
    );
  }
  return decimalString(numeric);
}

/** `Decimal | None` — `original_price` is the one column that needs it. */
export function readNullableDecimal(
  body: Record<string, unknown>,
  key: string,
  options: DecimalOptions = {},
): Money | null {
  if (!has(body, key)) {
    if (options.required) throw missing(key);
    return options.fallback ?? null;
  }
  const raw = body[key];
  // The admin product form clears the "was" price by sending an empty string.
  if (raw === null || raw === '') return null;
  return readDecimal(body, key, options);
}

/**
 * Pydantic `Literal[...]`. The allowed set is the source of truth, so a status or
 * a role outside it is a 422 rather than a row written with a value no screen can
 * render.
 */
export function readEnum<T extends string>(
  body: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  options: EnumOptions<T> = {},
): T {
  if (!has(body, key)) {
    if (options.required || options.fallback === undefined) throw missing(key);
    return options.fallback;
  }
  const raw = body[key];
  if (typeof raw !== 'string' || !(allowed as readonly string[]).includes(raw)) {
    throw validationError(
      ['body', key],
      `Input should be ${allowed.map((value) => `'${value}'`).join(' or ')}`,
      'literal_error',
    );
  }
  return raw as T;
}

/**
 * Pydantic `bool`, which accepts the JSON boolean, `0`/`1`, and the strings
 * `"true"`/`"false"`. A real coercion, so the string `"false"` is not stored
 * truthy — that mistake turns every deactivation into an activation.
 */
export function readBoolean(
  body: Record<string, unknown>,
  key: string,
  options: BooleanOptions = {},
): boolean {
  if (!has(body, key)) {
    if (options.required) throw missing(key);
    return options.fallback ?? false;
  }
  const raw = body[key];
  if (typeof raw === 'boolean') return raw;
  if (raw === 0 || raw === 1) return raw === 1;
  if (typeof raw === 'string') {
    const text = raw.trim().toLowerCase();
    if (text === 'true' || text === '1') return true;
    if (text === 'false' || text === '0') return false;
  }
  throw validationError(['body', key], 'Input should be a valid boolean', 'bool_type');
}

/** `list[str]` — `stones`, `purposes`, `zodiac_signs`, `featured_collection_slugs`. */
export function readStringArray(
  body: Record<string, unknown>,
  key: string,
  options: StringArrayOptions = {},
): string[] {
  if (!has(body, key)) {
    if (options.required) throw missing(key);
    return options.fallback ?? [];
  }
  const raw = body[key];
  if (!Array.isArray(raw)) {
    throw validationError(['body', key], 'Input should be a valid list', 'list_type');
  }
  return raw.map((entry, index) => {
    if (typeof entry !== 'string') {
      throw validationError(
        ['body', key, String(index)],
        'Input should be a valid string',
        'string_type',
      );
    }
    return entry;
  });
}

/**
 * `datetime | None`, normalised to the wire's millisecond `…Z` form.
 *
 * The admin discount form posts either `null` or an ISO string built by
 * `<input type="datetime-local">`, which carries no offset at all — `Date.parse`
 * reads that in the **browser's** zone, which is what the real server would have
 * received too, so the drift is faithful rather than invented.
 */
export function readNullableDateTime(
  body: Record<string, unknown>,
  key: string,
  options: ReadOptions = {},
): IsoDateTime | null {
  if (!has(body, key)) {
    if (options.required) throw missing(key);
    return null;
  }
  const raw = body[key];
  if (raw === null || raw === '') return null;
  if (typeof raw !== 'string') {
    throw validationError(['body', key], 'Input should be a valid datetime', 'datetime_type');
  }
  const at = Date.parse(raw);
  if (!Number.isFinite(at)) {
    throw validationError(
      ['body', key],
      'Input should be a valid datetime, invalid character in year',
      'datetime_parsing',
    );
  }
  return toApiDateTime(at);
}

// --------------------------------------------------------------------------- //
//  Latency
// --------------------------------------------------------------------------- //

export const READ_LATENCY: readonly [number, number] = [90, 260];
export const WRITE_LATENCY: readonly [number, number] = [140, 340];

/**
 * The delay is the whole point of the mock feeling real: it is what makes
 * spinners, `isPending` buttons and stale-while-revalidate visible. A mock that
 * answers in zero milliseconds hides every loading state the app was built to
 * show.
 *
 * It is a counter walked by the golden ratio rather than `Math.random()`. The
 * walk never repeats a short cycle, so a list and the detail fetch behind it
 * still land far apart — but the sequence is identical on every run, which means
 * a slow frame is reproducible instead of being blamed on the machine.
 */
let latencyTick = 0;

const GOLDEN = 0.618033988749895;

export function nextLatency(isRead: boolean): number {
  const [min, max] = isRead ? READ_LATENCY : WRITE_LATENCY;
  latencyTick += 1;
  const position = (latencyTick * GOLDEN) % 1;
  return Math.round(min + position * (max - min));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((done) => {
    window.setTimeout(done, ms);
  });
}

// --------------------------------------------------------------------------- //
//  The clock — two zones, two jobs, and the difference matters
//
//  Upstream runs `TIME_ZONE = "UTC"`, so `?date_from=` / `?date_to=` compare the
//  **UTC** date part of `created_at`, while the admin UI computes its "today" and
//  "last 7 days" presets in the **browser's own** zone (`use-date-range-filter.ts`
//  builds them by hand precisely to avoid `toISOString()`). That mismatch is real
//  upstream behaviour and is reproduced, not repaired: `utcDateKey()` is what the
//  filters use.
//
//  The seed's rebase, by contrast, draws its day boundaries in **Asia/Tbilisi**,
//  so a row authored as a Tuesday morning stays a Tuesday morning for a shop that
//  trades in Tbilisi. That is `tbilisiDateKey()`, and it has exactly one caller.
//
//  The seed sidesteps the mismatch by placing every order between 05:00 and 15:00
//  UTC — 09:00 to 19:00 in Tbilisi — where the two zones agree on the date, so a
//  visitor in Auckland and a visitor in Vancouver both see a coherent "today".
// --------------------------------------------------------------------------- //

/** Where the shop trades. Used for day boundaries in the rebase, and nowhere else. */
export const TIME_ZONE = 'Asia/Tbilisi';

/** Milliseconds to add to a UTC instant to reach Tbilisi wall-clock time. Georgia has no DST. */
export const TZ_OFFSET_MS = 4 * 60 * 60 * 1000;

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/**
 * The mock's only reading of the wall clock.
 *
 * Everything else — filters, `auto_now`, discount expiry, token `exp`, the rebase
 * — goes through here, which is what lets them agree with each other to the
 * millisecond and what would let a "jump forward a week" control exist without
 * hunting down a second time source.
 */
export const CLOCK = {
  now(): number {
    return Date.now();
  },
};

function pad(value: number, width = 2): string {
  return String(value).padStart(width, '0');
}

/** Epoch ms from whatever a caller happens to be holding. */
function instantOf(value: Date | string | number): number {
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  return Date.parse(value);
}

/**
 * Ninja's `NinjaJSONEncoder`: ISO-8601 in UTC, microseconds truncated to
 * milliseconds, `+00:00` rewritten as `Z`. `toISOString()` produces exactly that
 * shape, which is the one piece of luck in this file.
 */
export function toApiDateTime(value: Date | string | number): IsoDateTime {
  const at = instantOf(value);
  if (!Number.isFinite(at)) return '';
  return new Date(at).toISOString();
}

/**
 * Python's raw `datetime.isoformat()`: `+00:00` rather than `Z`, six digits of
 * microseconds rather than three. Only `AdminUserOut`'s two `str` fields wear it.
 *
 * JavaScript has no sub-millisecond clock, so the last three digits are zeros. A
 * seeded row may carry real ones; this only mints the rows the demo creates.
 */
export function toApiOffset(value: Date | string | number): IsoOffset {
  const at = instantOf(value);
  if (!Number.isFinite(at)) return '';
  return `${new Date(at).toISOString().slice(0, -1)}000+00:00`;
}

/** `toApiDateTime(CLOCK.now())` — what `auto_now` and `auto_now_add` stamp. */
export function nowIso(): IsoDateTime {
  return toApiDateTime(CLOCK.now());
}

/** `toApiOffset(CLOCK.now())` — what `date_joined` and `last_login` are written with. */
export function nowIsoOffset(): IsoOffset {
  return toApiOffset(CLOCK.now());
}

/** Epoch ms from a stored ISO string, or `NaN`. Both stored shapes parse identically. */
export function parseIso(value: IsoDateTime | IsoOffset | null | undefined): number {
  return value ? Date.parse(value) : Number.NaN;
}

/**
 * `YYYY-MM-DD` of the **UTC** date part — what `created_at__date` compares against
 * under `TIME_ZONE = "UTC"`, and therefore what every `date_from` / `date_to`
 * filter must use.
 */
export function utcDateKey(value: Date | string | number): DateKey {
  const at = instantOf(value);
  if (!Number.isFinite(at)) return '';
  const when = new Date(at);
  return `${when.getUTCFullYear()}-${pad(when.getUTCMonth() + 1)}-${pad(when.getUTCDate())}`;
}

export function todayKeyUtc(): DateKey {
  return utcDateKey(CLOCK.now());
}

/**
 * `YYYY-MM-DD` of the **Asia/Tbilisi** date part. Used only by the seed rebase, so
 * that a row authored at 09:00 in the shop's own morning is still a morning after
 * the shift. Adding the fixed offset and then reading the UTC fields is exact
 * because Georgia has no daylight saving.
 */
export function tbilisiDateKey(value: Date | string | number): DateKey {
  const at = instantOf(value);
  if (!Number.isFinite(at)) return '';
  return utcDateKey(at + TZ_OFFSET_MS);
}

export function todayKeyTbilisi(): DateKey {
  return tbilisiDateKey(CLOCK.now());
}

/**
 * Whole days between two keys, in milliseconds.
 *
 * The arithmetic runs through `Date.UTC` on the key's own numbers rather than on
 * the instants, so it counts calendar days and never loses one to an offset.
 */
export function dayKeyDistance(from: DateKey, to: DateKey): number {
  const utc = (key: DateKey): number => {
    const [year, month, day] = key.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return utc(to) - utc(from);
}

/** Day arithmetic on the key itself, through UTC, so stepping a series is exact. */
export function shiftDayKey(key: DateKey, days: number): DateKey {
  const [year, month, day] = key.split('-').map(Number);
  return utcDateKey(Date.UTC(year, month - 1, day + days));
}

/** The instant Tbilisi midnight opens on `key`. The rebase's "start of that day". */
export function dayStartMsTbilisi(key: DateKey): number {
  const [year, month, day] = key.split('-').map(Number);
  return Date.UTC(year, month - 1, day) - TZ_OFFSET_MS;
}

// --------------------------------------------------------------------------- //
//  Money
//
//  `numeric(10,2)` is exact decimal in Postgres and a 2-dp string on the wire.
//  A JS `number` is neither, so every price crossing this boundary goes through
//  one of these helpers, and arithmetic that has to be exact — the discount, the
//  line totals, the recompute — happens in **integer tetri**.
//
//  Currency is GEL; 1 lari = 100 tetri. `money.ts::formatMoneyGEL` on the app side
//  does the display formatting and is not this file's business.
// --------------------------------------------------------------------------- //

/**
 * A `DecimalField(10, 2)` as Ninja serialises it: fixed point, two decimals,
 * always, and never a JSON number.
 *
 * `Math.round` is half-up towards `+∞`, which disagrees with Postgres on a
 * negative half; rounding the magnitude instead gives the half-away-from-zero the
 * column actually stores. Prices are never negative — but an order whose items
 * were removed below its frozen discount *is*, and that total must still print.
 */
export function decimalString(value: number | string): Money {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return '0.00';
  const magnitude = Math.round(Math.abs(numeric) * 100) / 100;
  return (numeric < 0 ? -magnitude : magnitude).toFixed(2);
}

/** The same, for a nullable column. `null` in, `null` out. */
export function decimalStringOrNull(value: number | string | null | undefined): Money | null {
  if (value === null || value === undefined || value === '') return null;
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? decimalString(numeric) : null;
}

/** GEL to tetri. Integer arithmetic is the only exact arithmetic available. */
export function toMinor(value: Money | number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric * 100) : 0;
}

/** Tetri back to the wire's 2-dp string. */
export function fromMinor(minor: number): Money {
  return (Math.round(minor) / 100).toFixed(2);
}

/**
 * `Decimal.quantize(Decimal("0.01"))` with Python's default context, which breaks
 * an exact tie towards the **even** neighbour. `Math.round` breaks it away from
 * zero, so a percentage landing on exactly half a tetri would round the other way
 * and the cart's quote would disagree with the order by one tetri — the single
 * most annoying class of bug a shop can ship.
 *
 * Input and output are in tetri, so "quantize to two decimals" is "round to an
 * integer" here. Negatives are handled correctly by construction: `Math.floor` of
 * `-2.5` is `-3`, whose parity sends the tie up to `-2`, which is what Python
 * gives.
 *
 * The seed additionally avoids values that land on a half-tetri, so in practice
 * the two never have to disagree — this is the belt to that pair of braces.
 */
export function roundHalfEven(value: number): number {
  const floor = Math.floor(value);
  const fraction = value - floor;
  if (fraction > 0.5) return floor + 1;
  if (fraction < 0.5) return floor;
  return floor % 2 === 0 ? floor : floor + 1;
}
