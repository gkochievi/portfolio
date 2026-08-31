/**
 * A minimal OOXML workbook writer — the second half of ruling 12.
 *
 * `zip.ts` builds the container; this builds the XML parts that go in it, so
 * the three export endpoints hand the browser a file a reviewer can double-click
 * and open in Excel, Numbers, LibreOffice or openpyxl. A CSV renamed `.xlsx`
 * would open in exactly one of those.
 *
 * ---------------------------------------------------------------------------
 *  THE API — three handler authors write against this
 * ---------------------------------------------------------------------------
 *
 * One sheet — `/admin/bookings/export-xlsx/` and `/admin/customers/export-xlsx/`:
 *
 * ```ts
 * import { workbook } from '../xlsx';
 * import { file } from '../base';
 *
 * const blob = workbook({
 *   sheet: 'Bookings',
 *   columns: ['ID', 'Date', 'Time', 'Customer', 'Phone', 'Walk-in', 'Barber',
 *             'Service', 'Price (GEL)', 'Status', 'Notes', 'Created'],
 *   rows: rows.map((b) => [b.id, date, time, customer, phone, walkIn, barber,
 *                          service, Number(b.price_at_booking), b.status,
 *                          b.notes ?? '', created]),
 * });
 * return file(blob, `bookings_${todayKey()}.xlsx`);
 * ```
 *
 * Several sheets — `/admin/analytics/export-xlsx/`:
 *
 * ```ts
 * import { workbook, styled } from '../xlsx';
 *
 * workbook({
 *   sheets: [
 *     {
 *       name: 'Summary',
 *       widths: [12, 40],                       // analytics' clamp; default [10, 50]
 *       rows: [                                 // no `columns` — this sheet has no header row
 *         [styled('Nabadi Barbershop — Analytics', 'title')],
 *         [`Range: ${from} → ${to}`],
 *         [styled(`Barber: ${label}`, 'note')], // per-barber mode only
 *         [styled('Total bookings', 'label'), summary.total_bookings],
 *         [styled('Revenue (GEL)', 'label'), summary.revenue_completed], // a string stays text
 *       ],
 *     },
 *     { name: 'Daily revenue', widths: [12, 40],
 *       columns: ['Date', 'Bookings completed', 'Revenue (GEL)'], rows: daily },
 *   ],
 * });
 * ```
 *
 * `workbook()` also accepts a bare `SheetInput[]`, which is the same thing with
 * less punctuation.
 *
 * **`columns` is optional.** When present it becomes row 1, styled the way the
 * spec asks for — bold white on a solid `#20180F` fill, left/middle aligned. A
 * sheet without it, like analytics' `Summary`, is just `rows`.
 *
 * **Cell values are typed by their JavaScript type**, which is the whole
 * contract and the one thing worth getting right at the call site:
 *
 * | You pass | The cell is |
 * |---|---|
 * | `number` | a real number — sortable, summable, right-aligned |
 * | `string` | text, always, even `'150.00'` and `'66.67%'` |
 * | `boolean` | `TRUE` / `FALSE` |
 * | `Date` | a date serial, formatted `yyyy-mm-dd` (plus `hh:mm` if it has a time), read in **Tbilisi** |
 * | `null` / `undefined` / `''` | an empty cell |
 *
 * That mapping is deliberate and it matches the specs exactly: `Price (GEL)`
 * and `Revenue (GEL)` on the row sheets are `float(...)` upstream, so pass a
 * `number`; `revenue_completed` and `avg_ticket_size` on the Summary sheet are
 * written **as the string** upstream, so pass the string and it stays text.
 *
 * Helpers: `styled(value, 'title' | 'label' | 'note' | 'header' | 'plain')` and
 * `asText(value)`, which forces a number to be stored as text. Both return a
 * `Cell`, which is accepted anywhere a bare value is.
 *
 * ---------------------------------------------------------------------------
 *  WHAT ACTUALLY BREAKS A WORKBOOK, AND WHAT IS DONE ABOUT IT
 * ---------------------------------------------------------------------------
 *
 * 1. **Unescaped text.** An `&` or a `<` in a customer's notes field closes the
 *    part. Every string goes through `esc()`.
 * 2. **Control characters.** XML 1.0 has no escape for U+0001–U+001F (bar tab,
 *    LF and CR); a literal one is a parse error, not a mojibake. They are
 *    stripped, which is what openpyxl does too.
 * 3. **Leading and trailing spaces** are dropped by a conforming reader unless
 *    the `<t>` carries `xml:space="preserve"`. It is added when it matters.
 * 4. **Formula injection.** A text cell beginning `=`, `+`, `-`, `@`, tab or CR
 *    is a live formula the moment a spreadsheet decides to re-parse it — the
 *    CSV attack, and `notes` and `walk_in_name` are visitor-controlled. Strings
 *    are already written as `inlineStr`, which no reader evaluates, and this
 *    file never emits an `<f>` element at all; on top of that such a cell gets
 *    the `quotePrefix` flag, Excel's own "this is literal text" mark, so a
 *    copy-paste out of the sheet does not resurrect it.
 * 5. **Sheet names.** Excel rejects `\ / ? * [ ] :`, blank names, names over 31
 *    characters and duplicates — and rejects the *file*, not the sheet. Names
 *    are sanitised and de-duplicated on the way in.
 * 6. **Non-finite numbers.** `<v>NaN</v>` is not a double. Such a value falls
 *    back to text.
 *
 * Inline strings rather than a shared string table: one part fewer, no dedupe
 * pass over ten thousand rows, and the format treats the two as equals.
 */

