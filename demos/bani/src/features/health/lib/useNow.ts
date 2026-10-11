import { useEffect, useState } from 'react'

/** Re-render every `ms` so "x minutes ago" labels and 24 h windows stay current. */
export function useNow(ms = 30_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}
