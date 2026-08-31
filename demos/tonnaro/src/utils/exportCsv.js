function escapeCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(rows) {
  return rows.map((row) => row.map(escapeCell).join(',')).join('\r\n');
}

export function downloadCsv(filename, rows) {
  const csv = toCsv(rows);
  // Add BOM so Excel opens UTF-8 (e.g. ₾, €, ₽, Georgian/Russian) correctly.
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function joinSheets(sections) {
  const rows = [];
  sections.forEach((section, i) => {
    if (i > 0) rows.push([]);
    if (section.title) {
      rows.push([section.title]);
    }
    if (section.headers) rows.push(section.headers);
    section.rows.forEach((r) => rows.push(r));
  });
  return rows;
}
