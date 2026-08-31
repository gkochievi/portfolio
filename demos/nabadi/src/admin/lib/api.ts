/**
 * The seam. Upstream this file is `fetch` against Django; here the server is
 * `dispatch()` from `src/demo/router.ts`, a function call in this same tab.
 *
 * Everything above this file is ported code nobody touched, so the public
 * surface — `ApiError`, `API_BASE`, `api.get/post/patch/delete/postMultipart`
 * and `apiDownload` — is exactly what it was. Only what happens behind those
 * functions changed, and the two behaviours the console leans on are kept
 * whole: ONE shared in-flight refresh for concurrent 401s, and a redirect to
 * the login when it fails.
 */

// Registering a route is a module side effect, and the seam is the one module
// guaranteed to be loaded before anything can dispatch. `main.tsx` imports
// `./demo` as well; both reach the same module instance, so this costs nothing.
import '../../demo/handlers';
import { DemoApiError } from '../../demo/base';
import { dispatch, isFileResponse } from '../../demo/router';
import { ROUTER_MODE, surfaceUrl } from '../../surface';

/**
 * Upstream: `import.meta.env.VITE_API_URL || 'http://localhost:8000/api'`.
 *
 * Here it is derived from the deploy base, because `dispatch()` strips exactly
 * `${BASE_URL}api` off the front of the path it is handed. The exact value also
 * matters one level up: `pages/admin/BarberDetail.tsx` builds a media host by
 * stripping `/api` off this string, and `serialize.mediaUrl()` answers with a
 * fully-qualified URL precisely so that helper's `startsWith('http')`
 * passthrough fires instead of prefixing the deploy base a second time.
 */
export const API_BASE = `${import.meta.env.BASE_URL}api`;

export class ApiError extends Error {
  status: number;
  code: string;
  field: string | null;

