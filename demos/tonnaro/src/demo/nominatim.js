/**
 * The geocoder.
 *
 * Four components — `LocationAutocomplete`, `LocationSearchOverlay`,
 * `MapPicker` and `FullscreenLocationPicker` — call
 * `nominatim.openstreetmap.org` directly with `fetch()`, not through
 * `api/client.js`. Rather than fork all four (and lose the ability to bring an
 * upstream fix across by copying the file), this installs a `fetch` shim that
 * answers only that host from a gazetteer compiled into the bundle, and passes
 * every other request through untouched.
 *
 * Serving it locally is not merely convenient. Nominatim's usage policy
 * forbids exactly this shape of traffic — an unattended demo hammering the
 * public endpoint on every keystroke — so a demo that called the real service
 * would be both rude and, once rate-limited, broken. Map *tiles* are the one
 * network exception this demo makes; geocoding is not.
 *
 * Search matches the Georgian, English and Russian names of every place, and
 * `accept-language` is honoured on both endpoints the way the real service
 * honours it, because the whole product is trilingual and a demo that only
 * answered in English would hide that.
 */

const HOST = 'nominatim.openstreetmap.org'

/* -------------------------------------------------------------- gazetteer */

const GE = { country: { en: 'Georgia', ka: 'საქართველო', ru: 'Грузия' }, code: 'ge' }

/**
 * `state` is the mkhare (region); `city` is what `formatShortName()` prints
 * after the road. Coordinates are real, so a pin dropped from a search lands
 * where the place actually is and the routing fixtures line up with it.
 */
