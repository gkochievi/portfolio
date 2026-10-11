/** Render seeded bilingual text in the current language. */
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import type { Lang, LText } from '@/types'

export function pickText(value: LText | null | undefined, lang: Lang): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  return value[lang] || value.en
}

export function useLang(): Lang {
  const { i18n } = useTranslation()
  return i18n.language === 'ka' ? 'ka' : 'en'
}

/** `const l = useLocalized(); l(campaign.name)` */
export function useLocalized(): (value: LText | null | undefined) => string {
  const lang = useLang()
  return useCallback((value: LText | null | undefined) => pickText(value, lang), [lang])
}
