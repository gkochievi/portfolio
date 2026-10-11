import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Button, ErrorState, Field, LocalizedTextField, Modal, Skeleton, toast } from '@/components/ui'
import { pickText } from '@/lib/format'
import type { ThemePreset } from '@/types'

import { useSettings, useUpdateSettings } from '../api'
import { cleanText, localizedSchema, locError, PanelSection, textValue, ThemePicker, useSettingsErrors } from '../shared'

const FORM_ID = 'identity-form'
const THEMES = ['canary', 'olive', 'clay', 'plum', 'moss', 'slate', 'night', 'paper'] as const

interface FormValues {
  chatTitle: { ka: string; en: string; ru?: string }
  clientTheme: ThemePreset
  operatorTheme: ThemePreset
  adminTheme: ThemePreset
}

export function IdentityPanel({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation('adminSettings')
  const tc = useTranslation().t
  const query = useSettings()
  const update = useUpdateSettings()
  const errors = useSettingsErrors()
  const lang = i18n.language.startsWith('ka') ? 'ka' : 'en'

  const schema = useMemo(
    () =>
      z.object({
        chatTitle: localizedSchema(t, ['ka', 'en'], 80),
        clientTheme: z.enum(THEMES),
        operatorTheme: z.enum(THEMES),
        adminTheme: z.enum(THEMES),
      }),
    [t],
  )
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { chatTitle: { ka: '', en: '' }, clientTheme: 'canary', operatorTheme: 'canary', adminTheme: 'canary' },
  })
  const { control, handleSubmit, reset, watch, formState } = form

  const [loaded, setLoaded] = useState(false)
  const settings = query.data
  useEffect(() => {
    if (!settings || loaded) return
    reset({ chatTitle: textValue(settings.chatTitle), clientTheme: settings.clientTheme, operatorTheme: settings.operatorTheme, adminTheme: settings.adminTheme })
    setLoaded(true)
  }, [settings, loaded, reset])

  const title = watch('chatTitle')

  const submit = handleSubmit(async (values) => {
    try {
      await update.mutateAsync({ chatTitle: cleanText(values.chatTitle), clientTheme: values.clientTheme, operatorTheme: values.operatorTheme, adminTheme: values.adminTheme })
      toast.success(t('identity.saved'))
      onClose()
    } catch (error) {
      toast.error(errors.text(error))
    }
  })

  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      size="xl"
      title={t('identity.title')}
      description={t('identity.description')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc('actions.cancel')}
          </Button>
          <Button type="submit" form={FORM_ID} loading={update.isPending} disabled={!loaded}>
            {tc('actions.save')}
          </Button>
        </>
      }
    >
      {query.isError ? (
        <ErrorState title={t('identity.loadError')} onRetry={() => void query.refetch()} retryLabel={tc('actions.retry')} />
      ) : !loaded ? (
        <div className="flex flex-col gap-3" aria-busy>
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (
        <form id={FORM_ID} onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-6">
          <Field label={t('identity.chatTitle')} hint={t('identity.chatTitleHint')} error={locError(formState.errors.chatTitle)} required>
            <Controller
              control={control}
              name="chatTitle"
              render={({ field }) => <LocalizedTextField maxLength={80} value={field.value} onChange={field.onChange} invalid={!!formState.errors.chatTitle} />}
            />
          </Field>

          <PanelSection title={t('identity.themes')} description={t('identity.themesHint')}>
            <Controller
              control={control}
              name="clientTheme"
              render={({ field }) => (
                <ThemePicker kind="client" label={t('identity.client')} description={t('identity.clientHint')} value={field.value} onChange={field.onChange} previewTitle={pickText(title, lang)} />
              )}
            />
            <Controller
              control={control}
              name="operatorTheme"
              render={({ field }) => <ThemePicker kind="operator" label={t('identity.operator')} description={t('identity.operatorHint')} value={field.value} onChange={field.onChange} />}
            />
            <Controller
              control={control}
              name="adminTheme"
              render={({ field }) => <ThemePicker kind="admin" label={t('identity.admin')} description={t('identity.adminHint')} value={field.value} onChange={field.onChange} />}
            />
          </PanelSection>
        </form>
      )}
    </Modal>
  )
}
