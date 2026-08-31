/**
 * A ZIP writer, because there is no server left to build the archive.
 *
 * The only caller is `xlsx.ts`: an `.xlsx` is a ZIP of XML parts, so the three
 * export endpoints need a container before they need a spreadsheet. Ruling 12
 * says those downloads are real workbooks rather than a CSV wearing an `.xlsx`
 * name, and this is the layer that makes the file openable.
 *
 * The shape is Printomato's `demo/zip.ts`, which hand-writes the same headers
 * for its photo download. Three differences, all because the payload differs:
 *
 * - **Synchronous.** Printomato `fetch`es JPEGs out of the bundle; every byte
 *   here is a string this process just generated, so there is nothing to await.
 * - **A string is an entry.** Callers hand over XML, not binary, so `data`
 *   accepts a string and UTF-8 encodes it.
 * - **No entry may be dropped.** Printomato skips a photo that will not load,
 *   because a missing asset should not lose the whole download. An `.xlsx`
 *   missing one part is not a lenient `.xlsx`, it is a corrupt one.
 *
 * STORED, not DEFLATE, exactly as Printomato does. A workbook's XML deflates
 * well and the saving is real, but it would cost a compressor, and no reader in
 * the world refuses a stored entry — the format's own spec makes method 0
 * mandatory and DEFLATE optional.
 */

import { CLOCK, TZ_OFFSET_MS } from './base';

/** One member of the archive. `name` is the full path inside it, `/`-separated. */
export interface ZipEntry {
  name: string;
  /** Raw bytes, or text that is UTF-8 encoded on the way in. */
  data: Uint8Array<ArrayBuffer> | string;
}

/** `Blob` accepts a view onto a plain `ArrayBuffer` only, never a shared one. */
type Bytes = Uint8Array<ArrayBuffer>;

const LOCAL_SIGNATURE = 0x04034b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const END_SIGNATURE = 0x06054b50;
const VERSION = 20; // 2.0: the floor for a STORE entry
const UTF8_NAMES = 0x0800; // general-purpose bit 11
const STORE = 0;

const encoder = new TextEncoder();

let table: Uint32Array | undefined;

/** 1 KB of lookup table, built on the first export and never on a session that
 *  runs none. */
export function crc32(bytes: Bytes): number {
  if (!table) {
    table = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1) {
        value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
      }
      table[index] = value >>> 0;
    }
  }

  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc = table[(crc ^ bytes[index]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Header fields are little-endian throughout; headers are tens of bytes, so a
 *  plain number array is cheaper than sizing an ArrayBuffer per record. */
class Fields {
  private readonly bytes: number[] = [];

  u16(value: number): this {
    this.bytes.push(value & 0xff, (value >>> 8) & 0xff);
    return this;
  }

  u32(value: number): this {
    this.bytes.push(
      value & 0xff,
      (value >>> 8) & 0xff,
      (value >>> 16) & 0xff,
      (value >>> 24) & 0xff,
    );
    return this;
  }

  raw(chunk: Bytes): this {
    for (const byte of chunk) this.bytes.push(byte);
    return this;
  }

  done(): Bytes {
    return Uint8Array.from(this.bytes);
  }
}

/**
 * MS-DOS packed time and date: two-second resolution, epoch 1980, and — this is
 * the part that bites — **local wall-clock time with no zone recorded**. The
 * demo's local is Tbilisi (ruling 13), so the instant is shifted before its
 * fields are read, and read as UTC so the host machine's own zone cannot leak
 * into the archive.
 */
function dosStamp(at: number): [time: number, date: number] {
  const wall = new Date(at + TZ_OFFSET_MS);
  const year = Math.max(wall.getUTCFullYear(), 1980);
  return [
    (wall.getUTCHours() << 11) | (wall.getUTCMinutes() << 5) | (wall.getUTCSeconds() >> 1),
    ((year - 1980) << 9) | ((wall.getUTCMonth() + 1) << 5) | wall.getUTCDate(),
  ];
}

/**
 * Pack `entries` into a valid archive, in the order given.
 *
 * `at` is the modification time stamped onto every entry; it defaults to the
 * mock's clock so a caller never reaches for `Date.now()` itself. One instant
 * for the whole archive rather than one per entry, because a workbook's parts
 * are written in the same breath and a spread of timestamps would only be
 * noise.
 */
export function zip(entries: readonly ZipEntry[], at: number = CLOCK.now()): Blob {
  const chunks: Bytes[] = [];
  const directory: Bytes[] = [];
  const [time, date] = dosStamp(at);
  let offset = 0;

  for (const entry of entries) {
    const body: Bytes =
      typeof entry.data === 'string' ? encoder.encode(entry.data) : entry.data;
    const name = encoder.encode(entry.name);
    const crc = crc32(body);

    const local = new Fields()
      .u32(LOCAL_SIGNATURE).u16(VERSION).u16(UTF8_NAMES).u16(STORE).u16(time).u16(date)
      .u32(crc).u32(body.length).u32(body.length).u16(name.length).u16(0)
      .raw(name)
      .done();

    directory.push(
      new Fields()
        .u32(CENTRAL_SIGNATURE).u16(VERSION).u16(VERSION).u16(UTF8_NAMES).u16(STORE)
        .u16(time).u16(date)
        .u32(crc).u32(body.length).u32(body.length)
        // name / extra / comment lengths, disk number, then the attributes.
        .u16(name.length).u16(0).u16(0).u16(0).u16(0).u32(0)
        .u32(offset)
        .raw(name)
        .done(),
    );

    chunks.push(local, body);
    offset += local.length + body.length;
  }

  const count = directory.length;
  const directorySize = directory.reduce((total, record) => total + record.length, 0);
  chunks.push(
    ...directory,
    new Fields()
      .u32(END_SIGNATURE).u16(0).u16(0).u16(count).u16(count)
      .u32(directorySize).u32(offset).u16(0)
      .done(),
  );

  return new Blob(chunks, { type: 'application/zip' });
}
