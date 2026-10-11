/** Browser-side file helpers: save bytes as a download, decode a data: URL. No network. */

export function saveBytes(fileName: string, bytes: Uint8Array, mime: string): void {
  const blob = new Blob([bytes as BlobPart], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
}

/** Decode a base64 `data:` URL (what Vite's `?inline` yields for a binary asset) into bytes. */
export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',')
  const meta = dataUrl.slice(0, comma)
  const payload = dataUrl.slice(comma + 1)
  if (!/;base64/i.test(meta)) return new TextEncoder().encode(decodeURIComponent(payload))
  const bin = atob(payload)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** Safe file-name fragment. */
export function slug(value: string): string {
  return value.replace(/[^\w.\-]+/g, '_').replace(/^_+|_+$/g, '') || 'file'
}
