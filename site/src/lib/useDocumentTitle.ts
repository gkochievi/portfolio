import { useEffect } from 'react'

import { useLang } from '@/i18n/LanguageContext'

/**
 * Names the tab after the route that is mounted, and describes the page in the
 * reader's language.
 *
 * Nothing else in the app touches `document.title`, so without this every route
 * inherits the one in `index.html` — the landing page's title would follow a
 * case-study link into someone's history, bookmarks and pasted messages. Every
 * route sets its own, so there is no cleanup to unwind.
 *
 * `<meta name="description">` is the same problem in the other language:
 * `index.html` ships the English one, so a Georgian page would describe itself
 * in English. It is set from the dictionary's `meta.description` here, beside
 * the title, so it follows both a route change (every page calls this) and a
 * language switch (the string changes with `lang`).
 */
export function useDocumentTitle(title: string): void {
  const { t } = useLang()
  const description = t('meta.description')

  useEffect(() => {
    document.title = title
  }, [title])

  useEffect(() => {
    let meta = document.head.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'description'
      document.head.appendChild(meta)
    }
    meta.content = description
  }, [description])
}
