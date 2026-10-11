/**
 * i18next setup. Every feature keeps its strings in
 * src/features/<group>/locales/<lng>/<ns>.json; shared strings live in
 * src/i18n/locales/<lng>/common.json and the shell's in
 * src/components/layout/locales/<lng>/shell.json. The glob gathers them all.
 *
 * English is the default; `?lang=ka` on first load (search or hash query)
 * opens Georgian. <html lang> follows the language, which also switches the
 * Georgian font stacks (:lang(ka) in styles/index.css). Nothing is persisted.
 * Owner: shell agent.
 */
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { buildResources } from '@portfolio/demo-kit'

import type { Lang } from '@/types'

const resources = buildResources(import.meta.glob('../**/locales/*/*.json', { eager: true, import: 'default' }))

function initialLang(): Lang {
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
  fallbackNS: 'common',
  ns: Array.from(new Set([...Object.keys(resources.en ?? {}), ...Object.keys(resources.ka ?? {})])),
  interpolation: { escapeValue: false },
  returnNull: false,
})

function syncHtmlLang(next: string) {
  document.documentElement.lang = next === 'ka' ? 'ka' : 'en'
}

syncHtmlLang(lng)
i18n.on('languageChanged', syncHtmlLang)

/** Switch the UI language (same as the ENG / ქარ pill). */
export function setLanguage(next: Lang): void {
  void i18n.changeLanguage(next)
}

export default i18n
