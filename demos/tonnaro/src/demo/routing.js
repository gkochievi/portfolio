/**
 * Truck routing.
 *
 * Upstream, `POST /orders/route-profile/` proxies OpenRouteService's
 * `directions/driving-hgv` endpoint with `{elevation: true, extra_info:
 * ['steepness']}` and passes the GeoJSON straight back. There is no road graph
 * in a browser tab, so this synthesises one instead.
 *
 * Synthesised, not pre-baked, for one reason: a visitor *will* drop pins in
 * places nobody seeded. Five fixture files would cover five journeys and error
 * on the sixth. This covers every pair of points in the country, and — more
 * importantly — it is **internally consistent by construction**, which a
 * hand-written fixture is not:
 *
 *   · `summary.distance` is the haversine length of the geometry it ships,
 *     so the chart's X axis (computed from the geometry) and the Distance stat
 *     (read from the summary) cannot disagree.
 *   · `ascent`/`descent` are the summed positive/negative elevation deltas of
 *     that same geometry, so "Total ascent 2 400 m" always matches a chart
 *     that visibly climbs 2 400 m.
 *   · The steepness bands are run-length-encoded from the real per-point
 *     gradients and tile the polyline contiguously from 0 to N-1, which is
 *     what ORS emits and what `RouteLayer` slices against.
 *
 * It is also **deterministic**: the same coordinates always produce the same
 * route. That matters twice over. `orsClient` caches by coordinate list with
 * no TTL and no eviction, so a second answer for the same request would be
 * unreachable anyway; and the seed computes each order's stored
 * `route_stops.distance/duration/ascent` by calling straight into here, so an
 * admin opening a seeded order never trips the drift check that would rewrite
 * its price under the viewer.
 *
 * What it is not: real roads. The line wanders plausibly and the terrain has
 * the right large-scale shape — high in the Caucasus, falling to the Black Sea
 * — but it does not follow the Georgian Military Highway. For a demo of the
 * ordering product, the route panel needs to be coherent, not surveyed.
 */

/* --------------------------------------------------------------- geometry */

const EARTH_KM = 6371.0088
const RAD = Math.PI / 180

