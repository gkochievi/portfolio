// Truck-aware (HGV) routing client. Calls our Django proxy at
// POST /api/orders/route-profile/ which forwards to OpenRouteService and
// keeps the API key server-side.
//
// Free tier on ORS is 2000 directions-hgv requests/day; the proxy also caches
// identical coordinate sets in-process for 30 minutes. We additionally cache
// in-memory here so repeated re-renders never re-hit the backend at all.

import api from './client';

const cache = new Map();

const cacheKey = (coordinates) => JSON.stringify(coordinates);

/**
 * Fetch an HGV route + elevation + steepness for a list of [lng, lat] pairs.
 * @param {[number, number][]} coordinates - >=2 valid pairs
 * @returns {Promise<object>} ORS GeoJSON feature collection
 * @throws {Error & { code?: string }} - .code is one of:
 *   missing_key, invalid_input, no_route, rate_limited, upstream_error,
 *   network_error, unauthorized
 */
export async function fetchTruckRoute(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    const err = new Error('At least two coordinates are required.');
    err.code = 'invalid_input';
    throw err;
  }

  const key = cacheKey(coordinates);
  if (cache.has(key)) return cache.get(key);

  try {
    const { data } = await api.post('/orders/route-profile/', { coordinates });
    cache.set(key, data);
    return data;
  } catch (e) {
    const status = e.response?.status;
    const body = e.response?.data;
    const err = new Error(body?.detail || e.message || 'Routing request failed.');
    err.code = body?.code
      || (status === 401 ? 'unauthorized'
      : status === 429 ? 'rate_limited'
      : status === 404 ? 'no_route'
      : status === 503 ? 'missing_key'
      : status === 400 ? 'invalid_input'
      : 'network_error');
    throw err;
  }
}

export function clearTruckRouteCache() {
  cache.clear();
}
