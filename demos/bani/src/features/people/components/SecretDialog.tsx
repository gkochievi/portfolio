import { KeyRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button, CopyButton, Dialog, Mono } from '@/components/ui'

export interface SecretInfo {
  name: string
  username: string
  password: string
  mode: 'new' | 'regenerated'
}

/** A generated password, shown exactly once with a Copy button. */
export function SecretDialog({ secret, onClose }: { secret: SecretInfo | null; onClose: () => void }) {
  const { t } = useTranslation('people')
  return (
    <Dialog
      open={secret !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      dismissible={false}
      size="sm"
      title={t('secret.title')}
      description={secret ? t(secret.mode === 'new' ? 'secret.bodyNew' : 'secret.bodyRegenerated', { name: secret.name }) : undefined}
      footer={
        <Button variant="primary" onClick={onClose}>
          {t('secret.done')}
        </Button>
      }
    >
      {secret && (
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="eyebrow mb-1 text-muted">{t('secret.username')}</dt>
            <dd className="flex items-center justify-between gap-2 rounded-[8px] border border-line bg-sunken px-3 py-2">
              <Mono>{secret.username}</Mono>
              <CopyButton value={secret.username} />
            </dd>
          </div>
          <div>
            <dt className="eyebrow mb-1 flex items-center gap-1.5 text-muted">
              <KeyRound size={14} strokeWidth={1.75} aria-hidden />
              {t('secret.password')}
            </dt>
            <dd className="flex items-center justify-between gap-2 rounded-[8px] border border-line-strong bg-sunken px-3 py-2">
              <Mono className="break-all text-base text-ink">{secret.password}</Mono>
              <CopyButton value={secret.password} label={t('common:actions.copy')} />
            </dd>
          </div>
        </dl>
      )}
    </Dialog>
  )
}