export function haversineKm(aLng, aLat, bLng, bLat) {
  const dLat = (bLat - aLat) * RAD
  const dLng = (bLng - aLng) * RAD
  const lat1 = aLat * RAD
  const lat2 = bLat * RAD
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

/* ------------------------------------------------------------ determinism */

/** A stable 32-bit hash of two integers — the lattice key for the noise below. */
function hash2(x, y) {
  let h = x * 374761393 + y * 668265263
  h = (h ^ (h >>> 13)) * 1274126177
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

function smoothstep(t) {
  return t * t * (3 - 2 * t)
}

/** Value noise on a lattice of `scale` degrees, bilinearly interpolated. */
function noise(lng, lat, scale) {
  const x = lng / scale
  const y = lat / scale
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = smoothstep(x - x0)
  const fy = smoothstep(y - y0)

  const a = hash2(x0, y0)
  const b = hash2(x0 + 1, y0)
  const c = hash2(x0, y0 + 1)
  const d = hash2(x0 + 1, y0 + 1)

  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy
}

/* ----------------------------------------------------------------- terrain */

/**
 * Real elevations at real places — `[lng, lat, metres]`.
 *
 * A parametric hill function was tried first and produced a country whose
 * shape was roughly right and whose numbers were all wrong: Gudauri came out
 * at 990 m against a true 2 200, and Batumi sat 100 m above the sea it is on.
 * Interpolating between surveyed anchors instead gets every place the demo
 * actually names to within a few tens of metres, which is what makes the climb
 * out of the Mtkvari valley into the Caucasus read as a climb.
 *
 * Coverage matters more than count: the towns give the valleys, the ridge and
 * summit rows give the walls, and the sea rows stop the coast floating.
 */
const ANCHORS = [
  // Kartli and the Mtkvari corridor
  [44.827, 41.715, 450], [45.000, 41.549, 300], [44.721, 41.846, 470],
  [44.116, 41.985, 588], [43.599, 41.993, 690], [44.424, 41.925, 560],
  [45.096, 41.459, 300], [44.809, 41.478, 400], [44.538, 41.448, 530],
  // Samtskhe-Javakheti — the southern plateau
  [43.381, 41.839, 800], [42.983, 41.639, 1000], [43.486, 41.405, 1700],
  [43.588, 41.265, 1940], [43.532, 41.749, 1700], [43.286, 41.381, 1300],
  // Imereti and the descent to Kolkheti
  [42.695, 42.268, 120], [43.052, 42.111, 150], [42.337, 42.155, 30],
  [43.283, 42.294, 400], [42.994, 42.345, 550],
  // Samegrelo, Guria, Adjara — the coastal lowland
  [42.065, 42.271, 50], [41.871, 42.509, 100], [41.671, 42.146, 2],
  [41.559, 42.394, 2], [41.637, 41.617, 5], [41.777, 41.821, 5],
  [42.008, 41.925, 60],
  // Kakheti — the eastern valleys
  [45.473, 41.920, 750], [45.813, 41.953, 450], [46.276, 41.826, 420],
  [45.922, 41.619, 790], [46.106, 41.466, 800], [45.332, 41.733, 800],
  [46.500, 41.400, 200],
  // Racha, Svaneti and the Georgian Military Highway
  [43.155, 42.521, 550], [43.437, 42.579, 800], [42.728, 43.045, 1500],
  [44.643, 42.658, 1740], [44.483, 42.478, 2200], [44.686, 42.352, 1050],
  [44.706, 42.163, 800], [45.157, 42.660, 1400], [45.637, 42.372, 1900],
  // Greater Caucasus ridge — the wall along the northern border
  [42.700, 43.150, 4200], [43.500, 42.950, 3500], [44.500, 42.750, 3800],
  [45.500, 42.600, 3200], [46.200, 42.350, 3000], [42.100, 43.250, 3400],
  // Lesser Caucasus, southern border
  [43.000, 41.150, 2000], [44.000, 41.150, 1400], [45.000, 41.100, 1100],
  [42.400, 41.450, 1600],
  // The Black Sea, so the coast has something to fall to
  [41.200, 42.000, 0], [41.000, 41.750, 0], [41.250, 42.650, 0],
  [40.800, 42.300, 0],
]

const NEIGHBOURS = 6

/**
 * Elevation in metres, as inverse-distance weighting over the six nearest
 * anchors plus three octaves of value noise for local relief.
 *
 * The noise is scaled by how much the neighbours disagree, so flat country
 * stays flat and mountains get broken ground — a uniform amplitude would put
 * 60 m hills in the middle of the Kolkheti marshes.
 */
export function elevationAt(lng, lat) {
  const near = []
  for (let i = 0; i < ANCHORS.length; i += 1) {
    const [aLng, aLat, metres] = ANCHORS[i]
    // Plain degree distance, latitude-corrected: exact enough for weighting.
    const dx = (lng - aLng) * 0.75
    const dy = lat - aLat
    near.push({ d2: dx * dx + dy * dy, metres })
  }
  near.sort((a, b) => a.d2 - b.d2)

  let weighted = 0
  let total = 0
  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < NEIGHBOURS; i += 1) {
    const { d2, metres } = near[i]
    // Power 1.6 on the squared distance ≈ inverse-cube in linear distance:
    // local enough to honour each anchor, smooth enough not to make craters.
    const weight = 1 / (d2 ** 1.6 + 1e-7)
    weighted += weight * metres
    total += weight
    if (metres < min) min = metres
    if (metres > max) max = metres
  }

  const base = weighted / total
  // Held well under the anchors' own disagreement: enough to break up a ramp
  // into something a gradient chart can read, not enough to lift a town off
  // its surveyed height.
  const spread = Math.min(240, (max - min) * 0.13)

  const relief =
    spread * (noise(lng, lat, 0.11) - 0.5) +
    spread * 0.4 * (noise(lng, lat, 0.037) - 0.5) +
    spread * 0.15 * (noise(lng, lat, 0.012) - 0.5)

  return Math.max(0, base + relief)
}

/** Rough test for "this pin is in the Black Sea or outside the country". */
function unroutable(lng, lat) {
  if (lng < 39.9 || lng > 46.8 || lat < 40.9 || lat > 43.7) return true
  // The coastline runs roughly north-north-east; anything west of it is water.
  const coastLng = 41.52 + (lat - 41.5) * 0.16
  return lng < coastLng
}

/* ------------------------------------------------------------- the polyline */

/** Metres between consecutive points. The gradient walk in `utils/elevation.js`
 *  needs >= 50 m windows, so anything much coarser flattens the profile. */
const SPACING_M = 45
const MAX_POINTS = 1400

/**
 * One leg, as a wandering line rather than a straight one: two lateral
 * sinusoids whose phase and amplitude are derived from the endpoints, so the
 * shape is stable for a given pair but different for every pair.
 */
function leg(aLng, aLat, bLng, bLat, steps) {
  const km = haversineKm(aLng, aLat, bLng, bLat)
  // Perpendicular direction in degrees, corrected for latitude convergence.
  const dLng = bLng - aLng
  const dLat = bLat - aLat
  const norm = Math.hypot(dLng, dLat) || 1
  const perpLng = -dLat / norm
  const perpLat = dLng / norm

  // Wander scales with the leg: a 200 km haul detours further than a 5 km one,
  // but never by more than a few percent of its own length.
  const amplitude = Math.min(0.055, 0.012 + km * 0.00035)
  const phase = hash2(Math.round(aLng * 1000), Math.round(bLat * 1000)) * Math.PI * 2
  const waves = 1.5 + hash2(Math.round(bLng * 1000), Math.round(aLat * 1000)) * 2.5

  const points = []
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps
    // Taper to zero at both ends so the line starts and finishes on the pins.
    const swing = Math.sin(t * Math.PI * waves + phase) * Math.sin(t * Math.PI) * amplitude
    const lng = aLng + dLng * t + perpLng * swing
    const lat = aLat + dLat * t + perpLat * swing
    points.push([lng, lat])
  }
  return points
}

