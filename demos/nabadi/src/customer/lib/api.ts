/**
 * The seam. Upstream this file is `fetch` against Django; here the server is
 * `dispatch()` from `src/demo/router.ts`, a function call in this same tab.
 *
 * Everything above this file is ported code nobody touched, so the public
 * surface — `ApiError` and `api.get/post/patch/delete` — is exactly what it was:
 * a `catch (err) { err.code }` written against the real backend still reads the
 * same three fields. Only what happens behind those four functions changed.
 */

// Registering a route is a module side effect, and the seam is the one module
// guaranteed to be loaded before anything can dispatch. `main.tsx` imports
// `./demo` as well; both reach the same module instance, so this costs nothing.
import '../../demo/handlers';
import { DemoApiError } from '../../demo/base';
import { dispatch } from '../../demo/router';

/**
 * Upstream: `import.meta.env.VITE_API_URL || 'http://localhost:8000/api'`.
 *
 * Here it is derived from the deploy base, because `dispatch()` strips exactly
 * `${BASE_URL}api` off the front of the path it is handed. A hard-coded `/api`
 * would work under `VITE_BASE=/` and 404 every request under the portfolio's
 * real base — see the note above `API_PREFIX` in `demo/router.ts`.
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
  if (!UNSAFE_METHODS.has(method)) return {};
  const csrf = getCookie('csrftoken');
  return csrf ? { 'X-CSRFToken': csrf } : {};
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
 * body did, so this is the parse that used to live in the `!res.ok` branch.
 *
 * Anything else escaping `dispatch` is a bug in the mock rather than a reply and
 * is rethrown untouched: upstream a network failure arrived as the browser's
 * `TypeError` rather than an `ApiError`, and `<ErrorMessage>` already renders
 * nothing for a throw of the wrong type.
 */
function toThrowable(error: unknown): unknown {
  if (error instanceof DemoApiError) {
    return new ApiError(error.status, error.code, error.message, error.field);
  }
  return error;
}

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

async function request<T>(path: string, method: HttpMethod = 'GET', body?: unknown): Promise<T> {
  void csrfHeader(method);

  let result: unknown;
  try {
    result = await dispatch(method, `${API_BASE}${path}`, { body: jsonBody(body) });
  } catch (error) {
    throw toThrowable(error);
  }
  // `dispatch` resolves `null` where `fetch` gave a 204, and there is no
  // `res.status` left to test. No endpoint answers a bare JSON `null`
  // (schema.md §4.4), so reading that null back as `undefined` is lossless —
  // and the callers of the six 204 endpoints expect `undefined`, not `null`.
  return (result === null ? undefined : result) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, 'POST', body),
  patch: <T>(path: string, body: unknown) => request<T>(path, 'PATCH', body),
  delete: <T>(path: string) => request<T>(path, 'DELETE'),
};