import { DAY, TZ_OFFSET_MS } from './base';
import { zip } from './zip';
import type { ZipEntry } from './zip';

// --------------------------------------------------------------------------- //
//  The call-site types
// --------------------------------------------------------------------------- //

export type CellValue = string | number | boolean | Date | null | undefined;

/**
 * `header` is the styled column head; `title`, `label` and `note` exist for the
 * analytics Summary sheet, which is a label/value block rather than a table.
 */
export type CellStyle = 'plain' | 'header' | 'title' | 'label' | 'note';

export interface Cell {
  value: CellValue;
  style?: CellStyle;
  /** Store a number or boolean as text — see `asText()`. */
  text?: boolean;
}

export type CellInput = CellValue | Cell;

export type Row = readonly CellInput[];

interface SheetBody {
  /** Optional header row, written first and styled. */
  columns?: readonly string[];
  rows?: readonly Row[];
  /**
   * Auto-width clamp, `[min, max]`, applied to `longest cell + 2`. The bookings
   * and customers exports use `[10, 50]` (the default); analytics uses `[12, 40]`.
   */
  widths?: readonly [min: number, max: number];
}

export interface SheetInput extends SheetBody {
  name: string;
}

/** `workbook({sheet: 'Bookings', columns, rows})` — the one-sheet shorthand. */
export interface SingleSheetInput extends SheetBody {
  sheet: string;
}

export interface MultiSheetInput {
  sheets: readonly SheetInput[];
}

export type WorkbookInput = SingleSheetInput | MultiSheetInput | readonly SheetInput[];

/** Attach a style to a value: `styled('Total bookings', 'label')`. */
export function styled(value: CellValue, style: CellStyle): Cell {
  return { value, style };
}

/** Store a value as text even though it is a number — a phone number that must
 *  keep its leading `+`, an ID that must not be summed. */
export function asText(value: CellValue): Cell {
  return { value, text: true };
}

// --------------------------------------------------------------------------- //
//  XML
// --------------------------------------------------------------------------- //

const DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_PACKAGE_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';

// Everything XML 1.0 has no representation for. Tab, LF and CR are legal and kept.
const FORBIDDEN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

