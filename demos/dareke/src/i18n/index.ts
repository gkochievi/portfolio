/**
 * i18next setup. Every namespace lives next to its code:
 * `src/<anywhere>/locales/<lng>/<ns>.json`. English is the default; `?lang=ka`
 * on first load opens Georgian. The language is kept in memory only (no
 * storage); <html lang> follows it so `:lang(ka)` styles apply.
 */
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { buildResources } from '@portfolio/demo-kit'

const resources = buildResources(import.meta.glob('../**/locales/*/*.json', { eager: true, import: 'default' }))

function initialLanguage(): 'en' | 'ka' {
  try {
    const fromQuery = new URLSearchParams(window.location.search).get('lang')
    // The hash router keeps the query inside the hash: /#/agent?lang=ka
    const fromHash = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('lang')
    return fromQuery === 'ka' || fromHash === 'ka' ? 'ka' : 'en'
  } catch {
    return 'en'
  }
}

const lng = initialLanguage()

void i18n.use(initReactI18next).init({
  resources,
  lng,
  fallbackLng: 'en',
  supportedLngs: ['en', 'ka'],
  ns: Object.keys(resources.en ?? {}),
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  returnNull: false,
  react: { useSuspense: false },
})

function syncHtml(language: string) {
  const root = document.documentElement
  root.lang = language === 'ka' ? 'ka' : 'en'
  document.title = language === 'ka' ? 'დარეკე - ლაივ დემო' : 'Dareke - live demo'
}

syncHtml(lng)
i18n.on('languageChanged', syncHtml)

export default i18n
