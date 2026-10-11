import { useEffect, useRef, useState } from 'react'

/**
 * Ids that appeared since the list was first shown (a mail arrived while the
 * inbox was open). Reset by `resetKey` (filters, view, page) so paging and
 * filtering never animate. The set clears itself after the animation.
 */
export function useFreshIds(ids: string[] | undefined, resetKey: string): Set<string> {
  const seen = useRef<{ key: string; set: Set<string> } | null>(null)
  const [fresh, setFresh] = useState<Set<string>>(() => new Set())
  const signature = ids ? ids.join('|') : null

  useEffect(() => {
    if (!ids) return
    const current = seen.current
    if (!current || current.key !== resetKey) {
      seen.current = { key: resetKey, set: new Set(ids) }
      setFresh(new Set())
      return
    }
    const added = ids.filter((id) => !current.set.has(id))
    for (const id of ids) current.set.add(id)
    if (added.length === 0) return
    setFresh(new Set(added))
    const timer = window.setTimeout(() => setFresh(new Set()), 1600)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, resetKey])

  return fresh
}
