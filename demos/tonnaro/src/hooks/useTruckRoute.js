import { useEffect, useRef, useState } from 'react';

import { fetchTruckRoute } from '../api/orsClient';
import {
  cumulativeDistanceKm,
  maxGradientPct,
  movingAverage,
} from '../utils/elevation';

/**
 * Fetch a truck-aware route + elevation for the given waypoints, computing
 * derived stats (smoothed elevations, cumulative distance, max gradient).
 *
 * @param {Array<{lat:number,lng:number}|[number,number,number?]|null>} waypoints
 *        Accepts {lat,lng} objects or [lng,lat] tuples. Falsy entries skipped.
 * @returns {{
 *   route: object | null,           // raw ORS GeoJSON
 *   points: [number,number,number][],  // [lng, lat, elevation_m]
 *   smoothedElevations: number[],
 *   cumulativeKm: number[],
 *   steepnessSegments: [number, number, number][],  // [startIdx, endIdx, category]
 *   summary: { distanceKm, durationSec, ascentM, descentM, maxGradePct } | null,
 *   loading: boolean,
 *   error: { code: string, message: string } | null,
 * }}
 */
export default function useTruckRoute(waypoints) {
  const coords = normalizeWaypoints(waypoints);
  const coordKey = JSON.stringify(coords);

  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const lastKey = useRef(null);

  useEffect(() => {
    if (coords.length < 2) {
      setRoute(null);
      setError(null);
      setLoading(false);
      lastKey.current = coordKey;
      return undefined;
    }
    if (lastKey.current === coordKey && route) return undefined;
    lastKey.current = coordKey;

    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchTruckRoute(coords)
      .then((data) => {
        if (cancelled) return;
        setRoute(data);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setRoute(null);
        setError({ code: e.code || 'network_error', message: e.message });
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // `route` is intentionally not a dep — we only refetch on coord change.
    // eslint-disable-next-line
  }, [coordKey]);

  const feature = route?.features?.[0];
  const rawPoints = feature?.geometry?.coordinates || [];
  const elevations = rawPoints.map((p) => p[2] ?? 0);
  const smoothedElevations = movingAverage(elevations, 5);
  const cumulativeKm = cumulativeDistanceKm(rawPoints);
  // ORS uses `extras` in the response (the request param is `extra_info`, but the
  // response key is `extras` — easy to miss in the docs).
  const steepnessSegments = feature?.properties?.extras?.steepness?.values
    || feature?.properties?.extra_info?.steepness?.values
    || [];

  const summary = feature
    ? {
        distanceKm: (feature.properties?.summary?.distance ?? 0) / 1000,
        durationSec: feature.properties?.summary?.duration ?? 0,
        ascentM: feature.properties?.ascent ?? 0,
        descentM: feature.properties?.descent ?? 0,
        maxGradePct: maxGradientPct(rawPoints, smoothedElevations),
      }
    : null;

  return {
    route,
    points: rawPoints,
    smoothedElevations,
    cumulativeKm,
    steepnessSegments,
    summary,
    loading,
    error,
  };
}

function normalizeWaypoints(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  for (const wp of input) {
    if (!wp) continue;
    let lng;
    let lat;
    if (Array.isArray(wp) && wp.length >= 2) {
      lng = Number(wp[0]);
      lat = Number(wp[1]);
    } else if (typeof wp === 'object') {
      lng = Number(wp.lng);
      lat = Number(wp.lat);
    } else {
      continue;
    }
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    out.push([lng, lat]);
  }
  // ORS rejects identical consecutive points with a 400 — drop dupes pre-flight.
  const dedup = [];
  for (const p of out) {
    const last = dedup[dedup.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) dedup.push(p);
  }
  return dedup;
}
