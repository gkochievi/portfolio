import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { fieldErrorsOf } from '@/api/client'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  CopyButton,
  DataTable,
  DateText,
  Dialog,
  Field,
  Input,
  Mono,
  type Column,
} from '@/components/ui'
import type { ApiKeyScope, PartnerApiKey } from '@/types'

import { useCreateApiKey, usePartnerApiKeys, type ApiKeyCreated } from '../api'
import { apiKeySchema, type ApiKeyInput } from '../lib/schema'

export function KeysTab({ partnerId }: { partnerId: string }) {
  const { t } = useTranslation('partners')
  const keys = usePartnerApiKeys(partnerId)
  const create = useCreateApiKey(partnerId)
  const [created, setCreated] = useState<ApiKeyCreated | null>(null)
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<ApiKeyInput>({ resolver: zodResolver(apiKeySchema), defaultValues: { label: '', scopes: ['user_count:write'] } })
  const msg = (m?: string) => (m ? t(m) : undefined)

  const onSubmit = handleSubmit(async (values) => {
    try {
      setCreated(await create.mutateAsync(values))
      reset({ label: '', scopes: ['user_count:write'] })
    } catch (error) {
      const fields = fieldErrorsOf(error)
      const names = Object.keys(fields)
      if (names.length === 0) toast.error(error instanceof Error ? error.message : t('errors.generic'))
      for (const name of names) setError(name as keyof ApiKeyInput, { message: fields[name] })
    }
  })

  const scopeLabel: Record<ApiKeyScope, string> = { 'user_count:write': t('keys.scopeWrite'), 'user_count:read': t('keys.scopeRead') }

  const columns: Column<PartnerApiKey>[] = [
    { key: 'keyId', header: t('keys.columns.keyId'), cell: (k) => <Mono>{k.keyId}</Mono> },
    { key: 'label', header: t('keys.columns.label'), sortable: true, sortValue: (k) => k.label.toLowerCase(), cell: (k) => <span className="font-medium">{k.label}</span> },
    {
      key: 'scopes',
      header: t('keys.columns.scopes'),
      hideBelow: 'md',
      cell: (k) => (
        <span className="flex flex-wrap gap-1">
          {k.scopes.map((s) => (
            <Mono key={s}>{s}</Mono>
          ))}
        </span>
      ),
    },
    { key: 'created', header: t('keys.columns.created'), sortable: true, sortValue: (k) => k.createdAt, hideBelow: 'lg', cell: (k) => <DateText value={k.createdAt} /> },
    {
      key: 'lastUsed',
      header: t('keys.columns.lastUsed'),
      sortable: true,
      sortValue: (k) => k.lastUsedAt ?? '',
      hideBelow: 'sm',
      cell: (k) => (k.lastUsedAt ? <DateText value={k.lastUsedAt} withTime relative /> : <span className="text-subtle">{t('keys.never')}</span>),
    },
    {
      key: 'status',
      header: t('keys.columns.status'),
      cell: (k) => (k.revokedAt ? <Badge tone="danger">{t('keys.revoked')}</Badge> : <Badge tone="success">{t('keys.live')}</Badge>),
    },
  ]

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title={t('keys.title')} description={t('keys.description')} />
        <CardBody>
          <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
            <div className="space-y-4">
              <Field label={t('keys.label')} required htmlFor="k-label" error={msg(errors.label?.message)}>
                <Input id="k-label" autoComplete="off" placeholder={t('keys.labelPlaceholder')} invalid={Boolean(errors.label)} {...register('label')} />
              </Field>
              <Field label={t('keys.scopes')} error={msg(errors.scopes?.message)}>
                <Controller
                  control={control}
                  name="scopes"
                  render={({ field }) => (
                    <div className="flex flex-wrap gap-x-6 gap-y-2">
                      {(['user_count:write', 'user_count:read'] as const).map((scope) => (
                        <Checkbox
                          key={scope}
                          label={
                            <span className="flex flex-col">
                              <Mono chip={false}>{scope}</Mono>
                              <span className="text-xs text-muted">{scopeLabel[scope]}</span>
                            </span>
                          }
                          checked={field.value.includes(scope)}
                          onChange={(e) => field.onChange(e.target.checked ? [...field.value, scope] : field.value.filter((s) => s !== scope))}
                        />
                      ))}
                    </div>
                  )}
                />
              </Field>
            </div>
            <Button type="submit" loading={create.isPending} className="sm:mt-6">
              {t('keys.generate')}
            </Button>
          </form>
        </CardBody>
      </Card>

      <section>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="font-display text-base font-semibold">{t('keys.listTitle')}</h3>
          <Button asChild size="sm" variant="ghost">
            <Link to="/admin/api-keys">{t('keys.manageAll')}</Link>
          </Button>
        </div>
        <DataTable
          columns={columns}
          rows={keys.data}
          getRowId={(k) => k.id}
          loading={keys.isLoading}
          error={keys.error}
          onRetry={() => keys.refetch()}
          pageSize={0}
          initialSort={{ key: 'created', dir: 'desc' }}
          empty={{ title: t('keys.empty'), description: t('keys.emptyDescription') }}
        />
      </section>

      <Dialog
        open={Boolean(created)}
        onOpenChange={(open) => !open && setCreated(null)}
        title={t('keys.revealTitle')}
        description={t('keys.revealDescription')}
        dismissible={false}
        footer={<Button onClick={() => setCreated(null)}>{t('keys.done')}</Button>}
      >
        {created ? (
          <div className="space-y-4">
            <div>
              <p className="eyebrow mb-1">{t('keys.keyId')}</p>
              <div className="flex items-center gap-2 rounded-md border border-hairline bg-sunken px-3 py-2">
                <code className="min-w-0 flex-1 break-all font-mono text-[13px]">{created.key.keyId}</code>
                <CopyButton value={created.key.keyId} />
              </div>
            </div>
            <div>
              <p className="eyebrow mb-1">{t('keys.secret')}</p>
              <div className="flex items-center gap-2 rounded-md border border-hairline bg-sunken px-3 py-2">
                <code className="min-w-0 flex-1 break-all font-mono text-[13px]">{created.secret}</code>
                <CopyButton value={created.secret} />
              </div>
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  )
}