const PLACES = [
  // ── Tbilisi and its districts ──────────────────────────────────────────
  { lat: 41.7151, lng: 44.8271, kind: 'city', state: { en: 'Tbilisi', ka: 'თბილისი', ru: 'Тбилиси' },
    city: { en: 'Tbilisi', ka: 'თბილისი', ru: 'Тбилиси' } },
  { lat: 41.6977, lng: 44.7997, kind: 'road', city: 'Tbilisi',
    road: { en: 'Rustaveli Avenue', ka: 'რუსთაველის გამზირი', ru: 'Проспект Руставели' } },
  { lat: 41.7075, lng: 44.7936, kind: 'road', city: 'Tbilisi',
    road: { en: 'Agmashenebeli Avenue', ka: 'აღმაშენებლის გამზირი', ru: 'Проспект Агмашенебели' } },
  { lat: 41.7247, lng: 44.7508, kind: 'road', city: 'Tbilisi',
    road: { en: 'Vazha-Pshavela Avenue', ka: 'ვაჟა-ფშაველას გამზირი', ru: 'Проспект Важа-Пшавела' } },
  { lat: 41.7086, lng: 44.7614, kind: 'road', city: 'Tbilisi',
    road: { en: 'Chavchavadze Avenue', ka: 'ჭავჭავაძის გამზირი', ru: 'Проспект Чавчавадзе' } },
  { lat: 41.7264, lng: 44.7517, kind: 'suburb', city: 'Tbilisi',
    name: { en: 'Saburtalo', ka: 'საბურთალო', ru: 'Сабуртало' } },
  { lat: 41.7092, lng: 44.7539, kind: 'suburb', city: 'Tbilisi',
    name: { en: 'Vake', ka: 'ვაკე', ru: 'Ваке' } },
  { lat: 41.7503, lng: 44.7803, kind: 'suburb', city: 'Tbilisi',
    name: { en: 'Didube', ka: 'დიდუბე', ru: 'Дидубе' } },
  { lat: 41.7883, lng: 44.8069, kind: 'suburb', city: 'Tbilisi',
    name: { en: 'Gldani', ka: 'გლდანი', ru: 'Глдани' } },
  { lat: 41.6842, lng: 44.8342, kind: 'suburb', city: 'Tbilisi',
    name: { en: 'Isani', ka: 'ისანი', ru: 'Исани' } },
  { lat: 41.6919, lng: 44.8781, kind: 'suburb', city: 'Tbilisi',
    name: { en: 'Samgori', ka: 'სამგორი', ru: 'Самгори' } },
  { lat: 41.6889, lng: 44.8931, kind: 'suburb', city: 'Tbilisi',
    name: { en: 'Varketili', ka: 'ვარკეთილი', ru: 'Варкетили' } },
  { lat: 41.7728, lng: 44.7444, kind: 'suburb', city: 'Tbilisi',
    name: { en: 'Digomi', ka: 'დიღომი', ru: 'Дигоми' } },
  { lat: 41.6789, lng: 44.8181, kind: 'suburb', city: 'Tbilisi',
    name: { en: 'Ortachala', ka: 'ორთაჭალა', ru: 'Ортачала' } },
  { lat: 41.6981, lng: 44.9506, kind: 'suburb', city: 'Tbilisi',
    name: { en: 'Lilo', ka: 'ლილო', ru: 'Лило' } },
  { lat: 41.6692, lng: 44.9547, kind: 'poi', city: 'Tbilisi',
    name: { en: 'Tbilisi International Airport', ka: 'თბილისის საერთაშორისო აეროპორტი', ru: 'Тбилисский международный аэропорт' } },
  { lat: 41.7203, lng: 44.7936, kind: 'poi', city: 'Tbilisi',
    name: { en: 'Tbilisi Central Railway Station', ka: 'თბილისის ცენტრალური სადგური', ru: 'Тбилисский центральный вокзал' } },

  // ── Other cities ───────────────────────────────────────────────────────
  { lat: 41.6168, lng: 41.6367, kind: 'city', state: { en: 'Adjara', ka: 'აჭარა', ru: 'Аджария' },
    city: { en: 'Batumi', ka: 'ბათუმი', ru: 'Батуми' } },
  { lat: 42.2679, lng: 42.6946, kind: 'city', state: { en: 'Imereti', ka: 'იმერეთი', ru: 'Имеретия' },
    city: { en: 'Kutaisi', ka: 'ქუთაისი', ru: 'Кутаиси' } },
  { lat: 41.5495, lng: 45.0000, kind: 'city', state: { en: 'Kvemo Kartli', ka: 'ქვემო ქართლი', ru: 'Квемо-Картли' },
    city: { en: 'Rustavi', ka: 'რუსთავი', ru: 'Рустави' } },
  { lat: 41.9847, lng: 44.1164, kind: 'city', state: { en: 'Shida Kartli', ka: 'შიდა ქართლი', ru: 'Шида-Картли' },
    city: { en: 'Gori', ka: 'გორი', ru: 'Гори' } },
  { lat: 42.5088, lng: 41.8709, kind: 'city', state: { en: 'Samegrelo', ka: 'სამეგრელო', ru: 'Самегрело' },
    city: { en: 'Zugdidi', ka: 'ზუგდიდი', ru: 'Зугдиди' } },
  { lat: 42.1462, lng: 41.6711, kind: 'city', state: { en: 'Samegrelo', ka: 'სამეგრელო', ru: 'Самегрело' },
    city: { en: 'Poti', ka: 'ფოთი', ru: 'Поти' } },
  { lat: 41.9197, lng: 45.4731, kind: 'city', state: { en: 'Kakheti', ka: 'კახეთი', ru: 'Кахетия' },
    city: { en: 'Telavi', ka: 'თელავი', ru: 'Телави' } },
  { lat: 41.8458, lng: 44.7208, kind: 'city', state: { en: 'Mtskheta-Mtianeti', ka: 'მცხეთა-მთიანეთი', ru: 'Мцхета-Мтианети' },
    city: { en: 'Mtskheta', ka: 'მცხეთა', ru: 'Мцхета' } },
  { lat: 41.8211, lng: 41.7767, kind: 'city', state: { en: 'Adjara', ka: 'აჭარა', ru: 'Аджария' },
    city: { en: 'Kobuleti', ka: 'ქობულეთი', ru: 'Кобулети' } },
  { lat: 41.8392, lng: 43.3806, kind: 'city', state: { en: 'Samtskhe-Javakheti', ka: 'სამცხე-ჯავახეთი', ru: 'Самцхе-Джавахети' },
    city: { en: 'Borjomi', ka: 'ბორჯომი', ru: 'Боржоми' } },
  { lat: 41.6392, lng: 42.9826, kind: 'city', state: { en: 'Samtskhe-Javakheti', ka: 'სამცხე-ჯავახეთი', ru: 'Самцхе-Джавахети' },
    city: { en: 'Akhaltsikhe', ka: 'ახალციხე', ru: 'Ахалцихе' } },
  { lat: 41.4778, lng: 44.8094, kind: 'city', state: { en: 'Kvemo Kartli', ka: 'ქვემო ქართლი', ru: 'Квемо-Картли' },
    city: { en: 'Marneuli', ka: 'მარნეული', ru: 'Марнеули' } },
  { lat: 41.4592, lng: 45.0958, kind: 'city', state: { en: 'Kvemo Kartli', ka: 'ქვემო ქართლი', ru: 'Квемо-Картли' },
    city: { en: 'Gardabani', ka: 'გარდაბანი', ru: 'Гардабани' } },
  { lat: 42.1108, lng: 43.0522, kind: 'city', state: { en: 'Imereti', ka: 'იმერეთი', ru: 'Имеретия' },
    city: { en: 'Zestaponi', ka: 'ზესტაფონი', ru: 'Зестафони' } },
  { lat: 42.1553, lng: 42.3369, kind: 'city', state: { en: 'Imereti', ka: 'იმერეთი', ru: 'Имеретия' },
    city: { en: 'Samtredia', ka: 'სამტრედია', ru: 'Самтредиа' } },
  { lat: 41.9931, lng: 43.5992, kind: 'city', state: { en: 'Shida Kartli', ka: 'შიდა ქართლი', ru: 'Шида-Картли' },
    city: { en: 'Khashuri', ka: 'ხაშური', ru: 'Хашури' } },
  { lat: 42.2708, lng: 42.0653, kind: 'city', state: { en: 'Samegrelo', ka: 'სამეგრელო', ru: 'Самегрело' },
    city: { en: 'Senaki', ka: 'სენაკი', ru: 'Сенаки' } },
  { lat: 41.9247, lng: 42.0075, kind: 'city', state: { en: 'Guria', ka: 'გურია', ru: 'Гурия' },
    city: { en: 'Ozurgeti', ka: 'ოზურგეთი', ru: 'Озургети' } },
  { lat: 42.5208, lng: 43.1547, kind: 'city', state: { en: 'Racha-Lechkhumi', ka: 'რაჭა-ლეჩხუმი', ru: 'Рача-Лечхуми' },
    city: { en: 'Ambrolauri', ka: 'ამბროლაური', ru: 'Амбролаури' } },
  { lat: 41.6194, lng: 45.9219, kind: 'city', state: { en: 'Kakheti', ka: 'კახეთი', ru: 'Кахетия' },
    city: { en: 'Sighnaghi', ka: 'სიღნაღი', ru: 'Сигнахи' } },
  { lat: 41.8264, lng: 46.2764, kind: 'city', state: { en: 'Kakheti', ka: 'კახეთი', ru: 'Кахетия' },
    city: { en: 'Lagodekhi', ka: 'ლაგოდეხი', ru: 'Лагодехи' } },
  { lat: 41.4478, lng: 44.5375, kind: 'city', state: { en: 'Kvemo Kartli', ka: 'ქვემო ქართლი', ru: 'Квемо-Картли' },
    city: { en: 'Bolnisi', ka: 'ბოლნისი', ru: 'Болниси' } },

  // ── Freight infrastructure: the places this product actually serves ────
  { lat: 42.1500, lng: 41.6500, kind: 'poi', city: 'Poti', state: 'Samegrelo',
    name: { en: 'Poti Sea Port', ka: 'ფოთის საზღვაო პორტი', ru: 'Морской порт Поти' } },
  { lat: 41.6533, lng: 41.6392, kind: 'poi', city: 'Batumi', state: 'Adjara',
    name: { en: 'Batumi Sea Port', ka: 'ბათუმის საზღვაო პორტი', ru: 'Морской порт Батуми' } },
  { lat: 42.3936, lng: 41.5586, kind: 'poi', city: 'Anaklia', state: 'Samegrelo',
    name: { en: 'Anaklia Deep Sea Port', ka: 'ანაკლიის ღრმაწყლოვანი პორტი', ru: 'Глубоководный порт Анаклия' } },
  { lat: 42.2725, lng: 41.6289, kind: 'poi', city: 'Kulevi', state: 'Samegrelo',
    name: { en: 'Kulevi Oil Terminal', ka: 'ყულევის ნავთობტერმინალი', ru: 'Нефтетерминал Кулеви' } },
  { lat: 42.1767, lng: 42.4826, kind: 'poi', city: 'Kutaisi', state: 'Imereti',
    name: { en: 'Kutaisi International Airport', ka: 'ქუთაისის საერთაშორისო აეროპორტი', ru: 'Кутаисский международный аэропорт' } },
  { lat: 41.5583, lng: 45.0139, kind: 'poi', city: 'Rustavi', state: 'Kvemo Kartli',
    name: { en: 'Rustavi Metallurgical Plant', ka: 'რუსთავის მეტალურგიული ქარხანა', ru: 'Руставский металлургический завод' } },
  { lat: 41.4644, lng: 45.0997, kind: 'poi', city: 'Gardabani', state: 'Kvemo Kartli',
    name: { en: 'Gardabani Power Plant', ka: 'გარდაბნის ელექტროსადგური', ru: 'Гардабанская электростанция' } },
  { lat: 41.9020, lng: 44.6500, kind: 'poi', city: 'Mtskheta', state: 'Mtskheta-Mtianeti',
    name: { en: 'Natakhtari Industrial Zone', ka: 'ნატახტარის ინდუსტრიული ზონა', ru: 'Промзона Натахтари' } },
  { lat: 42.4406, lng: 44.4497, kind: 'poi', city: 'Stepantsminda', state: 'Mtskheta-Mtianeti',
    name: { en: 'Kazbegi Border Crossing', ka: 'ყაზბეგის საზღვრის გადაკვეთა', ru: 'Пограничный переход Казбеги' } },
  { lat: 41.4106, lng: 45.1119, kind: 'poi', city: 'Gardabani', state: 'Kvemo Kartli',
    name: { en: 'Red Bridge Border Crossing', ka: 'წითელი ხიდის საზღვრის გადაკვეთა', ru: 'Пограничный переход Красный мост' } },
]

