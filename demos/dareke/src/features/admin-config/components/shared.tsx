/** Small pieces shared by the admin-config screens. */
import { Check, Minus, RotateCw } from 'lucide-react'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { useMe } from '@/app/controls'
import { Alert, Button } from '@/components/ui'
import { errorMessage, fieldErrors } from '@/lib/api'
import { cn } from '@/lib/cn'
import { toast } from '@/lib/toast'

/** The handler's English messages -> keys under `server.*`, so Georgian users get Georgian errors. */
const SERVER_KEYS: Record<string, string> = {
  'This field is required.': 'required',
  'Choose working, paused or offline.': 'statusType',
  'The type of a system status cannot change.': 'systemType',
  'Enter whole seconds between 0 and 86400.': 'timeoutRange',
  'Use 2-32 letters, digits or underscores.': 'codeFormat',
  'This code already exists.': 'codeExists',
  'Enter a whole number from 1.': 'sortOrder',
  'Enter a ratio between 1.0 and 5.0.': 'ratioRange',
  'The minimum cannot exceed the base ratio.': 'minAboveBase',
  'The maximum must be at least the base ratio.': 'maxBelowBase',
  'Enter a percentage between 0 and 100.': 'abandonRange',
  'Enter whole seconds between 0 and 3600.': 'wrapRange',
  'The maximum must be at least the default.': 'wrapMaxBelow',
  'Use HH:mm.': 'timeFormat',
  'The end must be after the start.': 'endBeforeStart',
  'Pick at least one working day.': 'pickDay',
  'Enter a port between 1 and 65535.': 'port',
  'A host is required while the PBX is enabled.': 'pbxHostRequired',
  'Start with http:// or https://.': 'http',
  'Start with ws:// or wss://.': 'ws',
  'Start with ldap:// or ldaps://.': 'ldapUrl',
  'The filter must contain {{username}}.': 'filterToken',
  'A URL is required while the directory is enabled.': 'ldapUrlRequired',
  'Enter a valid phone number.': 'phoneInvalid',
  'This number is already on the DNC list.': 'phoneDuplicate',
  'The file is empty.': 'fileEmpty',
  'Cannot delete default status': 'cannotDeleteDefault',
  'Connected to PBX (Asterisk 20.x)': 'pbxOk',
  'PBX host is not configured': 'pbxNoHost',
  'Invalid AMI port': 'pbxBadPort',
  'Bind succeeded, directory reachable': 'ldapOk',
  'Directory URL is not configured': 'ldapNoUrl',
  'Invalid directory URL': 'ldapBadUrl',
  'Bind DN is required': 'ldapNoBind',
}

export const USERNAME_TOKEN = '{{username}}'

/** Translate a message the mock API produced (falls back to the raw text). */
export function useServerText() {
  const { t } = useTranslation('config')
  return useCallback(
    (message: string): string => {
      if (message.startsWith('Status is in use')) return t('server.statusInUse')
      const key = SERVER_KEYS[message]
      return key ? t(`server.${key}`, { token: USERNAME_TOKEN }) : message
    },
    [t],
  )
}

/** Translated `{field: message}` from an API validation error. */
export function useFieldErrors() {
  const text = useServerText()
  return useCallback(
    (error: unknown): Record<string, string> => {
      const out: Record<string, string> = {}
      for (const [field, message] of Object.entries(fieldErrors(error))) out[field] = text(message)
      return out
    },
    [text],
  )
}

/** Toast an API error in the visitor's language. */
export function useToastError() {
  const text = useServerText()
  return useCallback((error: unknown) => toast.error(text(errorMessage(error))), [text])
}

/** Admins and super admins may write; everyone else sees read-only screens. */
export function useCanEdit(): boolean {
  const { account } = useMe()
  return account?.role === 'admin' || account?.role === 'super_admin'
}

export function YesNo({ value }: { value: boolean }) {
  const { t } = useTranslation('config')
  return value ? (
    <span className="inline-flex items-center gap-1 text-success">
      <Check size={16} strokeWidth={2} aria-hidden />
      <span className="sr-only">{t('shared.yes')}</span>
    </span>
  ) : (
    <span className="inline-flex items-center text-muted">
      <Minus size={16} strokeWidth={1.75} aria-hidden />
      <span className="sr-only">{t('shared.no')}</span>
    </span>
  )
}

export function LoadError({ error, onRetry, className }: { error: unknown; onRetry: () => void; className?: string }) {
  const { t } = useTranslation('config')
  const { t: tc } = useTranslation()
  const text = useServerText()
  return (
    <Alert
      tone="danger"
      title={t('shared.loadError')}
      className={className}
      action={
        <Button size="sm" variant="outline" icon={<RotateCw size={16} strokeWidth={1.75} />} onClick={onRetry}>
          {tc('actions.retry')}
        </Button>
      }
    >
      {text(errorMessage(error))}
    </Alert>
  )
}

export function ReadOnlyNote() {
  const { t } = useTranslation('config')
  return (
    <Alert tone="info" className="mb-4">
      {t('shared.readOnly')}
    </Alert>
  )
}

/** A page body wrapper so every screen has the same rhythm. */
export function Stack({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('flex flex-col gap-4', className)}>{children}</div>
}
