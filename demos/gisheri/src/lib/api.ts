/**
 * The seam. Upstream this file is `fetch` against Django-Ninja; here the server
 * is `dispatch()` from `src/demo/router.ts`, a function call in this same tab.
 *
 * Everything above this file is ported code nobody touched — `context/auth.tsx`
 * and eight `*-api.ts` wrappers are byte-identical copies — so the public
 * surface is exactly what it was: `tokenStore`'s four methods, `ApiError`'s
 * three fields, `FetchOptions` and the four verbs on `api`. A component
 * written against the real backend still reads the same `err.status` and
 * `err.detail`. Only what happens behind those four functions changed.
 *
 * Two behaviours that look incidental are load-bearing and are preserved
 * literally: the single 401 retry, and `tryRefresh()`'s module-level promise
 * dedupe. The admin console fires half a dozen list queries in parallel on
 * first paint, and without the dedupe an expired access token would mint half
 * a dozen refreshes — the last of which lands after the others have already
 * rotated it, and signs the visitor out mid-page.
 *
 * Token storage is **memory**, not `localStorage`: this is a demo, and the one
 * Web Storage key the house rules allow it is `gisheri:lang`. A reload signs
 * you out, which the banner makes a one-click problem rather than a dead end.
 */

// Registering a route is a module side effect, and the seam is the one module
// guaranteed to be evaluated before anything can dispatch. `main.tsx` imports
// `./demo` as well; both reach the same module instance, so this costs nothing
// and removes the ordering assumption.
import '@/demo/handlers';
import { DemoApiError } from '@/demo/base';
import { dispatch } from '@/demo/router';

/**
 * Upstream: `import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api'`.
 *
 * Here it is derived from the deploy base, because `dispatch()` strips exactly
 * `${BASE_URL}api` off the front of the path it is handed. A hard-coded `/api`
 * would work under `VITE_BASE=/` and 404 every request under the portfolio's
 * real base — see `API_PREFIXES` in `demo/base-path.ts`, which builds the same
 * string from the same source so the two ends cannot drift.
 */
const API_BASE = `${import.meta.env.BASE_URL}api`;

// Upstream these were a pair of `localStorage` keys. Two module-level `let`s
// instead: the same read-on-every-call semantics, so a login or a silent
// refresh takes effect on the very next request, but nothing outlives the tab.
let accessToken: string | null = null;
let refreshToken: string | null = null;

export const tokenStore = {
  getAccess(): string | null {
    return accessToken;
  },
  getRefresh(): string | null {
    return refreshToken;
  },
  set(access: string, refresh?: string) {
    accessToken = access;
    // Upstream only wrote the refresh key when one was supplied, because
    // `/auth/refresh` answers with an access token alone and must not clear the
    // refresh token that produced it.
    if (refresh) refreshToken = refresh;
  },
  clear() {
    accessToken = null;
    refreshToken = null;
  },
};

export class ApiError extends Error {
  status: number;
  detail: string;
  body: unknown;

  constructor(status: number, detail: string, body: unknown) {
    super(detail);
    this.status = status;
    this.detail = detail;
    this.body = body;
  }
}

interface FetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Skip the auth header even if a token is present. */
  skipAuth?: boolean;
}

/**
 * `fetch` was handed `JSON.stringify(body)` and the Ninja view was handed
 * whatever `json.loads` made of it. Round-tripping reproduces both halves:
 * `undefined` members and `toJSON` conversions collapse exactly as they did on
 * the wire, and a handler cannot end up storing an object that the component
 * which posted it still holds a live reference to — which would let an edit
 * form mutate the store by typing. A body `JSON.stringify` refuses stays
 * `undefined`, which is what `fetch` would have sent for it: nothing.
 */
function jsonBody(body: unknown): unknown {
  if (body === undefined) return undefined;
  const text = JSON.stringify(body);
  return text === undefined ? undefined : JSON.parse(text);
}

let refreshPromise: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  const refresh = tokenStore.getRefresh();
  if (!refresh) return null;

  refreshPromise = (async () => {
    try {
      // `token: null` rather than the default, because upstream built this one
      // request by hand with no `Authorization` header: a refresh must work
      // precisely when the access token is the thing that has expired.
      //
      // Upstream had two failure branches here — a non-2xx response and a
      // thrown network error — and both cleared the tokens. `dispatch` throws
      // for either, so they collapse into the one `catch`.
      const data = await dispatch<{ access: string }>('POST', `${API_BASE}/auth/refresh`, {
        body: { refresh },
        token: null,
      });
      // The endpoint answers `{access}` only; the refresh token is not rotated,
      // so it is re-stored as it was.
      tokenStore.set(data.access, refresh);
      return data.access;
    } catch {
      tokenStore.clear();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * A reply, or the error that stood in for one.
 *
 * `fetch` resolved even for a 401 and left the caller to read `res.status`;
 * `dispatch` throws instead. Catching that back into a value is what lets the
 * retry block below stay the flat `if` it is upstream rather than a nest of
 * `try`/`catch` around two call sites, which is where this kind of code goes
 * wrong. It is deliberately **not** a discriminated union: this file is checked
 * by the ported tree's project, which runs `strict: false`, and without
 * `strictNullChecks` TypeScript will not narrow on an `ok: true | false`
 * discriminant — it compiles clean under strict and fails here.
 */
interface Reply {
  value: unknown;
  error: DemoApiError | null;
}

async function request<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const { body, skipAuth, method = 'GET' } = options;

  // `headers` is still accepted by `FetchOptions` and is now inert, by
  // construction rather than by neglect: there is no wire, so there is no
  // `Content-Type` to negotiate, and the one header this app ever set —
  // `Authorization: Bearer …` — became `dispatch`'s `token` option. The shape
  // stays because this file is the seam: it is what has to go back the day
  // there is a Django to talk to again.
  const fire = async (token: string | null): Promise<Reply> => {
    try {
      const value = await dispatch<unknown>(method, url, { body: jsonBody(body), token });
      return { value, error: null };
    } catch (error) {
      if (error instanceof DemoApiError) return { value: null, error };
      // Anything else escaping `dispatch` is a bug in the mock rather than a
      // reply, and is rethrown untouched — upstream a genuine transport failure
      // arrived as the browser's `TypeError`, not as an `ApiError`, and every
      // caller already handles a throw of the wrong type by not handling it.
      throw error;
    }
  };

  let token = skipAuth ? null : tokenStore.getAccess();
  let res = await fire(token);

  if (res.error?.status === 401 && !skipAuth && tokenStore.getRefresh()) {
    const next = await tryRefresh();
    if (next) {
      token = next;
      res = await fire(token);
    }
  }

  if (res.error) {
    // `DemoApiError` already carries the `detail` string the response body
    // would have held — including the degraded `Request failed (422)` for the
    // one shape whose `detail` is a list rather than a string — so this is the
    // parse that used to live in the `!res.ok` branch, done once, upstream.
    throw new ApiError(res.error.status, res.error.detail, res.error.body);
  }

  // `dispatch` resolves `null` where an empty 204 body parsed to `null`
  // upstream, so the cast lands on exactly the value the caller had before.
  return res.value as T;
}

export const api = {
  get: <T>(path: string, opts?: FetchOptions) => request<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body?: unknown, opts?: FetchOptions) =>
    request<T>(path, { ...opts, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, opts?: FetchOptions) =>
    request<T>(path, { ...opts, method: 'PATCH', body }),
  delete: <T>(path: string, opts?: FetchOptions) => request<T>(path, { ...opts, method: 'DELETE' }),
};
