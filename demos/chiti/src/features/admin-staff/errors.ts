import { useTranslation } from 'react-i18next'

import { errorMessage, isApiError } from '@/api/client'

/** Translate the machine codes the handlers attach to their errors. */
export function useStaffErrors() {
  const { t } = useTranslation('adminStaff')
  return {
    /** A message fit for a toast. */
    text(error: unknown): string {
      const code = isApiError(error) ? error.fieldErrors.code?.[0] : undefined
      if (code && t(`errors.${code}`, { defaultValue: '' })) return t(`errors.${code}`)
      if (isApiError(error) && error.status === 403) return t('errors.forbidden')
      return errorMessage(error, t('errors.generic'))
    },
    /** Server field errors -> translated [formField, message] pairs. */
    fields(error: unknown): [string, string][] {
      if (!isApiError(error)) return []
      return Object.entries(error.fieldErrors)
        .filter(([field]) => field !== 'code' && field !== 'non_field_errors')
        .map(([field, messages]) => {
          const code = messages[0] ?? ''
          return [field === 'name' ? 'nameEn' : field, t(`errors.field.${code}`, { defaultValue: code })] as [string, string]
        })
    },
  }
}
