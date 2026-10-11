/**
 * Resolve a stored media path against the build's base. Seed paths are
 * BASE_URL-relative (`media/items/kvamli-coffee.svg`); uploads are `blob:`
 * URLs and pass through untouched. Never build an absolute `/media/...` path.
 */
export function assetUrl(path: string | null | undefined): string | null {
  if (!path) return null
  if (/^(blob:|data:)/.test(path)) return path
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`
}
