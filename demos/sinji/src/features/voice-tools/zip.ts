/**
 * A store-only ZIP writer (no compression, no dependency). Each entry carries a
 * CRC-32 computed over the file's bytes; names are written as UTF-8.
 */

const TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

export function crc32(bytes: Uint8Array, seed = 0): number {
  let crc = ~seed >>> 0
  for (let i = 0; i < bytes.length; i += 1) crc = (TABLE[(crc ^ (bytes[i] as number)) & 0xff] as number) ^ (crc >>> 8)
  return ~crc >>> 0
}

export interface ZipEntry {
  name: string
  data: Uint8Array
}

function dosDateTime(date: Date): { time: number; day: number } {
  const year = Math.max(1980, date.getFullYear())
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    day: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  }
}

/** Build a ZIP archive (method 0 = stored) and return it as a Blob. */
export function buildZip(entries: ZipEntry[], when: Date = new Date()): Blob {
  const encoder = new TextEncoder()
  const { time, day } = dosDateTime(when)
  const parts: BlobPart[] = []
  const central: Uint8Array[] = []
  let offset = 0

  for (const entry of entries) {
    const name = encoder.encode(entry.name)
    const crc = crc32(entry.data)
    const size = entry.data.length

    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(4, 20, true) // version needed
    local.setUint16(6, 0x0800, true) // UTF-8 names
    local.setUint16(8, 0, true) // stored
    local.setUint16(10, time, true)
    local.setUint16(12, day, true)
    local.setUint32(14, crc, true)
    local.setUint32(18, size, true)
    local.setUint32(22, size, true)
    local.setUint16(26, name.length, true)
    local.setUint16(28, 0, true)
    parts.push(local.buffer, name, entry.data as BlobPart)

    const head = new DataView(new ArrayBuffer(46))
    head.setUint32(0, 0x02014b50, true)
    head.setUint16(4, 20, true)
    head.setUint16(6, 20, true)
    head.setUint16(8, 0x0800, true)
    head.setUint16(10, 0, true)
    head.setUint16(12, time, true)
    head.setUint16(14, day, true)
    head.setUint32(16, crc, true)
    head.setUint32(20, size, true)
    head.setUint32(24, size, true)
    head.setUint16(28, name.length, true)
    head.setUint32(42, offset, true)
    const record = new Uint8Array(46 + name.length)
    record.set(new Uint8Array(head.buffer), 0)
    record.set(name, 46)
    central.push(record)

    offset += 30 + name.length + size
  }

  const centralSize = central.reduce((sum, r) => sum + r.length, 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(8, entries.length, true)
  end.setUint16(10, entries.length, true)
  end.setUint32(12, centralSize, true)
  end.setUint32(16, offset, true)
  parts.push(...(central as BlobPart[]), end.buffer)
  return new Blob(parts, { type: 'application/zip' })
}

/** `call.mp3` + `wav` -> `call.wav`; duplicates become `call (2).wav`. */
export function renamedEntries(names: string[], ext: string): string[] {
  const seen = new Map<string, number>()
  return names.map((name) => {
    const stem = name.replace(/\.[^./\\]+$/, '').replace(/[\\/:*?"<>|]+/g, '_') || 'audio'
    const key = `${stem}.${ext}`.toLowerCase()
    const count = (seen.get(key) ?? 0) + 1
    seen.set(key, count)
    return count === 1 ? `${stem}.${ext}` : `${stem} (${count}).${ext}`
  })
}
