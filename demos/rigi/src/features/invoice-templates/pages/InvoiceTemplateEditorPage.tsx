import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'

import { Banner, Button, EmptyState, PageSkeleton } from '@/components/ui'
import { isApiError } from '@/lib/api'

import { useTemplate } from '../api'
import { TemplateEditor } from '../components/TemplateEditor'
import { Link } from 'react-router-dom'

/** /accountant/templates/:templateId */
export default function InvoiceTemplateEditorPage() {
  const { t } = useTranslation('invoice-templates')
  const { templateId } = useParams()
  const { data, error, isPending, refetch } = useTemplate(templateId)

  if (isPending) return <PageSkeleton />

  if (error && !data) {
    if (isApiError(error, 404)) {
      return (
        <EmptyState
          title={t('editor.notFound')}
          description={t('editor.notFoundHint')}
          action={
            <Button asChild variant="secondary">
              <Link to="/accountant/templates">{t('editor.backToList')}</Link>
            </Button>
          }
        />
      )
    }
    return (
      <Banner tone="danger" title={t('editor.loadError')} action={<Button size="sm" variant="secondary" onClick={() => void refetch()}>{t('common:actions.retry')}</Button>}>
        {error.message}
      </Banner>
    )
  }

  // Template deleted elsewhere while open.
  if (!data) return null
  return <TemplateEditor key={data.id} template={data} />
}
