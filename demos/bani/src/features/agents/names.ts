/** Localised skill / team names (the seed holds English; ka translations live in agents.json). */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

export function useNames() {
  const { t, i18n } = useTranslation('agents')
  return useMemo(
    () => ({
      skill: (id: string, name: string): string => t(`skillNames.${id}`, { defaultValue: name }),
      team: (id: string, name: string): string => t(`teamNames.${id}`, { defaultValue: name }),
      collator: new Intl.Collator(i18n.language === 'ka' ? 'ka' : 'en', { sensitivity: 'base' }),
    }),
    [t, i18n.language],
  )
}

export const DEFAULT_LEVEL = 5
export const LEVELS = Array.from({ length: 10 }, (_, i) => i + 1)
