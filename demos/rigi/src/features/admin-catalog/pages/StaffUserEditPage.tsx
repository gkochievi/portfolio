import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Button, EmptyState, PageHeader, PageSkeleton, toast } from '@/components/ui'
import { localName } from '@/lib/format'
import { useStaffMe } from '@/lib/session'

import { useStaffUser, useUpdateStaffUser } from '../api'
import { StaffUserForm } from '../components/StaffUserForm'

export default function StaffUserEditPage() {
  const { t } = useTranslation(['admin-catalog', 'common'])
  const { userId } = useParams()
  const navigate = useNavigate()
  const me = useStaffMe()
  const { data: user, error, isLoading } = useStaffUser(userId)
  const update = useUpdateStaffUser(userId ?? '')

  if (isLoading) return <PageSkeleton />
  if (error || !user) {
    return (
      <div>
        <PageHeader eyebrow={t('users.eyebrow')} title={t('userForm.notFound')} back={{ to: '/admin/users', label: t('users.title') }} />
        <EmptyState
          title={t('userForm.notFound')}
          action={
            <Button variant="secondary" asChild>
              <Link to="/admin/users">{t('users.title')}</Link>
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        eyebrow={t('users.eyebrow')}
        title={t('userForm.editTitle', { name: localName(user) })}
        back={{ to: '/admin/users', label: t('users.title') }}
      />
      <div className="max-w-2xl">
        <StaffUserForm
          key={`${user.id}:${user.role}:${user.isActive}`}
          user={user}
          isSelf={me?.id === user.id}
          title={localName(user)}
          description={t('userForm.editDescription')}
          submitLabel={t('common:actions.save')}
          onCancel={() => navigate('/admin/users')}
          onSubmit={async (values) => {
            await update.mutateAsync(values)
            toast.success(t('userForm.saved'))
            navigate('/admin/users')
          }}
        />
      </div>
    </div>
  )
}
