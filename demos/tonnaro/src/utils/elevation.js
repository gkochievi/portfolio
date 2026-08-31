// Pure math helpers for the truck-routing elevation profile.
// No React, no UI, no I/O — easy to unit-test in isolation.

const EARTH_RADIUS_M = 6371008.8;

const toRad = (deg) => (deg * Math.PI) / 180;

/** Great-circle distance in METERS between [lng, lat] points. */
export function haversineMeters(a, b) {
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const h = s1 * s1 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * s2 * s2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Symmetric centred moving average. Window must be odd; falls back to raw at the edges. */
export function movingAverage(values, window = 5) {
  if (!Array.isArray(values) || values.length === 0) return [];
  const w = Math.max(1, window | 0);
  const half = Math.floor(w / 2);
  const out = new Array(values.length);
  for (let i = 0; i < values.length; i += 1) {
    const start = Math.max(0, i - half);
    const end = Math.min(values.length, i + half + 1);
    let sum = 0;
    for (let j = start; j < end; j += 1) sum += values[j];
    out[i] = sum / (end - start);
  }
  return out;
}

/**
 * Build cumulative distance (km) along a polyline of [lng, lat, ...] points.
 * Returns array same length as input, starting at 0.
 */
export function cumulativeDistanceKm(points) {
  if (!Array.isArray(points) || points.length === 0) return [];
  const out = new Array(points.length);
  out[0] = 0;
  for (let i = 1; i < points.length; i += 1) {
    out[i] = out[i - 1] + haversineMeters(points[i - 1], points[i]) / 1000;
  }
  return out;
}

/**
 * Maximum |gradient| as a percent, computed over rolling baselines of at
 * least MIN_BASELINE_M meters. Adjacent-point gradients are unreliable
 * because ORS' elevation DEM samples on a coarse grid: two route points
 * a few meters apart can have a 3-4 m elevation jump from interpolation
 * noise, producing absurd 50%+ "gradients" that are not real road slopes.
 *
 * Algorithm: walk forward summing horizontal distance until we've covered
 * at least MIN_BASELINE_M, then compute Δelevation / Δdistance for that
 * stretch and advance the start by one point. This averages DEM noise
 * over a 50m+ window while still catching genuinely steep stretches.
 */
const MIN_BASELINE_M = 50;
export function maxGradientPct(points, smoothedElevations) {
  if (!Array.isArray(points) || points.length < 2) return 0;
  let max = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    let distM = 0;
    let j = i + 1;
    while (j < points.length && distM < MIN_BASELINE_M) {
      distM += haversineMeters(points[j - 1], points[j]);
      j += 1;
    }
    if (distM < 5) continue;
    const dE = smoothedElevations[j - 1] - smoothedElevations[i];
    const grade = Math.abs((dE / distM) * 100);
    if (grade > max) max = grade;
  }
  return max;
}

/**
 * ORS steepness category → hex color.
 * 0  = 0–3%, ±1 = 3–6%, ±2 = 6–9%, ±3 = 9–12%, ±4 = 12–15%, ±5 = >15%.
 * Spec lumps everything beyond ±2 into red.
 */
export function steepnessColor(category) {
  const abs = Math.abs(category | 0);
  if (abs === 0) return '#22c55e';
  if (abs === 1) return '#eab308';
  if (abs === 2) return '#f97316';
  return '#ef4444';
}

/** "1:23" or "0:07" — duration formatter from seconds. */
export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const total = Math.round(seconds / 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}
