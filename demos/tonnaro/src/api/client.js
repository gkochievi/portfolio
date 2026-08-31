/**
 * The seam.
 *
 * Every call the app makes still arrives here with the signature it had
 * against Django, and still resolves to `{data}` or rejects with something
 * carrying `.response.data` and `.response.status` — so the 152 call sites
 * upstream, and every `catch (err) { err.response?.data }` in them, are
 * untouched. What changed is the other side: instead of axios reaching a
 * Django server, a request is dispatched to the in-browser mock.
 *
 * The two axios interceptors are reproduced rather than removed, because they
 * are load-bearing behaviour: the bearer token is attached per request, and a
 * 401 still burns one refresh attempt before giving up and bouncing to a login
 * page. The demo's tokens are stateless the way real JWTs are — they name a
 * user rather than pointing at a session record — so a reload keeps you signed
 * in while the data resets to the pristine seed, which is exactly what a JWT
 * does across a server restart.
 */
import { DemoApiError, dispatch, isFileResponse } from '../demo/router';
import { APP_BASE, appLocation } from '../demo/base';
import '../demo/handlers';

const API_URL = '/api';

/* ----------------------------------------------------------------- tokens */

function readTokens() {
  try {
    return JSON.parse(localStorage.getItem('tokens') || 'null');
  } catch {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem('tokens');
  localStorage.removeItem('user');
}

/* ----------------------------------------------------------------- errors */

/**
 * A handler's failure wearing axios's clothes. Upstream reads
 * `err.response.data`, `err.response.status` and occasionally `err.message`;
 * nothing reads anything else off an axios error, so nothing else is invented
 * here.
 */
class DemoRequestError extends Error {
  constructor(demoError) {
    super(demoError.message);
    this.name = 'AxiosError';
    this.isAxiosError = true;
    this.response = {
      data: demoError.data,
      status: demoError.status,
      statusText: String(demoError.status),
      headers: {},
    };
  }
}

/* -------------------------------------------------------------- responses */

/**
 * An attachment, as axios would have delivered it under
 * `{responseType: 'blob'}`: a real Blob plus the `content-disposition` the CSV
 * export buttons parse a filename out of.
 */
function asAttachment(result) {
  const blob = new Blob([result.blob], { type: result.contentType });
  return {
    data: blob,
    status: 200,
    statusText: 'OK',
    headers: {
      'content-type': result.contentType,
      'content-disposition': `attachment; filename="${result.filename}"`,
    },
  };
}

function asJson(data) {
  return { data, status: data === null ? 204 : 200, statusText: 'OK', headers: {} };
}

/* ------------------------------------------------------------- the client */

/**
 * One request, with the refresh-and-retry the response interceptor used to do.
 * `retried` is the `_retry` flag from upstream: a refresh is attempted once per
 * originating call, never in a loop.
 */
async function send(method, path, config = {}, retried = false) {
  const { params, body, headers } = config;
  const tokens = readTokens();

  let result;
  try {
    result = await dispatch(method, `${API_URL}${path}`, {
      params,
      body,
      headers,
      token: tokens?.access,
    });
  } catch (error) {
    if (!(error instanceof DemoApiError)) throw error;

    if (error.status === 401 && !retried && tokens?.refresh) {
      try {
        const refreshed = await dispatch('POST', `${API_URL}/auth/token/refresh/`, {
          body: { refresh: tokens.refresh },
        });
        localStorage.setItem('tokens', JSON.stringify({
          access: refreshed.access,
          refresh: refreshed.refresh || tokens.refresh,
        }));
        return send(method, path, config, true);
      } catch {
        clearSession();
        // Upstream sent admins to the dedicated login and everyone else to the
        // public homepage. Same rule, resolved against the build's base so a
        // dead session does not navigate out of the demo and into the
        // portfolio shell.
        const isAdminRoute = appLocation().startsWith('/admin');
        window.location.href = `${APP_BASE}${isAdminRoute ? '/login' : '/'}`;
      }
    }

    throw new DemoRequestError(error);
  }

  return isFileResponse(result) ? asAttachment(result) : asJson(result);
}

const api = {
  get: (path, config = {}) => send('GET', path, config),
  post: (path, body, config = {}) => send('POST', path, { ...config, body }),
  patch: (path, body, config = {}) => send('PATCH', path, { ...config, body }),
  put: (path, body, config = {}) => send('PUT', path, { ...config, body }),
  delete: (path, config = {}) => send('DELETE', path, config),
};

export default api;
