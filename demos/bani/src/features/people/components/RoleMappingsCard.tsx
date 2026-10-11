import { zodResolver } from '@hookform/resolvers/zod'
import { Check, Plus, Trash2, Users } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  ErrorState,
  Field,
  IconButton,
  Input,
  Select,
  Skeleton,
  toast,
} from '@/components/ui'
import { fieldErrors, messageOf } from '@/api/client'
import { ROLE_IDS } from '@/lib/rbac'
import type { LdapRoleMappingConfig, RoleId } from '@/types'
import { useRoleMappings, useSaveRoleMappings } from '../api'

function useSchema() {
  const { t } = useTranslation('people')
  return useMemo(
    () =>
      z
        .object({
          mappings: z.array(z.object({ groupDn: z.string().trim(), role: z.string().min(1, t('validation.role')) })),
          nestedGroups: z.boolean(),
        })
        .superRefine((v, ctx) => {
          const seen = new Set<string>()
          v.mappings.forEach((row, i) => {
            const path = ['mappings', i, 'groupDn']
            const dn = row.groupDn.toLowerCase()
            if (!row.groupDn) ctx.addIssue({ code: 'custom', path, message: t('validation.groupDn') })
            else if (!row.groupDn.includes('=')) ctx.addIssue({ code: 'custom', path, message: t('validation.groupDnFormat') })
            else if (seen.has(dn)) ctx.addIssue({ code: 'custom', path, message: t('validation.groupDuplicate') })
            seen.add(dn)
          })
        }),
    [t],
  )
}

type FormValues = z.infer<ReturnType<typeof useSchema>>

const toForm = (c: LdapRoleMappingConfig): FormValues => ({ mappings: c.mappings.map((m) => ({ ...m })), nestedGroups: c.nestedGroups })

/** Directory group -> role rows, "Resolve nested groups" and Save. */
export function RoleMappingsCard({ groupUserCount }: { groupUserCount: number }) {
  const { t } = useTranslation(['people', 'common'])
  const query = useRoleMappings()
  const save = useSaveRoleMappings()
  const schema = useSchema()
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { mappings: [], nestedGroups: false } })
  const { control, register, handleSubmit, reset, setError, formState } = form
  const { fields, append, remove } = useFieldArray({ control, name: 'mappings' })
  const { errors, isDirty } = formState

  // Take over server data, but never clobber an unsaved draft on a background refetch.
  const data = query.data
  useEffect(() => {
    if (data && !isDirty) reset(toForm(data))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  const roleOptions = ROLE_IDS.map((r) => ({ value: r, label: t(`common:roles.${r}`) }))

  const submit = handleSubmit(async (v) => {
    try {
      const saved = await save.mutateAsync({
        mappings: v.mappings.map((m) => ({ groupDn: m.groupDn, role: m.role as RoleId })),
        nestedGroups: v.nestedGroups,
      })
      reset(toForm(saved))
      toast.success(t('toast.mappingsSaved'))
    } catch (e) {
      const server = fieldErrors(e)
      const keys = Object.keys(server)
      if (keys.length === 0) toast.error(messageOf(e))
      for (const key of keys) setError(key as never, { type: 'server', message: server[key] })
    }
  })

  return (
    <Card>
      <CardHeader
        icon={Users}
        title={t('mappings.title')}
        subtitle={t('mappings.subtitle')}
        actions={
          <Button
            variant="primary"
            icon={save.isSuccess && !isDirty ? Check : undefined}
            type="submit"
            form="role-mappings-form"
            loading={save.isPending}
            disabled={!isDirty || !data}
          >
            {t('mappings.save')}
          </Button>
        }
      />
      <CardBody>
        {query.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : query.isError ? (
          <ErrorState error={t('mappings.loadError')} onRetry={() => void query.refetch()} />
        ) : (
          <form id="role-mappings-form" onSubmit={submit} noValidate className="space-y-4">
            {fields.length === 0 ? (
              <p className="rounded-[8px] border border-dashed border-line-strong p-4 text-sm text-muted">{t('mappings.empty')}</p>
            ) : (
              <ul className="space-y-3">
                {fields.map((field, i) => (
                  <li key={field.id} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_220px_auto] sm:items-start">
                    <Field
                      label={i === 0 ? t('mappings.group') : undefined}
                      htmlFor={`rm-dn-${i}`}
                      error={errors.mappings?.[i]?.groupDn?.message}
                    >
                      <Input
                        id={`rm-dn-${i}`}
                        mono
                        aria-label={t('mappings.group')}
                        placeholder={t('mappings.groupPlaceholder')}
                        invalid={!!errors.mappings?.[i]?.groupDn}
                        {...register(`mappings.${i}.groupDn` as const)}
                      />
                    </Field>
                    <Field label={i === 0 ? t('mappings.role') : undefined} htmlFor={`rm-role-${i}`} error={errors.mappings?.[i]?.role?.message}>
                      <Controller
                        control={control}
                        name={`mappings.${i}.role` as const}
                        render={({ field: f }) => (
                          <Select<string>
                            id={`rm-role-${i}`}
                            aria-label={t('mappings.role')}
                            value={f.value}
                            onValueChange={f.onChange}
                            options={roleOptions}
                            invalid={!!errors.mappings?.[i]?.role}
                          />
                        )}
                      />
                    </Field>
                    <div className={i === 0 ? 'sm:pt-[22px]' : ''}>
                      <IconButton label={t('mappings.remove')} icon={Trash2} variant="ghost" onClick={() => remove(i)} />
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button icon={Plus} size="sm" onClick={() => append({ groupDn: '', role: 'cc-operator' })}>
                {t('mappings.add')}
              </Button>
              <p className="text-xs text-muted">{t('mappings.groupUsers', { count: groupUserCount })}</p>
            </div>

            <div className="border-t border-line pt-4">
              <Controller
                control={control}
                name="nestedGroups"
                render={({ field }) => <Checkbox checked={field.value} onCheckedChange={field.onChange} label={t('mappings.nested')} />}
              />
              <p className="ml-6 mt-1 text-xs text-muted">{t('mappings.nestedHint')}</p>
            </div>
          </form>
        )}
      </CardBody>
    </Card>
  )
}