/* --------------------------------------------------------------- helpers */

const LANGS = ['en', 'ka', 'ru']

function pick(value, lang) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  return value[lang] || value.en || value.ka || value.ru || ''
}

/** Every string a place can be typed as, in any of the three languages. */
function haystack(place) {
  const fields = [place.name, place.city, place.road, place.state]
  const out = []
  for (const field of fields) {
    if (!field) continue
    if (typeof field === 'string') out.push(field)
    else for (const lang of LANGS) if (field[lang]) out.push(field[lang])
  }
  return out.map((text) => text.toLowerCase())
}

function language(params) {
  const raw = (params.get('accept-language') || '').slice(0, 2).toLowerCase()
  return LANGS.includes(raw) ? raw : 'en'
}

/**
 * The `address` object Nominatim returns and `formatShortName()` reads:
 * `road`, `house_number`, `city`/`town`/`village`, `state`, `country`,
 * `country_code`.
 */
function address(place, lang, houseNumber) {
  const city = pick(place.city, lang) || pick(place.state, lang)
  const out = {
    country: pick(GE.country, lang),
    country_code: GE.code,
  }
  if (place.road) {
    out.road = pick(place.road, lang)
    if (houseNumber) out.house_number = String(houseNumber)
  }
  if (place.kind === 'suburb' || place.kind === 'poi') {
    // Nominatim files these under their own keys; `formatShortName` does not
    // read them, but the display name is built from the whole object and
    // dropping them would flatten a district into its city.
    out[place.kind === 'suburb' ? 'suburb' : 'amenity'] = pick(place.name, lang)
  }
  if (city) out.city = city
  const state = pick(place.state, lang)
  if (state && state !== city) out.state = state
  return out
}

