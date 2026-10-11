/**
 * i18next setup (owner: shell).
 *
 * Every feature keeps its strings next to its code as
 * `src/features/<id>/locales/<lng>/<namespace>.json`; `common` lives in
 * `src/i18n/locales/<lng>/common.json`, `shell` in `src/app/locales`.
 * English is the default; `?lang=ka` on first load opens Georgian. Switching
 * changes i18n only (nothing is stored); <html lang> follows the language.
 */
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { buildResources } from '@portfolio/demo-kit'

import type { Lang } from '@/types'

const resources = buildResources(import.meta.glob('../**/locales/*/*.json', { eager: true, import: 'default' }))

/** Reads `?lang=` from the search string, or from the hash part under the hash router. */
export function initialLang(): Lang {
  const fromSearch = new URLSearchParams(window.location.search).get('lang')
  const hashQuery = window.location.hash.split('?')[1] ?? ''
  const fromHash = new URLSearchParams(hashQuery).get('lang')
  return (fromSearch ?? fromHash) === 'ka' ? 'ka' : 'en'
}

const lng = initialLang()

void i18n.use(initReactI18next).init({
  resources,
  lng,
  fallbackLng: 'en',
  supportedLngs: ['en', 'ka'],
  defaultNS: 'common',
  ns: Object.keys(resources.en ?? {}),
  interpolation: { escapeValue: false },
  returnNull: false,
})

document.documentElement.lang = lng
i18n.on('languageChanged', (next) => {
  document.documentElement.lang = next
})

/** The current UI language, narrowed. */
export function currentLang(): Lang {
  return i18n.language?.startsWith('ka') ? 'ka' : 'en'
}

export default i18n
