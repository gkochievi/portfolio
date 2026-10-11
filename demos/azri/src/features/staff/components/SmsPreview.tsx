import { MessageSquare } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { BubbleCard, Card, CardHeader, TenantMark } from '@/components/ui'
import { useLang } from '@/hooks/useLang'
import type { Branch, Tenant } from '@/types'
import { PLACEHOLDER_TOKEN, SHORT_LINK_HOST, smsBodyFor } from '../sms'

interface SmsPreviewProps {
  tenant: Tenant | undefined
  branch: Branch | undefined
  /** Display line for the recipient, or null when none is chosen yet. */
  recipient: string | null
}

/** Live preview of the survey SMS, drawn as a bubble card (never phone chrome). */
export function SmsPreview({ tenant, branch, recipient }: SmsPreviewProps) {
  const { t } = useTranslation('staff')
  const lang = useLang()
  const placeholderLink = `${SHORT_LINK_HOST}${PLACEHOLDER_TOKEN}`

  return (
    <Card padding="lg">
      <CardHeader
        icon={<MessageSquare strokeWidth={1.75} />}
        title={t('send.preview.title')}
        description={t('send.preview.description')}
      />
      <p className="mb-3 truncate text-xs text-muted">
        {recipient ? t('send.preview.to', { who: recipient }) : t('send.preview.noRecipient')}
      </p>
      {tenant ? (
        <div className="animate-fade-in" key={`${tenant.id}-${branch?.id ?? ''}-${lang}`}>
          <div className="mb-2 flex items-center gap-2">
            <TenantMark monogram={tenant.monogram} primary={tenant.primary} onPrimary={tenant.onPrimary} size="sm" />
            <span className="font-mono text-sm font-medium text-ink">{tenant.smsSender}</span>
            <span className="ml-auto text-xs text-muted">{t('send.preview.now')}</span>
          </div>
          <BubbleCard tone="tint" padding="md">
            <p lang={lang} className="break-words text-ink">
              {smsBodyFor(lang, tenant, branch, PLACEHOLDER_TOKEN).replace(placeholderLink, '')}
              <span className="font-mono text-link underline decoration-dotted underline-offset-2">{placeholderLink}</span>
            </p>
          </BubbleCard>
          <p className="mt-3 text-xs text-muted">{t('send.preview.tokenNote')}</p>
        </div>
      ) : (
        <BubbleCard tone="sunken" padding="md">
          <p className="text-sm text-muted">{t('send.preview.chooseCampaign')}</p>
        </BubbleCard>
      )}
    </Card>
  )
}