function displayName(place, lang, houseNumber) {
  const parts = []
  const label = pick(place.name, lang)
  if (label) parts.push(label)
  if (place.road) parts.push(houseNumber ? `${houseNumber} ${pick(place.road, lang)}` : pick(place.road, lang))
  const city = pick(place.city, lang)
  if (city && city !== label) parts.push(city)
  const state = pick(place.state, lang)
  if (state && state !== city) parts.push(state)
  parts.push(pick(GE.country, lang))
  return parts.filter(Boolean).join(', ')
}

/** Stable synthetic ids, so a result keyed by `place_id` does not churn. */
function placeId(index) {
  return 100000 + index * 7
}

function serialize(place, index, lang, houseNumber) {
  const delta = place.kind === 'city' ? 0.08 : 0.01
  return {
    place_id: placeId(index),
    licence: 'Demo gazetteer — bundled with this portfolio demo, not OpenStreetMap data.',
    osm_type: 'node',
    osm_id: placeId(index),
    boundingbox: [
      String(place.lat - delta), String(place.lat + delta),
      String(place.lng - delta), String(place.lng + delta),
    ],
    lat: String(place.lat),
    lon: String(place.lng),
    display_name: displayName(place, lang, houseNumber),
    class: place.kind === 'road' ? 'highway' : 'place',
    type: place.kind,
    importance: place.kind === 'city' ? 0.7 : 0.4,
    address: address(place, lang, houseNumber),
  }
}

/* ---------------------------------------------------------------- search */

