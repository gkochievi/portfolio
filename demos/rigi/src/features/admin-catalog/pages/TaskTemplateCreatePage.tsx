import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { PageHeader, toast } from '@/components/ui'

import { useCreateTemplate, useTaskTemplates } from '../api'
import { TemplateForm } from '../components/TemplateForm'

export default function TaskTemplateCreatePage() {
  const { t } = useTranslation(['admin-catalog', 'common'])
  const navigate = useNavigate()
  const create = useCreateTemplate()
  const { data: existing } = useTaskTemplates(true)

  return (
    <div>
      <PageHeader
        eyebrow={t('templates.eyebrow')}
        title={t('templateForm.newTitle')}
        back={{ to: '/admin/task-templates', label: t('templates.title') }}
      />
      <div className="max-w-2xl">
        <TemplateForm
          title={t('templateForm.newTitle')}
          description={t('templateForm.newDescription')}
          submitLabel={t('templateForm.create')}
          takenCodes={existing?.map((r) => r.code)}
          onCancel={() => navigate('/admin/task-templates')}
          onSubmit={async (values) => {
            const created = await create.mutateAsync(values)
            toast.success(t('templateForm.created'))
            navigate(`/admin/task-templates/${created.id}`, { replace: true })
          }}
        />
      </div>
    </div>
  )
}
