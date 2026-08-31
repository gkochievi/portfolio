/**
 * Where the visitor is.
 *
 * Six places call `navigator.geolocation.getCurrentPosition` — the two map
 * pickers on mount and on their locate-me buttons, the autocomplete's
 * current-location chip, and the mobile search overlay — with timeouts from
 * 4 to 8 seconds. Left alone in a demo, each one fires a browser permission
 * prompt over the map, and then either stalls for the full timeout or fails
 * outright, because the permission is denied by default inside an iframe and
 * on any page the visitor has not granted it to.
 *
 * So the demo answers instead: a fixed fix in central Tbilisi, delivered fast
 * enough to feel instant but not so fast that the components' `locating`
 * spinners never render — they are part of the product and worth seeing.
 *
 * This is the second and last monkeypatch in the demo (the first is the
 * geocoder in `./nominatim.js`), and it exists for the same reason: patching
 * the boundary keeps `MapPicker`, `FullscreenLocationPicker`,
 * `LocationAutocomplete` and `LocationSearchOverlay` byte-identical to the
 * files that shipped, so an upstream fix can still be brought across by
 * copying one of them.
 */

/** Rustaveli Avenue, Tbilisi — inside the gazetteer, so reverse geocoding it
 *  returns a real street rather than the country fallback. */
const FIX = {
  latitude: 41.6977,
  longitude: 44.7997,
  accuracy: 18,
  altitude: 441,
  altitudeAccuracy: 12,
  heading: null,
  speed: null,
}

/** Long enough that the spinner is visible, short of every call site's timeout
 *  (the tightest is FullscreenLocationPicker's 4 s recentre). */
const FIX_DELAY_MS = 520

let installed = false

export function installGeolocation() {
  if (installed || typeof navigator === 'undefined') return
  installed = true

  const position = () => ({
    coords: { ...FIX },
    // `Date.now()` rather than a frozen stamp: nothing reads it, but a
    // position that claims to be from 2026 would be a lie a debugger could
    // trip over.
    timestamp: Date.now(),
  })

  const geolocation = {
    getCurrentPosition(onSuccess) {
      window.setTimeout(() => onSuccess(position()), FIX_DELAY_MS)
    },

    /**
     * Nothing in the app watches, but a stub that silently did nothing would
     * be worse than one that behaves: emit the fix once and hand back a
     * cancellable id.
     */
    watchPosition(onSuccess) {
      const id = window.setTimeout(() => onSuccess(position()), FIX_DELAY_MS)
      return id
    },

    clearWatch(id) {
      window.clearTimeout(id)
    },
  }

  try {
    // `navigator.geolocation` is a read-only accessor on the prototype, so it
    // has to be shadowed with an own property rather than assigned.
    Object.defineProperty(navigator, 'geolocation', {
      value: geolocation,
      configurable: true,
      writable: false,
    })
  } catch {
    // A browser that refuses the redefinition falls back to the real thing:
    // the permission prompt appears, which is worse but not broken.
  }
}
