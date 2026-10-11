/** Small helpers shared by the admin-users screens. */
import { useTranslation } from 'react-i18next'

import { useMe } from '@/app/controls'
import { errorMessage, fieldErrors } from '@/lib/api'
import type { CampaignStatus, Role, Tone } from '@/types'

/** Translate an API error whose message is a `people:errors.*` key (falls back to the raw text). */
export function useErrorText() {
  const { t, i18n } = useTranslation('people')
  const text = (message: string | undefined | null): string => {
    if (!message) return ''
    return i18n.exists(`people:${message}`) ? t(message) : message
  }
  return {
    text,
    /** A toast-ready message for any rejection. */
    toastText: (error: unknown): string => {
      const fields = Object.values(fieldErrors(error))
      if (fields.length === 1) return text(fields[0])
      if (fields.length > 1) return t('errors.fixFields')
      return text(errorMessage(error))
    },
  }
}

/** The signed-in actor in the shape the role rules take. */
export function useActor(): { id: string; role: Role } | null {
  const { account } = useMe()
  return account ? { id: account.userId, role: account.role } : null
}

export const ROLE_TONE: Record<Role, Tone> = {
  super_admin: 'ink',
  admin: 'info',
  supervisor: 'lime',
  operator: 'muted',
}

export const CAMPAIGN_TONE: Record<CampaignStatus, Tone> = {
  draft: 'muted',
  active: 'success',
  paused: 'warning',
  completed: 'info',
  archived: 'ink',
}
