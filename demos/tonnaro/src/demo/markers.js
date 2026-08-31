/**
 * Map marker images, served from the bundle.
 *
 * Upstream, `MapPicker` and `FullscreenLocationPicker` point Leaflet at
 * `cdnjs.cloudflare.com` for the default pin and at
 * `raw.githubusercontent.com` for the green and red variants. The second of
 * those is not a CDN — GitHub serves it with `X-Content-Type-Options: nosniff`
 * and a short-lived cache, rate-limits it, and most Content-Security-Policies
 * block it outright — so a demo relying on it shows pins that intermittently
 * do not load.
 *
 * The default pin comes from Leaflet's own package, which already ships it;
 * Vite fingerprints and rewrites those three imports against the build's base
 * path. The coloured pair are drawn here as inline SVG data URIs rather than
 * vendored PNGs: same silhouette as the classic Leaflet pin, sharp at any
 * pixel density, and no extra network request at all.
 *
 * Map *tiles* remain the demo's one deliberate network dependency. Pins are
 * chrome, and chrome should not be able to fail.
 */
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'

/** The classic Leaflet teardrop, 25×41, in an arbitrary colour. */
function pin(fill, stroke) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41">
<path d="M12.5 0.75C6.14 0.75 0.98 5.91 0.98 12.27c0 2.4 0.75 4.63 2.02 6.47L12.5 40.1l9.5-21.36a11.45 11.45 0 0 0 2.02-6.47C24.02 5.91 18.86 0.75 12.5 0.75z" fill="${fill}" stroke="${stroke}" stroke-width="1.2"/>
<circle cx="12.5" cy="12.3" r="4.4" fill="#ffffff" fill-opacity="0.92"/>
</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg.replace(/\n/g, ''))}`
}

export const DEFAULT_ICON = { iconRetinaUrl, iconUrl, shadowUrl }

/** Pickup. */
export const GREEN_ICON_URL = pin('#16a34a', '#0f7a37')

/** Destination. */
export const RED_ICON_URL = pin('#dc2626', '#a01a1a')

export const SHADOW_URL = shadowUrl
