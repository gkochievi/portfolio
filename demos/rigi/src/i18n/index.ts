/**
 * i18next setup. Owner: shell.
 *
 * Every namespace lives next to its code as `locales/<lng>/<ns>.json`:
 *   src/i18n/locales/{en,ka}/common.json        (design-system)
 *   src/app/locales/{en,ka}/shell.json          (shell)
 *   src/features/<id>/locales/{en,ka}/<id>.json (each feature group)
 *
 * English is the default. `?lang=ka` on first load (in the query string, or in
 * the hash's query under VITE_ROUTER=hash) opens Georgian. The choice is kept
 * in memory only; a reload goes back to the URL's language.
 */
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { buildResources, type Lang } from '@portfolio/demo-kit'

const resources = buildResources(
  import.meta.glob(['./locales/*/*.json', '../app/locales/*/*.json', '../features/*/locales/*/*.json'], {
    eager: true,
    import: 'default',
  }),
)

function initialLang(): Lang {
  const read = (query: string): string | null => new URLSearchParams(query).get('lang')
  const hash = window.location.hash
  const hashQuery = hash.includes('?') ? hash.slice(hash.indexOf('?')) : ''
  return (read(window.location.search) ?? read(hashQuery)) === 'ka' ? 'ka' : 'en'
}

const lng = initialLang()

void i18n.use(initReactI18next).init({
  resources,
  lng,
  fallbackLng: 'en',
  supportedLngs: ['en', 'ka'],
  ns: Object.keys(resources.en ?? {}),
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  returnNull: false,
})

function syncDocumentLang(language: string): void {
  document.documentElement.lang = language
}

syncDocumentLang(lng)
i18n.on('languageChanged', syncDocumentLang)

export function setLanguage(language: Lang): void {
  void i18n.changeLanguage(language)
}

export default i18n
