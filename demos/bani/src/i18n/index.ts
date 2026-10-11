/**
 * i18next for Bani. Every owner keeps strings next to its code in
 * `locales/<lng>/<namespace>.json`; the glob below gathers them all.
 * English by default; `?lang=ka` on first load opens Georgian. Nothing is persisted.
 */
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { buildResources } from '@portfolio/demo-kit'

import type { Lang } from '@/types'

const resources = buildResources(import.meta.glob('/src/**/locales/*/*.json', { eager: true }))

function initialLang(): Lang {
  try {
    const fromSearch = new URLSearchParams(window.location.search).get('lang')
    const hashQuery = window.location.hash.split('?')[1] ?? ''
    const fromHash = new URLSearchParams(hashQuery).get('lang')
    return (fromSearch ?? fromHash) === 'ka' ? 'ka' : 'en'
  } catch {
    return 'en'
  }
}

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLang(),
  fallbackLng: 'en',
  supportedLngs: ['en', 'ka'],
  ns: Object.keys(resources.en ?? { common: {} }),
  defaultNS: 'common',
  fallbackNS: 'common',
  interpolation: { escapeValue: false },
})

const syncHtmlLang = (lng: string) => {
  document.documentElement.lang = lng
}
syncHtmlLang(i18n.language)
i18n.on('languageChanged', syncHtmlLang)

export function currentLang(): Lang {
  return i18n.language === 'ka' ? 'ka' : 'en'
}

export function setLang(lang: Lang): void {
  void i18n.changeLanguage(lang)
}

export default i18n
