import { AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { errorKind } from '../api'

/** A failed call, in the visitor's language (429 = allowance spent, 403 = tool off, 401 = sign in). */
export function ErrorNote({ error }: { error: unknown }) {
  const { t } = useTranslation('voiceTools')
  if (!error) return null
  const { status, message, fields } = errorKind(error)
  const fieldText = Object.values(fields).flat().join(' ')
  const text =
    status === 429
      ? t('quota.refused')
      : status === 403
        ? t('errors.off')
        : status === 401
          ? t('errors.signIn')
          : status === 400 && fieldText
            ? fieldText
            : message && status >= 400 && status < 500
              ? message
              : t('errors.generic')
  return (
    <p role="alert" className="flex items-start gap-2 rounded-ctl border border-danger/30 bg-danger/8 px-3 py-2 text-sm text-danger">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{text}</span>
    </p>
  )
}
