import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { PageHeader, toast } from '@/components/ui'

import { useCreateStaffUser } from '../api'
import { StaffUserForm } from '../components/StaffUserForm'

export default function StaffUserCreatePage() {
  const { t } = useTranslation(['admin-catalog', 'common'])
  const navigate = useNavigate()
  const create = useCreateStaffUser()

  return (
    <div>
      <PageHeader eyebrow={t('users.eyebrow')} title={t('userForm.newTitle')} back={{ to: '/admin/users', label: t('users.title') }} />
      <div className="max-w-2xl">
        <StaffUserForm
          title={t('userForm.newTitle')}
          description={t('userForm.newDescription')}
          submitLabel={t('userForm.create')}
          onCancel={() => navigate('/admin/users')}
          onSubmit={async (values) => {
            await create.mutateAsync(values)
            toast.success(t('userForm.created'))
            navigate('/admin/users', { replace: true })
          }}
        />
      </div>
    </div>
  )
}
