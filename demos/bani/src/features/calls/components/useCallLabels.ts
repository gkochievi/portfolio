import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { useLang } from '@/shell/state'
import type { CallStatus } from '@/types'
import type { Translate } from '../lib/exportCalls'
import type { RowLabels } from '../lib/rows'

/** Translator + the label bundle the pure row helpers need. */
export function useCallLabels() {
  const { t } = useTranslation('calls')
  const { t: tc } = useTranslation('common')
  const lang = useLang()
  return useMemo(() => {
    const tt: Translate = (key, options) => t(key, options) as string
    const labels: RowLabels = {
      lang,
      status: (s) => tc(`callStatus.${s}`) as string,
      reason: (r) => t(`reasons.${r}`) as string,
      source: (s) => tc(`sources.${s}`) as string,
    }
    return { t, tt, labels, lang }
  }, [t, tc, lang])
}

export const STATUS_TONE: Record<CallStatus, 'success' | 'warning' | 'info' | 'danger' | 'neutral'> = {
  completed: 'success',
  no_answer: 'warning',
  busy: 'info',
  failed: 'danger',
  unknown: 'neutral',
}
