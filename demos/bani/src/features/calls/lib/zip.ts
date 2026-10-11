/**
 * Minimal ZIP writer: "store" method only (no compression), CRC-32 per entry,
 * UTF-8 file names. Enough for recordings (already compressed audio) and for
 * the OOXML container of the .xlsx export. Pure, no dependencies.
 */

const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

/** CRC-32 (IEEE 802.3), as used by ZIP. */
export function crc32(data: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]!) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

export interface ZipEntry {
  name: string
  data: Uint8Array
  /** Modification time stored in the entry; defaults to now. */
  modified?: Date
}

const encoder = new TextEncoder()

function dosDateTime(d: Date): { time: number; date: number } {
  const year = Math.max(1980, d.getFullYear())
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  }
}

/** Build a ZIP archive (store method) from in-memory entries. */
export function createZip(entries: ZipEntry[]): Uint8Array {
  const prepared = entries.map((e) => {
    const name = encoder.encode(e.name.replace(/\\/g, '/').replace(/^\/+/, ''))
    return { name, data: e.data, crc: crc32(e.data), stamp: dosDateTime(e.modified ?? new Date()) }
  })

  let size = 22
  for (const p of prepared) size += 30 + p.name.length + p.data.length + 46 + p.name.length

  const out = new Uint8Array(size)
  const view = new DataView(out.buffer)
  let pos = 0
  const offsets: number[] = []

  for (const p of prepared) {
    offsets.push(pos)
    view.setUint32(pos, 0x04034b50, true)
    view.setUint16(pos + 4, 20, true) // version needed
    view.setUint16(pos + 6, 0x0800, true) // flags: UTF-8 names
    view.setUint16(pos + 8, 0, true) // method: store
    view.setUint16(pos + 10, p.stamp.time, true)
    view.setUint16(pos + 12, p.stamp.date, true)
    view.setUint32(pos + 14, p.crc, true)
    view.setUint32(pos + 18, p.data.length, true)
    view.setUint32(pos + 22, p.data.length, true)
    view.setUint16(pos + 26, p.name.length, true)
    view.setUint16(pos + 28, 0, true)
    out.set(p.name, pos + 30)
    out.set(p.data, pos + 30 + p.name.length)
    pos += 30 + p.name.length + p.data.length
  }

  const centralStart = pos
  prepared.forEach((p, i) => {
    view.setUint32(pos, 0x02014b50, true)
    view.setUint16(pos + 4, 20, true) // version made by
    view.setUint16(pos + 6, 20, true) // version needed
    view.setUint16(pos + 8, 0x0800, true)
    view.setUint16(pos + 10, 0, true)
    view.setUint16(pos + 12, p.stamp.time, true)
    view.setUint16(pos + 14, p.stamp.date, true)
    view.setUint32(pos + 16, p.crc, true)
    view.setUint32(pos + 20, p.data.length, true)
    view.setUint32(pos + 24, p.data.length, true)
    view.setUint16(pos + 28, p.name.length, true)
    view.setUint16(pos + 30, 0, true) // extra
    view.setUint16(pos + 32, 0, true) // comment
    view.setUint16(pos + 34, 0, true) // disk
    view.setUint16(pos + 36, 0, true) // internal attrs
    view.setUint32(pos + 38, 0, true) // external attrs
    view.setUint32(pos + 42, offsets[i]!, true)
    out.set(p.name, pos + 46)
    pos += 46 + p.name.length
  })

  view.setUint32(pos, 0x06054b50, true)
  view.setUint16(pos + 4, 0, true)
  view.setUint16(pos + 6, 0, true)
  view.setUint16(pos + 8, prepared.length, true)
  view.setUint16(pos + 10, prepared.length, true)
  view.setUint32(pos + 12, pos - centralStart, true)
  view.setUint32(pos + 16, centralStart, true)
  view.setUint16(pos + 20, 0, true)
  return out
}
