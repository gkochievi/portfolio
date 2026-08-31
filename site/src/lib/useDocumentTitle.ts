import { useEffect } from 'react'

/**
 * Names the tab after the route that is mounted.
 *
 * Nothing else in the app touches `document.title`, so without this every route
 * inherits the one in `index.html` — the landing page's title would follow a
 * case-study link into someone's history, bookmarks and pasted messages. Every
 * route sets its own, so there is no cleanup to unwind.
 */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title
  }, [title])
}
