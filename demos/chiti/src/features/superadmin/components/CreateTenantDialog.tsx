import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, UserPlus } from 'lucide-react'

import { Button, Field, Input, Modal } from '@/components/ui'

import { useCreateTenant, useSuperErrors } from '../api'
import type { TenantRow } from '../types'
import { CopyButton } from './shared'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The follow-up offer: "create the first admin". */
  onCreateAdmin: (tenant: TenantRow) => void
}

/** Name -> tenant with an auto slug (name + random code), then offers the first admin. */
export function CreateTenantDialog({ open, onOpenChange, onCreateAdmin }: Props) {
  const { t } = useTranslation('superadmin')
  const errors = useSuperErrors()
  const create = useCreateTenant()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<TenantRow | null>(null)

  useEffect(() => {
    if (open) {
      setName('')
      setError(null)
      setCreated(null)
      create.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (name.trim().length < 2) return setError(t('errors.field.name_short'))
    setError(null)
    try {
      setCreated(await create.mutateAsync(name.trim()))
    } catch (failure) {
      setError(errors.fields(failure).name ?? errors.text(failure))
    }
  }

  if (created) {
    return (
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title={t('createTenant.doneTitle')}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t('createTenant.later')}
            </Button>
            <Button
              leftIcon={<UserPlus />}
              onClick={() => {
                onOpenChange(false)
                onCreateAdmin(created)
              }}
            >
              {t('createTenant.createAdmin')}
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-success-soft text-success">
            <Check size={16} strokeWidth={2} />
          </span>
          <div className="min-w-0 text-[14px]">
            <p className="text-ink">{t('createTenant.doneBody', { name: created.name.en })}</p>
            <p className="mt-2 flex items-center gap-1 text-muted">
              {t('table.slug')}: <code className="rounded-ui bg-sunken px-1.5 py-0.5 font-mono text-[12px] text-ink">{created.slug}</code>
              <CopyButton value={created.slug} />
            </p>
            <p className="mt-3 text-muted">{t('createTenant.offer')}</p>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('createTenant.title')}
      description={t('createTenant.description')}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common:actions.cancel')}
          </Button>
          <Button type="submit" form="create-tenant-form" loading={create.isPending}>
            {t('common:actions.create')}
          </Button>
        </>
      }
    >
      <form id="create-tenant-form" onSubmit={submit} noValidate>
        <Field label={t('createTenant.name')} hint={t('createTenant.nameHint')} error={error ?? undefined} required>
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={t('createTenant.namePlaceholder')} autoFocus invalid={!!error} maxLength={60} />
        </Field>
      </form>
    </Modal>
  )
}