/** Roads are graded: they follow the terrain but cannot track every bump. */
function smooth(values, window) {
  const half = Math.floor(window / 2)
  return values.map((_, index) => {
    let sum = 0
    let count = 0
    for (let k = index - half; k <= index + half; k += 1) {
      if (k < 0 || k >= values.length) continue
      sum += values[k]
      count += 1
    }
    return sum / count
  })
}

/* ---------------------------------------------------------------- steepness */

/**
 * ORS steepness categories: 0 for under 3 %, then a band every 3 % up to 5 for
 * over 15 %, negative for descents. `steepnessColor` upstream takes the
 * absolute value, so a 12 % descent is coloured like a 12 % climb.
 */
function categorise(gradePct) {
  const magnitude = Math.abs(gradePct)
  const band = magnitude < 3 ? 0
    : magnitude < 6 ? 1
    : magnitude < 9 ? 2
    : magnitude < 12 ? 3
    : magnitude < 15 ? 4
    : 5
  return gradePct < 0 ? -band : band
}

/**
 * Run-length encode per-point categories into the contiguous
 * `[startIdx, endIdx, category]` bands ORS emits: each band's start is the
 * previous band's end, the first starts at 0 and the last ends at N-1. Short
 * runs are absorbed into their neighbour so the map shows 15-40 readable
 * colour changes instead of several hundred one-point flickers.
 */
function steepnessBands(categories) {
  const MIN_RUN = Math.max(4, Math.floor(categories.length / 60))
  const runs = []

  for (let i = 0; i < categories.length; i += 1) {
    const last = runs[runs.length - 1]
    if (last && last.category === categories[i]) last.end = i
    else runs.push({ start: i, end: i, category: categories[i] })
  }

  // Absorb runs too short to read, merging into whichever neighbour is longer.
  let index = 1
  while (index < runs.length - 1) {
    const run = runs[index]
    if (run.end - run.start + 1 >= MIN_RUN) {
      index += 1
      continue
    }
    const before = runs[index - 1]
    const after = runs[index + 1]
    if (before.end - before.start >= after.end - after.start) before.end = run.end
    else after.start = run.start
    runs.splice(index, 1)
  }

  // Re-tile so starts and ends touch exactly, whatever the merges did.
  const bands = []
  let cursor = 0
  for (let i = 0; i < runs.length; i += 1) {
    const end = i === runs.length - 1 ? categories.length - 1 : runs[i].end
    if (end <= cursor && i !== runs.length - 1) continue
    bands.push([cursor, Math.max(cursor + 1, end), runs[i].category])
    cursor = Math.max(cursor + 1, end)
  }
  if (!bands.length) bands.push([0, categories.length - 1, 0])
  else bands[bands.length - 1][1] = categories.length - 1

  return bands
}

/* ------------------------------------------------------------------ speed */

/**
 * HGV travel time. A loaded truck holds about 68 km/h on the flat, loses time
 * climbing and gains only a little descending, and every leg carries a fixed
 * cost for getting in and out of the built-up ends.
 */
function durationSeconds(points, elevations) {
  let seconds = 240
  for (let i = 1; i < points.length; i += 1) {
    const km = haversineKm(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1])
    if (km <= 0) continue
    const grade = ((elevations[i] - elevations[i - 1]) / (km * 1000)) * 100
    const kph = grade > 0
      ? Math.max(22, 68 - grade * 4.6)
      : Math.min(78, 68 - grade * 1.1)
    seconds += (km / kph) * 3600
  }
  return Math.round(seconds)
}

/* ------------------------------------------------------------------ public */

export class NoRouteError extends Error {
  constructor() {
    super('Could not find a routable point within a reasonable distance.')
    this.name = 'NoRouteError'
  }
}

