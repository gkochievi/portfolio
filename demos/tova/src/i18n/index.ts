/**
 * Owner: shell. One i18next instance for the whole demo.
 *
 * Every namespace is a JSON file under some `locales/<lng>/<ns>.json`
 * (common lives in src/i18n/locales, each feature keeps its own in
 * src/features/<id>/locales). English is the default; `?lang=ka` on first
 * load (in the query string or inside the hash route) opens Georgian.
 * The choice lives in memory only: no localStorage. <html lang> follows it.
 */
import i18n from 'i18next'
import { initReactI18next, useTranslation } from 'react-i18next'
import { buildResources, type Lang } from '@portfolio/demo-kit'

const resources = buildResources(import.meta.glob('/src/**/locales/*/*.json', { eager: true, import: 'default' }))

function langFromUrl(): Lang {
  const fromSearch = new URLSearchParams(window.location.search).get('lang')
  const hashQuery = window.location.hash.split('?')[1] ?? ''
  const fromHash = new URLSearchParams(hashQuery).get('lang')
  return (fromSearch ?? fromHash) === 'ka' ? 'ka' : 'en'
}

const initial = langFromUrl()

void i18n.use(initReactI18next).init({
  resources,
  lng: initial,
  fallbackLng: 'en',
  supportedLngs: ['en', 'ka'],
  ns: Object.keys(resources.en ?? {}),
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  returnNull: false,
  react: { useSuspense: false },
})

function syncHtmlLang(lng: string): void {
  document.documentElement.lang = lng === 'ka' ? 'ka' : 'en'
}

syncHtmlLang(initial)
i18n.on('languageChanged', syncHtmlLang)

export function setLang(lang: Lang): void {
  void i18n.changeLanguage(lang)
}

export function currentLang(): Lang {
  return i18n.language === 'ka' ? 'ka' : 'en'
}

/** The active language, re-rendering on change. */
export function useLang(): Lang {
  const { i18n: instance } = useTranslation()
  return instance.language === 'ka' ? 'ka' : 'en'
}

export type { Lang }
export default i18n
