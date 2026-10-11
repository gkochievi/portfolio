/** Resolve a media path from `public/` against the build base (never an absolute path). */
export function mediaUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`
}
