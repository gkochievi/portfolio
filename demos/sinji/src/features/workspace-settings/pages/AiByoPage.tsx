import { useTranslation } from 'react-i18next'

import { Button, Callout, ReadOnlyNote, Skeleton } from '@/components/ui'
import { useCanEdit } from '@/lib/session'
import { useAiSettings } from '../api'
import AiCapabilityCard from '../components/AiCapabilityCard'

/** Own AI keys (bring your own provider key per capability). OWNED BY: workspace-settings. */
export default function AiByoPage() {
  const { t } = useTranslation('settings')
  const canEdit = useCanEdit()
  const query = useAiSettings()

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }
  if (query.isError || !query.data) {
    return (
      <Callout tone="danger" action={<Button size="sm" onClick={() => void query.refetch()}>{t('retry')}</Button>}>
        {t('loadError')}
      </Callout>
    )
  }
  const { providers, capabilities } = query.data
  return (
    <div className="space-y-5">
      <p className="max-w-3xl text-sm text-muted">{t('ai.intro')}</p>
      {canEdit ? null : <ReadOnlyNote />}
      {capabilities.map((view) => (
        <AiCapabilityCard key={`${view.capability}:${view.override?.updated_at ?? 'none'}`} view={view} providers={providers} canEdit={canEdit} />
      ))}
    </div>
  )
}
