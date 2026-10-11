/** Re-authentication dialog: asks for the signed-in user's own password. */
import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { ConfirmDialog, Field, Input } from '@/components/ui'

export interface PasswordConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  tone?: 'primary' | 'danger'
  pending?: boolean
  /** Server-side error for the password field. */
  error?: string | null
  onConfirm: (password: string) => void
}

export function PasswordConfirmDialog({ open, onOpenChange, title, description, confirmLabel, tone = 'primary', pending, error, onConfirm }: PasswordConfirmDialogProps) {
  const { t } = useTranslation('partners')
  const [password, setPassword] = useState('')
  useEffect(() => {
    if (!open) setPassword('')
  }, [open])

  function submit(e?: FormEvent) {
    e?.preventDefault()
    if (password) onConfirm(password)
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      tone={tone}
      pending={pending}
      confirmDisabled={!password}
      onConfirm={submit}
    >
      <form onSubmit={submit} className="mt-1">
        <Field label={t('dialogs.passwordLabel')} hint={t('dialogs.passwordHint')} error={error} htmlFor="reauth-password">
          <Input
            id="reauth-password"
            type="password"
            autoComplete="current-password"
            autoFocus
            invalid={Boolean(error)}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
      </form>
    </ConfirmDialog>
  )
}
