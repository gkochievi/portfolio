import { useTranslation } from 'react-i18next'

import { Banner, Button } from '@/components/ui'

/** Inline load failure with a retry, shared by the ledger pages. */
export function ErrorPanel({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation('common')
  return (
    <Banner
      tone="danger"
      title={t('states.error')}
      action={
        <Button size="sm" variant="outline" onClick={onRetry}>
          {t('actions.retry')}
        </Button>
      }
    />
  )
}
