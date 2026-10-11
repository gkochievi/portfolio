import { useTranslation } from 'react-i18next'

import { asLang } from '@/lib/utils'
import type { Lang } from '@/types'

/** The current UI language, narrowed to 'en' | 'ka'. Owner: shell agent. */
export function useLang(): Lang {
  const { i18n } = useTranslation()
  return asLang(i18n.resolvedLanguage ?? i18n.language)
}