/**
 * Build the ORS GeoJSON `POST /orders/route-profile/` answers with.
 *
 * @param {[number, number][]} coordinates `[lng, lat]` pairs, at least two.
 * @returns {object} a FeatureCollection shaped exactly like ORS's, including
 *   the `properties.ascent` / `properties.descent` that live beside `summary`
 *   rather than inside it, and the `extras.steepness.values` whose absence
 *   would send `RouteLayer` into a fitBounds loop.
 * @throws {NoRouteError} when a pin is in the sea or outside the country.
 */
export function synthesizeRoute(coordinates) {
  const pins = coordinates.map(([lng, lat]) => [Number(lng), Number(lat)])
  if (pins.some(([lng, lat]) => !Number.isFinite(lng) || !Number.isFinite(lat))) {
    throw new NoRouteError()
  }
  if (pins.some(([lng, lat]) => unroutable(lng, lat))) throw new NoRouteError()

  // Budget the points across the legs in proportion to their length, so a
  // 200 km haul is not sampled at the same 45 m as a 3 km hop.
  const legKm = []
  for (let i = 1; i < pins.length; i += 1) {
    legKm.push(haversineKm(pins[i - 1][0], pins[i - 1][1], pins[i][0], pins[i][1]))
  }
  const totalKm = legKm.reduce((sum, km) => sum + km, 0)
  if (totalKm < 0.05) throw new NoRouteError()

  const wanted = Math.min(MAX_POINTS, Math.max(24, Math.round((totalKm * 1000) / SPACING_M)))

  let flat = []
  for (let i = 1; i < pins.length; i += 1) {
    const share = legKm[i - 1] / totalKm
    const steps = Math.max(8, Math.round(wanted * share))
    const segment = leg(pins[i - 1][0], pins[i - 1][1], pins[i][0], pins[i][1], steps)
    // Drop the duplicated join so the polyline has no zero-length step.
    flat = flat.length ? flat.concat(segment.slice(1)) : segment
  }

  const raw = flat.map(([lng, lat]) => elevationAt(lng, lat))
  const elevations = smooth(raw, 9).map((value) => Math.round(value * 10) / 10)

  // Distance, ascent and descent all read off the geometry that ships, so the
  // panel cannot contradict its own chart.
  let distanceM = 0
  let ascent = 0
  let descent = 0
  const gradients = [0]
  for (let i = 1; i < flat.length; i += 1) {
    const km = haversineKm(flat[i - 1][0], flat[i - 1][1], flat[i][0], flat[i][1])
    distanceM += km * 1000
    const delta = elevations[i] - elevations[i - 1]
    if (delta > 0) ascent += delta
    else descent -= delta
    gradients.push(km > 0 ? (delta / (km * 1000)) * 100 : 0)
  }

  // Classify on a smoothed gradient: raw per-point grades over 45 m are noisy
  // enough to paint a flat motorway in four colours.
  const categories = smooth(gradients, 11).map(categorise)

  const coordinates3d = flat.map(([lng, lat], index) => [
    Math.round(lng * 1e6) / 1e6,
    Math.round(lat * 1e6) / 1e6,
    elevations[index],
  ])

  const lngs = flat.map((point) => point[0])
  const lats = flat.map((point) => point[1])

  return {
    type: 'FeatureCollection',
    bbox: [
      Math.min(...lngs), Math.min(...lats), Math.min(...elevations),
      Math.max(...lngs), Math.max(...lats), Math.max(...elevations),
    ],
    metadata: {
      attribution: 'Synthesised by the demo — not OpenRouteService data.',
      service: 'routing',
      query: { profile: 'driving-hgv', format: 'geojson', elevation: true },
    },
    features: [
      {
        type: 'Feature',
        bbox: [
          Math.min(...lngs), Math.min(...lats), Math.min(...elevations),
          Math.max(...lngs), Math.max(...lats), Math.max(...elevations),
        ],
        geometry: { type: 'LineString', coordinates: coordinates3d },
        properties: {
          // Beside `summary`, not inside it — the shape the UI and the pricing
          // engine both read, and the one a hand-written fixture gets wrong.
          ascent: Math.round(ascent),
          descent: Math.round(descent),
          summary: {
            distance: Math.round(distanceM),
            duration: durationSeconds(flat, elevations),
          },
          extras: {
            steepness: {
              values: steepnessBands(categories),
              summary: [],
            },
          },
          segments: [],
          way_points: [0, coordinates3d.length - 1],
        },
      },
    ],
  }
}

/**
 * What the seed needs: the three numbers an order stores in `route_stops`,
 * derived from the same synthesiser the live endpoint uses, so opening a
 * seeded order never trips the admin page's drift check.
 */
export function routeSummaryFor(coordinates) {
  try {
    const properties = synthesizeRoute(coordinates).features[0].properties
    return {
      distance: properties.summary.distance,
      duration: properties.summary.duration,
      ascent: properties.ascent,
    }
  } catch {
    return { distance: null, duration: null, ascent: null }
  }
}
