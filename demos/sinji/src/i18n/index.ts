/**
 * i18next init. Owned by the shell agent.
 * Every `src/**\/locales/<lng>/<ns>.json` is picked up; English is the default,
 * `?lang=ka` on first load opens Georgian (also read from a hash-router query).
 */
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { buildResources, type Lang } from '@portfolio/demo-kit'

const resources = buildResources(import.meta.glob('/src/**/locales/*/*.json', { eager: true, import: 'default' }))

function initialLang(): Lang {
  const read = (query: string) => new URLSearchParams(query).get('lang')
  const hashQuery = window.location.hash.includes('?') ? window.location.hash.slice(window.location.hash.indexOf('?')) : ''
  const wanted = read(window.location.search) ?? read(hashQuery)
  return wanted === 'ka' ? 'ka' : 'en'
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

export default i18n
