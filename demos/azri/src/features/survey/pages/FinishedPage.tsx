/**
 * Thank you (/finished, ?t=<tenantId>, ?state=already, ?r=<responseId>).
 * Bars grow and a mint spark pops; the tenant comes from ?t via useMeta.
 * Owner: feature group survey.
 */
import { ArrowUpRight, Inbox } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'

import { useRespondentTenant } from '@/components/layout/RespondentLayout'
import { BubbleCard, Button } from '@/components/ui'
import { useTenantFromParam } from '../api'
import { EndScreen } from '../components/EndScreen'

export default function FinishedPage() {
  const { t } = useTranslation('survey')
  const [params] = useSearchParams()
  const already = params.get('state') === 'already'
  const responseId = params.get('r')
  const { tenant } = useTenantFromParam()
  useRespondentTenant(tenant)

  const consoleTo = responseId ? `/console/responses?open=${encodeURIComponent(responseId)}` : '/console/responses'

  return (
    <EndScreen
      illustration={already ? 'already' : 'thanks'}
      animated
      eyebrow={tenant?.name}
      title={already ? t('finished.alreadyTitle') : t('finished.title')}
      description={
        already
          ? t('finished.alreadyDescription')
          : tenant
            ? t('finished.descriptionTenant', { tenant: tenant.name })
            : t('finished.description')
      }
    >
      <BubbleCard tone="sunken" padding="sm" className="text-left">
        <p className="px-1 text-xs font-semibold text-muted">{t('demo.label')}</p>
        <div className="mt-2.5 flex flex-col gap-2">
          <Button asChild variant="brand" size="lg" fullWidth leftIcon={<Inbox strokeWidth={1.75} />}>
            <Link to="/">{t('demo.backToInbox')}</Link>
          </Button>
          {!already && (
            <Button asChild variant="secondary" size="lg" fullWidth rightIcon={<ArrowUpRight strokeWidth={1.75} />}>
              <Link to={consoleTo}>{t('demo.seeInConsole')}</Link>
            </Button>
          )}
        </div>
        <p className="mt-2.5 px-1 text-xs text-muted">{already ? t('demo.alreadyHint') : t('demo.consoleHint')}</p>
      </BubbleCard>
    </EndScreen>
  )
}