function esc(value: string): string {
  return value
    .replace(FORBIDDEN, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** `0 → A`, `25 → Z`, `26 → AA`. Spreadsheet columns are bijective base-26, so
 *  the usual base conversion is off by one at every digit. */
function columnRef(index: number): string {
  let ref = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    ref = String.fromCharCode(65 + ((n - 1) % 26)) + ref;
  }
  return ref;
}

// --------------------------------------------------------------------------- //
//  Styles
// --------------------------------------------------------------------------- //

/**
 * Indices into `<cellXfs>`, which is the only table a cell can point at.
 *
 * The five text styles each need a `quotePrefix` twin for rule 4, and a twin
 * lives at `base + QUOTED`, so a formula-leading label stays a label.
 */
const XF = {
  plain: 0,
  header: 1,
  title: 2,
  label: 3,
  note: 4,
  date: 5,
  datetime: 6,
} as const;

const QUOTED = 7;

const STYLE_INDEX: Readonly<Record<CellStyle, number>> = {
  plain: XF.plain,
  header: XF.header,
  title: XF.title,
  label: XF.label,
  note: XF.note,
};

/**
 * Hand-written rather than generated, because it never varies: the brand ink
 * `#20180F` header fill both export specs name, plus the four text weights the
 * analytics Summary sheet uses.
 *
 * The first two fills are not a choice — Excel requires fill 0 to be `none` and
 * fill 1 to be `gray125`, and silently repairs a file that says otherwise. The
 * empty `<border>` and the single `<cellStyleXfs>` entry are required for the
 * same reason.
 */
const STYLES_XML =
  `${DECLARATION}<styleSheet xmlns="${NS_MAIN}">` +
  '<numFmts count="2">' +
  '<numFmt numFmtId="164" formatCode="yyyy\\-mm\\-dd"/>' +
  '<numFmt numFmtId="165" formatCode="yyyy\\-mm\\-dd\\ hh:mm"/>' +
  '</numFmts>' +
  '<fonts count="5">' +
  '<font><sz val="11"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="14"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="11"/><name val="Calibri"/></font>' +
  '<font><i/><sz val="11"/><name val="Calibri"/></font>' +
  '</fonts>' +
  '<fills count="3">' +
  '<fill><patternFill patternType="none"/></fill>' +
  '<fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FF20180F"/>' +
  '<bgColor indexed="64"/></patternFill></fill>' +
  '</fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="12">' +
  // 0–6: plain, header, title, label, note, date, datetime.
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"' +
  ' applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>' +
  '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  // 7–11: the same five text styles again, flagged as literal text.
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" quotePrefix="1"/>' +
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" quotePrefix="1" applyFont="1"' +
  ' applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>' +
  '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" quotePrefix="1" applyFont="1"/>' +
  '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" quotePrefix="1" applyFont="1"/>' +
  '<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" quotePrefix="1" applyFont="1"/>' +
  '</cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>';

// --------------------------------------------------------------------------- //
//  Cells
// --------------------------------------------------------------------------- //

function isCell(input: CellInput): input is Cell {
  return typeof input === 'object' && input !== null && !(input instanceof Date);
}

/** The characters that turn a text cell into a live formula on re-parse. */
const FORMULA_LEAD = /^[=+\-@\t\r]/;

/** Excel's epoch is 1899-12-30, not 1900-01-01: the serial carries a phantom
 *  29 February 1900 it inherited from Lotus 1-2-3 and can never drop. */
const EXCEL_EPOCH_OFFSET = 25569;

function dateSerial(at: number): number {
  // Read in Tbilisi (ruling 13), so a booking at 23:30 local does not land on
  // the previous day because the host machine happens to sit west of Georgia.
  return (at + TZ_OFFSET_MS) / DAY + EXCEL_EPOCH_OFFSET;
}

interface Written {
  xml: string;
  /** Characters the value occupies, for the auto-width pass. */
  width: number;
}

const EMPTY: Written = { xml: '', width: 0 };

function writeText(value: string, ref: string, style: number): Written {
  if (value === '') return EMPTY;
  // The `quotePrefix` twins exist only for the five text styles, which are the
  // ones `STYLE_INDEX` can produce.
  const xf = FORMULA_LEAD.test(value) ? style + QUOTED : style;
  const preserve = value !== value.trim() ? ' xml:space="preserve"' : '';
  return {
    xml: `<c r="${ref}" s="${xf}" t="inlineStr"><is><t${preserve}>${esc(value)}</t></is></c>`,
    width: value.length,
  };
}

function writeCell(input: CellInput, ref: string): Written {
  const cell: Cell = isCell(input) ? input : { value: input };
  const value = cell.value;
  if (value === null || value === undefined) return EMPTY;

  const style = STYLE_INDEX[cell.style ?? 'plain'];

  if (value instanceof Date) {
    const at = value.getTime();
    // An Invalid Date is a bug upstream of here, and an empty cell says so far
    // more clearly than `NaN` would.
    if (!Number.isFinite(at)) return EMPTY;
    const serial = dateSerial(at);
    // A whole serial is midnight, so a time half would render as `00:00` and
    // assert something the row never knew. Show the date alone.
    const midnight = Number.isInteger(serial);
    return {
      xml: `<c r="${ref}" s="${midnight ? XF.date : XF.datetime}"><v>${serial}</v></c>`,
      width: midnight ? 10 : 16,
    };
  }

  if (typeof value === 'number' && !cell.text) {
    if (!Number.isFinite(value)) return writeText(String(value), ref, style);
    return {
      xml: `<c r="${ref}" s="${style}"><v>${value}</v></c>`,
      width: String(value).length,
    };
  }

  if (typeof value === 'boolean' && !cell.text) {
    return {
      xml: `<c r="${ref}" s="${style}" t="b"><v>${value ? 1 : 0}</v></c>`,
      width: value ? 4 : 5,
    };
  }

  return writeText(String(value), ref, style);
}

// --------------------------------------------------------------------------- //
//  Sheets
// --------------------------------------------------------------------------- //

const DEFAULT_WIDTHS: readonly [number, number] = [10, 50];

/** Excel rejects the whole file over a bad sheet name, so this is a hard clean
 *  rather than a validation: forbidden characters out, 31-character cap, no
 *  leading or trailing apostrophe, never blank, never a duplicate. */
function sheetName(raw: string, taken: Set<string>): string {
  let name = raw.replace(/[\\/?*[\]:]/g, ' ').replace(/^'+|'+$/g, '').trim().slice(0, 31);
  if (name === '') name = 'Sheet';

  if (taken.has(name.toLowerCase())) {
    // Number the collision, trimming the stem so the suffix still fits in 31.
    for (let n = 2; ; n += 1) {
      const suffix = ` (${n})`;
      const candidate = name.slice(0, 31 - suffix.length) + suffix;
      if (!taken.has(candidate.toLowerCase())) {
        name = candidate;
        break;
      }
    }
  }

  taken.add(name.toLowerCase());
  return name;
}

function sheetXml(sheet: SheetBody): string {
  const body = sheet.rows ?? [];
  const rows: Row[] = sheet.columns
    ? [sheet.columns.map((column) => styled(column, 'header')), ...body]
    : [...body];

  const widest: number[] = [];
  const parts: string[] = [];
  let lastColumn = 0;

  for (const [index, row] of rows.entries()) {
    const cells: string[] = [];
    for (const [column, input] of row.entries()) {
      const written = writeCell(input, `${columnRef(column)}${index + 1}`);
      if (written.xml === '') continue;
      cells.push(written.xml);
      widest[column] = Math.max(widest[column] ?? 0, written.width);
      if (column + 1 > lastColumn) lastColumn = column + 1;
    }
    // A row whose cells are all empty is still a row: dropping it would shift
    // everything below it up and silently change the sheet.
    parts.push(`<row r="${index + 1}">${cells.join('')}</row>`);
  }

  const [min, max] = sheet.widths ?? DEFAULT_WIDTHS;
  const cols = widest
    .map(
      (longest, index) =>
        `<col min="${index + 1}" max="${index + 1}"` +
        ` width="${Math.max(min, Math.min(longest + 2, max))}" customWidth="1"/>`,
    )
    .join('');

  const dimension =
    rows.length > 0 && lastColumn > 0
      ? `A1:${columnRef(lastColumn - 1)}${rows.length}`
      : 'A1';

  return (
    `${DECLARATION}<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">` +
    `<dimension ref="${dimension}"/>` +
    '<sheetViews><sheetView workbookViewId="0"/></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    (cols === '' ? '' : `<cols>${cols}</cols>`) +
    `<sheetData>${parts.join('')}</sheetData>` +
    '</worksheet>'
  );
}

// --------------------------------------------------------------------------- //
//  The workbook
// --------------------------------------------------------------------------- //

function normalise(input: WorkbookInput): readonly SheetInput[] {
  if (Array.isArray(input)) return input as readonly SheetInput[];
  const single = input as SingleSheetInput | MultiSheetInput;
  if ('sheets' in single) return single.sheets;
  const { sheet, ...rest } = single;
  return [{ name: sheet, ...rest }];
}

/**
 * Build the archive.
 *
 * Part order follows what Excel itself writes — content types first, then the
 * package relationships — because a reader is entitled to stop at the first
 * entry it needs rather than index the whole central directory.
 */
export function workbook(input: WorkbookInput): Blob {
  const sheets = normalise(input);
  if (sheets.length === 0) {
    // A workbook with no sheet will not open. An export that matched nothing
    // gets one empty sheet instead of a file the reviewer cannot look at.
    return workbook([{ name: 'Sheet1' }]);
  }

  const taken = new Set<string>();
  const names = sheets.map((sheet) => sheetName(sheet.name, taken));

  const contentTypes =
    `${DECLARATION}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    '<Default Extension="rels"' +
    ' ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-' +
    'officedocument.spreadsheetml.sheet.main+xml"/>' +
    sheets
      .map(
        (_, index) =>
          `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType=` +
          '"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>',
      )
      .join('') +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-' +
    'officedocument.spreadsheetml.styles+xml"/>' +
    '</Types>';

  const rootRels =
    `${DECLARATION}<Relationships xmlns="${NS_PACKAGE_REL}">` +
    `<Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/>` +
    '</Relationships>';

  const workbookXml =
    `${DECLARATION}<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}"><sheets>` +
    names
      .map(
        (name, index) =>
          `<sheet name="${esc(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
      )
      .join('') +
    '</sheets></workbook>';

  const workbookRels =
    `${DECLARATION}<Relationships xmlns="${NS_PACKAGE_REL}">` +
    names
      .map(
        (_, index) =>
          `<Relationship Id="rId${index + 1}" Type="${NS_REL}/worksheet"` +
          ` Target="worksheets/sheet${index + 1}.xml"/>`,
      )
      .join('') +
    // The stylesheet's rId follows the sheets', so adding a sheet never
    // renumbers it out from under a part that already points at it.
    `<Relationship Id="rId${names.length + 1}" Type="${NS_REL}/styles" Target="styles.xml"/>` +
    '</Relationships>';

  const entries: ZipEntry[] = [
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: rootRels },
    { name: 'xl/workbook.xml', data: workbookXml },
    { name: 'xl/_rels/workbook.xml.rels', data: workbookRels },
    { name: 'xl/styles.xml', data: STYLES_XML },
    ...sheets.map((sheet, index) => ({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      data: sheetXml(sheet),
    })),
  ];

  return new Blob([zip(entries)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
