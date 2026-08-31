import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from './locales/en.json'

export const SUPPORTED_LANGUAGES = [{ code: 'en', label: 'English', short: 'EN' }] as const

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code']

const STORAGE_KEY = 'printomato.lang'

/**
 * English ships today. A second locale only needs a JSON file dropped into
 * ./locales and one entry added to SUPPORTED_LANGUAGES — every string in the
 * console already routes through t().
 */
void i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: localStorage.getItem(STORAGE_KEY) ?? 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
})

export function setLanguage(code: LanguageCode): void {
  localStorage.setItem(STORAGE_KEY, code)
  void i18n.changeLanguage(code)
}

export default i18n