function search(params) {
  const lang = language(params)
  const query = (params.get('q') || '').trim().toLowerCase()
  const limit = Number(params.get('limit')) || 10

  // `countrycodes=ge` is the only value this app ever sends; anything else
  // legitimately matches nothing, because the gazetteer is Georgia-only.
  const countries = (params.get('countrycodes') || '').toLowerCase()
  if (countries && !countries.split(',').includes(GE.code)) return []

  if (query.length < 2) return []

  // A house number typed alongside a street ("Rustaveli 12") should survive
  // into the result the way the real geocoder resolves it.
  const houseNumber = (query.match(/\b(\d{1,4})\b/) || [])[1] || null
  const words = query.replace(/\b\d{1,4}\b/g, ' ').trim().split(/\s+/).filter(Boolean)
  if (!words.length) return []

  const scored = []
  PLACES.forEach((place, index) => {
    const fields = haystack(place)
    // Every word must land somewhere, as Nominatim's token search does.
    if (!words.every((word) => fields.some((text) => text.includes(word)))) return
    // Prefer a name that starts with the query over one that merely contains
    // it, then prefer cities over streets — roughly Nominatim's importance.
    const starts = fields.some((text) => text.startsWith(words[0])) ? 0 : 1
    const rank = place.kind === 'city' ? 0 : place.kind === 'poi' ? 1 : 2
    scored.push({ place, index, sort: [starts, rank, fields[0].length] })
  })

  scored.sort((a, b) => {
    for (let i = 0; i < a.sort.length; i += 1) {
      if (a.sort[i] !== b.sort[i]) return a.sort[i] - b.sort[i]
    }
    return 0
  })

  return scored
    .slice(0, limit)
    .map(({ place, index }) => serialize(place, index, lang, place.road ? houseNumber : null))
}

/* --------------------------------------------------------------- reverse */

/** Equirectangular approximation — exact enough to rank places 300 km apart. */
function distance(aLat, aLng, bLat, bLng) {
  const x = (bLng - aLng) * Math.cos(((aLat + bLat) / 2) * (Math.PI / 180))
  const y = bLat - aLat
  return Math.sqrt(x * x + y * y) * 111.32
}

function reverse(params) {
  const lang = language(params)
  const lat = Number(params.get('lat'))
  const lng = Number(params.get('lon'))
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { error: 'Unable to geocode' }
  }

  let nearest = null
  let best = Infinity
  let bestIndex = 0
  PLACES.forEach((place, index) => {
    const km = distance(lat, lng, place.lat, place.lng)
    if (km < best) {
      best = km
      nearest = place
      bestIndex = index
    }
  })

  // Far outside anywhere the gazetteer knows, the real service still answers
  // with the country. Saying so beats inventing a street.
  if (!nearest || best > 60) {
    return {
      place_id: 1,
      licence: 'Demo gazetteer — bundled with this portfolio demo, not OpenStreetMap data.',
      lat: String(lat),
      lon: String(lng),
      display_name: pick(GE.country, lang),
      address: { country: pick(GE.country, lang), country_code: GE.code },
      boundingbox: [String(lat - 0.01), String(lat + 0.01), String(lng - 0.01), String(lng + 0.01)],
    }
  }

  // Derive a stable house number from the dropped pin, so two taps a street
  // apart do not read as the same address.
  const houseNumber = nearest.road ? (Math.abs(Math.round(lat * 1e4 + lng * 1e4)) % 120) + 1 : null
  const result = serialize(nearest, bestIndex, lang, houseNumber)
  // Reverse answers about the point that was asked for, not the gazetteer row.
  result.lat = String(lat)
  result.lon = String(lng)
  return result
}

/* ------------------------------------------------------------- the shim */

const READ_LATENCY = [120, 320]

function delay() {
  const [min, max] = READ_LATENCY
  return new Promise((done) => {
    window.setTimeout(done, min + Math.random() * (max - min))
  })
}

function json(body) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

let installed = false

/**
 * Patch `window.fetch` for this one host. Everything else — the OSM tile
 * requests Leaflet makes, above all — goes straight through to the real
 * `fetch`, so the map still loads real tiles.
 */
export function installGeocoder() {
  if (installed || typeof window === 'undefined') return
  installed = true

  const original = window.fetch.bind(window)

  window.fetch = async (input, init) => {
    const href = typeof input === 'string' ? input
      : input instanceof URL ? input.href
      : input?.url ?? ''

    if (!href.includes(HOST)) return original(input, init)

    const url = new URL(href, window.location.href)
    await delay()

    if (url.pathname.startsWith('/reverse')) return json(reverse(url.searchParams))
    if (url.pathname.startsWith('/search')) return json(search(url.searchParams))
    return json([])
  }
}

/** Exposed for the seed: every place the demo can legitimately route between. */
export { PLACES }
