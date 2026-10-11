import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, Field, Modal, Textarea, toast } from '@/components/ui'

import { useSuperErrors, useUpdateTenant } from '../api'
import type { TenantRow } from '../types'

/** Edit the origins that may embed the tenant's widget (one per line). */
export function OriginsDialog({ tenant, onOpenChange }: { tenant: TenantRow | null; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation('superadmin')
  const errors = useSuperErrors()
  const update = useUpdateTenant()
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setText(tenant ? tenant.allowedOrigins.join('\n') : '')
    setError(null)
  }, [tenant])

  const save = async () => {
    if (!tenant) return
    setError(null)
    try {
      const rows = await update.mutateAsync({ id: tenant.id, allowedOrigins: text.split(/\r?\n|,/).map((line) => line.trim()).filter(Boolean) })
      toast.success(t('origins.saved', { count: rows.allowedOrigins.length }))
      onOpenChange(false)
    } catch (failure) {
      setError(errors.fields(failure).allowedOrigins ?? errors.text(failure))
    }
  }

  return (
    <Modal
      open={tenant !== null}
      onOpenChange={onOpenChange}
      title={t('origins.title')}
      description={tenant ? t('origins.description', { name: tenant.name.en }) : undefined}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common:actions.cancel')}
          </Button>
          <Button onClick={save} loading={update.isPending}>
            {t('common:actions.save')}
          </Button>
        </>
      }
    >
      <Field label={t('origins.label')} hint={t('origins.hint')} error={error ?? undefined}>
        <Textarea value={text} onChange={(event) => setText(event.target.value)} rows={6} placeholder="https://www.shop.example" invalid={!!error} className="font-mono text-[13px]" spellCheck={false} />
      </Field>
    </Modal>
  )
}
