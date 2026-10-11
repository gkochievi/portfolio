import { zodResolver } from '@hookform/resolvers/zod'
import { Landmark } from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Banner, Button, Card, CardBody, CardFooter, CardHeader, Field, Input, Skeleton, Textarea, toast } from '@/components/ui'

import { errorMessage, fieldErrorsOf, useBillingDetails, useSaveBilling } from '../api'

const schema = z.object({
  bankName: z.string().trim().min(1, 'validation.required').max(200, 'validation.tooLong'),
  accountHolder: z.string().trim().min(1, 'validation.required').max(200, 'validation.tooLong'),
  iban: z
    .string()
    .transform((v) => v.replace(/\s+/g, '').toUpperCase())
    .pipe(z.string().regex(/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/, 'validation.iban')),
  swift: z
    .string()
    .transform((v) => v.replace(/\s+/g, '').toUpperCase())
    .pipe(z.string().regex(/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/, 'validation.swift')),
  address: z.string().trim().max(500, 'validation.tooLong'),
  notes: z.string().trim().max(2000, 'validation.tooLong'),
})

type FormValues = z.input<typeof schema>

/**
 * Bank details printed on every invoice. Shared by Settings (superadmin) and
 * /accountant/billing (accountant): same data, same endpoint.
 */
export function BillingDetailsForm({ embedded = false }: { embedded?: boolean }) {
  const { t } = useTranslation('ops')
  const query = useBillingDetails()
  const save = useSaveBilling()
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { bankName: '', accountHolder: '', iban: '', swift: '', address: '', notes: '' },
  })

  useEffect(() => {
    if (query.data) reset(query.data)
  }, [query.data, reset])

  const msg = (key?: string) => (key ? t(key) : undefined)

  const onSubmit = handleSubmit(async (values) => {
    try {
      const saved = await save.mutateAsync(schema.parse(values))
      reset(saved)
      toast.success(t('billing.saved'))
    } catch (error) {
      const fields = fieldErrorsOf(error)
      const known = Object.keys(fields).filter((k): k is keyof FormValues => k in schema.shape)
      known.forEach((k) => setError(k, { message: fields[k] }))
      if (!known.length) toast.error(errorMessage(error))
    }
  })

  return (
    <Card>
      <CardHeader
        eyebrow={embedded ? undefined : t('billing.eyebrow')}
        title={t('billing.title')}
        description={t('billing.description')}
      />
      {query.isError ? (
        <CardBody>
          <Banner tone="danger" title={t('common:states.error')} action={<Button size="sm" variant="outline" onClick={() => query.refetch()}>{t('common:actions.retry')}</Button>}>
            {errorMessage(query.error)}
          </Banner>
        </CardBody>
      ) : query.isLoading ? (
        <CardBody className="space-y-3">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardBody>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label={t('billing.fields.bankName')} required htmlFor="bill-bank" error={msg(errors.bankName?.message)}>
              <Input id="bill-bank" icon={<Landmark />} invalid={!!errors.bankName} {...register('bankName')} />
            </Field>
            <Field label={t('billing.fields.accountHolder')} required htmlFor="bill-holder" error={msg(errors.accountHolder?.message)}>
              <Input id="bill-holder" invalid={!!errors.accountHolder} {...register('accountHolder')} />
            </Field>
            <Field label={t('billing.fields.iban')} required htmlFor="bill-iban" hint={t('billing.hints.iban')} error={msg(errors.iban?.message)}>
              <Input id="bill-iban" mono invalid={!!errors.iban} autoComplete="off" {...register('iban')} />
            </Field>
            <Field label={t('billing.fields.swift')} required htmlFor="bill-swift" hint={t('billing.hints.swift')} error={msg(errors.swift?.message)}>
              <Input id="bill-swift" mono invalid={!!errors.swift} autoComplete="off" {...register('swift')} />
            </Field>
            <Field label={t('billing.fields.address')} htmlFor="bill-address" error={msg(errors.address?.message)} className="sm:col-span-2">
              <Input id="bill-address" invalid={!!errors.address} {...register('address')} />
            </Field>
            <Field label={t('billing.fields.notes')} htmlFor="bill-notes" hint={t('billing.hints.notes')} error={msg(errors.notes?.message)} className="sm:col-span-2">
              <Textarea id="bill-notes" rows={3} invalid={!!errors.notes} {...register('notes')} />
            </Field>
          </CardBody>
          <CardFooter>
            <Button variant="ghost" disabled={!isDirty || save.isPending} onClick={() => query.data && reset(query.data)}>
              {t('common:actions.reset')}
            </Button>
            <Button type="submit" loading={save.isPending} disabled={!isDirty}>
              {t('common:actions.save')}
            </Button>
          </CardFooter>
        </form>
      )}
    </Card>
  )
}
