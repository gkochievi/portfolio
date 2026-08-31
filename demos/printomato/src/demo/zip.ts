/**
 * A ZIP writer, because there is no server left to build the archive.
 *
 * A port of `core/admin_api/services.py::build_photos_zip`, down to the entry
 * names and the `<prefix>_<stamp>_<n>photos.zip` filename, so the download the
 * console offers is byte-for-byte the file the operator is used to.
 *
 * Two deliberate departures from the Python:
 *
 * - **STORE, not DEFLATE.** Every entry is an already-compressed JPEG, so
 *   deflating them buys a percent or two and costs an inflate implementation.
 * - **`fetch` is used to read the photos.** The demo makes no network calls,
 *   and this is the one exception: these are the bundle's own JPEGs, requested
 *   from the origin that served the page, because reading the bytes back out
 *   of an `<img>` is the only alternative and it re-encodes them. Nothing
 *   leaves the origin, and nothing here runs unless someone clicks Download.
 */

import { bootstrap } from '@/lib/bootstrap'

/** One photo to archive; `url` is null for a row that has no file. */
export interface PhotoSource {
  url: string | null
  /** Original filename — its stem and extension name the entry. */
  file: string
  timestamp: string
}

export interface PhotoArchive {
  blob: Blob
  filename: string
  /** Entries actually written, i.e. the Django response's `X-Photo-Count`. */
  count: number
}

/** `Blob` accepts a view onto a plain `ArrayBuffer` only, never a shared one. */
type Bytes = Uint8Array<ArrayBuffer>

const LOCAL_SIGNATURE = 0x04034b50
const CENTRAL_SIGNATURE = 0x02014b50
const END_SIGNATURE = 0x06054b50
const VERSION = 20 // 2.0: the floor for a STORE entry
const UTF8_NAMES = 0x0800 // general-purpose bit 11
const STORE = 0

let table: Uint32Array | undefined

/** 1 KB of lookup table, built on the first download and never on a page that
 *  has none. */
function crc32(bytes: Bytes): number {
  if (!table) {
    table = new Uint32Array(256)
    for (let index = 0; index < 256; index += 1) {
      let value = index
      for (let bit = 0; bit < 8; bit += 1) {
        value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
      }
      table[index] = value >>> 0
    }
  }

  let crc = 0xffffffff
  for (let index = 0; index < bytes.length; index += 1) {
    crc = table[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

/** Header fields are little-endian throughout; headers are tens of bytes, so a
 *  plain number array is cheaper than sizing an ArrayBuffer per record. */
class Fields {
  private readonly bytes: number[] = []

  u16(value: number): this {
    this.bytes.push(value & 0xff, (value >>> 8) & 0xff)
    return this
  }

  u32(value: number): this {
    this.bytes.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff)
    return this
  }

  raw(chunk: Bytes): this {
    for (const byte of chunk) this.bytes.push(byte)
    return this
  }

  done(): Bytes {
    return Uint8Array.from(this.bytes)
  }
}

/** Wall-clock parts in the console's zone — the upstream stamps in the
 *  server's TZ, so a visitor elsewhere must not get their own local time in
 *  entry names the displayed timestamps (lib/format.ts, pinned to
 *  `bootstrap.timeZone`) would then disagree with. */
const ZONE_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: bootstrap.timeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

function wallClock(value: string | number) {
  const parts = ZONE_PARTS.formatToParts(new Date(value))
  const part = (type: string) => Number(parts.find((entry) => entry.type === type)?.value ?? 0)
  // `hour12: false` renders midnight as 24 on some engines; fold it back to 0.
  return {
    year: part('year'),
    month: part('month'),
    day: part('day'),
    hour: part('hour') % 24,
    minute: part('minute'),
    second: part('second'),
  }
}

/** `%Y%m%d_%H%M%S` in the console's zone, like `strftime` on an aware datetime. */
function stamp(value: string | number): string {
  const at = wallClock(value)
  const pad = (part: number) => String(part).padStart(2, '0')
  return (
    `${at.year}${pad(at.month)}${pad(at.day)}` +
    `_${pad(at.hour)}${pad(at.minute)}${pad(at.second)}`
  )
}

/** MS-DOS packed time and date: two-second resolution, epoch 1980. */
function dosStamp(value: string): [time: number, date: number] {
  const at = wallClock(value)
  const year = Math.max(at.year, 1980)
  return [
    (at.hour << 11) | (at.minute << 5) | (at.second >> 1),
    ((year - 1980) << 9) | (at.month << 5) | at.day,
  ]
}

function entryName(file: string, timestamp: string, index: number): string {
  const dot = file.lastIndexOf('.')
  const stem = dot > 0 ? file.slice(0, dot) : file
  const extension = dot > 0 ? file.slice(dot) : ''
  return `${stem}_${stamp(timestamp)}_${index}${extension}`
}

async function load(url: string): Promise<Bytes | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    return new Uint8Array(await response.arrayBuffer())
  } catch {
    return null
  }
}

export async function buildPhotosZip(
  photos: PhotoSource[],
  prefix = 'photos',
): Promise<PhotoArchive> {
  const encoder = new TextEncoder()
  const chunks: Bytes[] = []
  const directory: Bytes[] = []
  let offset = 0

  for (const [position, photo] of photos.entries()) {
    const body = photo.url ? await load(photo.url) : null
    // A file that will not load is skipped, never fatal — the same tolerance
    // the Python has, so one missing asset cannot lose the whole download.
    if (!body) continue

    // The index counts the queryset, not the successes: a skipped photo still
    // consumes its number, exactly as `enumerate()` does.
    const name = encoder.encode(entryName(photo.file, photo.timestamp, position + 1))
    const [time, date] = dosStamp(photo.timestamp)
    const crc = crc32(body)

    const local = new Fields()
      .u32(LOCAL_SIGNATURE).u16(VERSION).u16(UTF8_NAMES).u16(STORE).u16(time).u16(date)
      .u32(crc).u32(body.length).u32(body.length).u16(name.length).u16(0)
      .raw(name)
      .done()

    directory.push(
      new Fields()
        .u32(CENTRAL_SIGNATURE).u16(VERSION).u16(VERSION).u16(UTF8_NAMES).u16(STORE).u16(time).u16(date)
        .u32(crc).u32(body.length).u32(body.length)
        // name / extra / comment lengths, disk number, then the attributes.
        .u16(name.length).u16(0).u16(0).u16(0).u16(0).u32(0)
        .u32(offset)
        .raw(name)
        .done(),
    )

    chunks.push(local, body)
    offset += local.length + body.length
  }

  const count = directory.length
  const directorySize = directory.reduce((total, entry) => total + entry.length, 0)
  chunks.push(
    ...directory,
    new Fields()
      .u32(END_SIGNATURE).u16(0).u16(0).u16(count).u16(count)
      .u32(directorySize).u32(offset).u16(0)
      .done(),
  )

  return {
    blob: new Blob(chunks, { type: 'application/zip' }),
    filename: `${prefix}_${stamp(Date.now())}_${count}photos.zip`,
    count,
  }
}