  constructor(status: number, code: string, message: string, field: string | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * The double-submit CSRF header — built, and dropped.
 *
 * It is inert by construction, not by neglect. CSRF protects a server from a
 * request some other origin made on the visitor's behalf; the "server" here is
 * a function in this bundle, reached without a request, so there is nothing to
 * forge and nothing on the far side to compare a token against. The read stays
 * because this file is the seam: the shape upstream ships is the shape that has
 * to go back the day there is a Django to talk to again.
 */
function csrfHeader(method: string): Record<string, string> {
  if (!UNSAFE_METHODS.has(method.toUpperCase())) return {};
  const csrf = getCookie('csrftoken');
  return csrf ? { 'X-CSRFToken': csrf } : {};
}

// Paths that must never trigger (or recurse into) a silent refresh. A 401 from
// the refresh endpoint itself would loop forever; a 401 from login is a real
// credential failure that the caller surfaces inline.
const REFRESH_PATH = '/auth/refresh/';
const NO_REFRESH_PATHS = new Set([REFRESH_PATH, '/auth/login/']);

function shouldAttemptRefresh(path: string): boolean {
  return !NO_REFRESH_PATHS.has(path);
}

// Module-level singleton: concurrent 401s share ONE in-flight refresh call so we
// neither hammer the endpoint nor loop. Resolves true when the refresh succeeds.
let refreshInFlight: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      // There is no token to rotate. `POST /auth/refresh/` answers 204 while a
      // user is signed in and 401 `not_authenticated` when nobody is — which is
      // the only question upstream's refresh cookie ever really answered, and
      // the only one that decides between a retry and the login page. `res.ok`
      // becomes "dispatch did not throw".
      await dispatch('POST', `${API_BASE}${REFRESH_PATH}`);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

/**
 * Upstream this is `window.location.assign('/login?next=…')` — a full page load,
 * and the one thing this demo cannot survive: the store lives in memory, so a
 * load would silently reset the whole world on nothing more than an anonymous
 * deep link into the console. It is also the wrong path under a deploy base.
 *
 * A history push does the same job without leaving the document. `surface.ts`
 * already knows the base and the router mode; deriving either here would be a
 * second copy of that knowledge, drifting.
 */
function redirectToLogin(): void {
  if (typeof window === 'undefined') return;
  const next = encodeURIComponent(window.location.pathname + window.location.search);
  const target = `${surfaceUrl('admin')}login?next=${next}`; // surfaceUrl ends in a slash
  if (ROUTER_MODE === 'hash') {
    window.location.hash = target.slice(target.indexOf('#') + 1);
  } else {
    window.history.pushState(null, '', target);
    // `pushState` fires no event of its own, and the router is listening for one.
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
}

/**
 * `fetch` was handed `JSON.stringify(body)` and the view was handed whatever
 * `json.loads` made of it. Round-tripping reproduces both halves: `undefined`
 * members and `toJSON` conversions collapse exactly as they did on the wire, and
 * a handler cannot store an object the component that posted it still holds a
 * live reference to. A body `JSON.stringify` refuses stays `undefined`, which is
 * what `fetch` would have sent for it — nothing.
 */
function jsonBody(body: unknown): unknown {
  if (body === undefined) return undefined;
  const text = JSON.stringify(body);
  return text === undefined ? undefined : JSON.parse(text);
}

/**
 * `DemoApiError.body` carries the same `{code, message, field}` the response
 * body did, so this is the parse that used to live in `parseError`.
 *
 * Anything else escaping `dispatch` is a bug in the mock rather than a reply and
 * is rethrown untouched, the way a network `TypeError` used to reach the caller.
 */
function toThrowable(error: unknown): unknown {
  if (error instanceof DemoApiError) {
    return new ApiError(error.status, error.code, error.message, error.field);
  }
  return error;
}

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

/** One trip through the mock, with the mock's error type translated on the way out. */
async function send(method: HttpMethod, path: string, body?: unknown): Promise<unknown> {
  try {
    return await dispatch(method, `${API_BASE}${path}`, { body });
  } catch (error) {
    throw toThrowable(error);
  }
}

/**
 * Runs `run`, and on a 401 (for a refresh-eligible path) attempts ONE silent
 * refresh then retries exactly once. If the refresh fails, the console is
 * pushed to its login and the **original** 401 is thrown, which is what the
 * callers' error handling was written against.
 *
 * The only change from upstream is where the 401 shows up: it arrives as a
 * throw rather than as a `res.status`, because `dispatch` has no response
 * object to hand back.
 */
async function withRefresh(path: string, run: () => Promise<unknown>): Promise<unknown> {
  try {
    return await run();
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401 || !shouldAttemptRefresh(path)) {
      throw error;
    }
    if (!(await refreshSession())) {
      redirectToLogin();
      throw error;
    }
    // Exactly one retry. A second 401 propagates — no loop, ever.
    return run();
  }
}

/**
 * `dispatch` resolves `null` where `fetch` gave a 204, and there is no
 * `res.status` left to test. No endpoint answers a bare JSON `null`
 * (schema.md §4.4), so reading that null back as `undefined` is lossless — and
 * the console's 204 callers expect `undefined`, not `null`.
 */
function fromDispatch<T>(result: unknown): T {
  return (result === null ? undefined : result) as T;
}

async function request<T>(path: string, method: HttpMethod = 'GET', body?: unknown): Promise<T> {
  void csrfHeader(method);
  return fromDispatch<T>(await withRefresh(path, () => send(method, path, jsonBody(body))));
}

/**
 * Downloads a file (the three XLSX exports) through the same refresh-aware
 * pipeline as JSON requests: a 401 triggers ONE silent refresh and a retry, so
 * an expired session doesn't fail the export silently. A failing reply throws an
 * `ApiError` before any blob is touched, exactly as the `!res.ok` check did.
 */
export async function apiDownload(path: string, fallbackFilename: string): Promise<void> {
  const result = await withRefresh(path, () => send('GET', path));

  // Only the export routes return a `file()`, and they are the only routes
  // `apiDownload` is pointed at. Anything else here is a handler answering with
  // the wrong kind of reply — upstream that arrived as a JSON payload the
  // browser happily saved under the fallback name, which is a silently corrupt
  // download rather than an error anybody could act on.
  if (!isFileResponse(result)) {
    throw new ApiError(500, 'server_error', `${path} did not answer with a file.`);
  }

  // Upstream the name came out of `content-disposition`; `file()` carries it as
  // a field instead. The fallback stays for the reason it existed: a reply that
  // names no file still has to land on the caller's default.
  const filename = result.filename || fallbackFilename;
  const objectUrl = URL.createObjectURL(result.blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

async function requestMultipart<T>(
  path: string,
  form: FormData,
  method: HttpMethod = 'POST',
): Promise<T> {
  // The `FormData` crosses by reference: there is no multipart encoding step to
  // imitate, and the handler reads the `File` off it directly to build an object
  // URL. Nothing to JSON-round-trip, so it does not go through `jsonBody`.
  void csrfHeader(method);
  return fromDispatch<T>(await withRefresh(path, () => send(method, path, form)));
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, 'POST', body),
  patch: <T>(path: string, body: unknown) => request<T>(path, 'PATCH', body),
  delete: <T>(path: string) => request<T>(path, 'DELETE'),
  postMultipart: <T>(path: string, form: FormData) => requestMultipart<T>(path, form, 'POST'),
};
