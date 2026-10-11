import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, Dialog, Field, Input, toast } from '@/components/ui'
import type { AppUser, LimitsConfig } from '@/types'
import { useErrorText, useUserMutations } from '../api'
import { parseWhole } from './limits'

const FIELDS = [
  { key: 'analyses', label: 'limits.analyses', min: 0, max: 10_000, error: 'range_0_10000', def: (l: LimitsConfig) => l.max_analyses_per_day },
  { key: 'tts', label: 'limits.tts', min: 0, max: 10_000, error: 'range_0_10000', def: (l: LimitsConfig) => l.max_tts_per_day },
  { key: 'conversions', label: 'limits.conversions', min: 0, max: 10_000, error: 'range_0_10000', def: (l: LimitsConfig) => l.max_conversions_per_day },
  { key: 'max_audio_mb', label: 'limits.audioMb', min: 1, max: 500, error: 'range_1_500', def: (l: LimitsConfig) => l.max_audio_mb },
] as const

type Key = (typeof FIELDS)[number]['key']

/** Per-user limit overrides. An empty field follows the registered-tier default. Mount only while open. */
export function UserLimitsDialog({ user, defaults, onClose }: { user: AppUser; defaults: LimitsConfig; onClose: () => void }) {
  const { t } = useTranslation('consolePlatform')
  const errorText = useErrorText()
  const { update } = useUserMutations()
  const [draft, setDraft] = useState<Record<Key, string>>(() =>
    Object.fromEntries(FIELDS.map((f) => [f.key, user.limits[f.key] != null ? String(user.limits[f.key]) : ''])) as Record<Key, string>,
  )
  const [errors, setErrors] = useState<Record<string, string>>({})

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const found: Record<string, string> = {}
    const limits: Record<string, number | null> = {}
    for (const f of FIELDS) {
      const raw = draft[f.key].trim()
      if (!raw) {
        limits[f.key] = null
        continue
      }
      const n = parseWhole(raw, f.min, f.max)
      if (n === null) found[f.key] = t(`errors.${f.error}`)
      else limits[f.key] = n
    }
    if (Object.keys(found).length) {
      setErrors(found)
      return
    }
    try {
      await update.mutateAsync({ id: user.id, limits })
      toast.success(t('users.toast.limits'))
      onClose()
    } catch (e) {
      const fields = errorText.fields(e)
      setErrors(Object.keys(fields).length ? fields : { form: errorText.text(e) })
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      size="md"
      title={t('users.limitsDialog.title', { name: user.display_name || user.email })}
      description={t('users.limitsDialog.description')}
      footer={
        <>
          <Button type="button" variant="ghost" className="mr-auto" onClick={() => setDraft({ analyses: '', tts: '', conversions: '', max_audio_mb: '' })}>
            {t('users.limitsDialog.clearAll')}
          </Button>
          <Button type="button" onClick={onClose}>
            {t('actions.cancel')}
          </Button>
          <Button type="submit" form="user-limits-form" variant="primary" loading={update.isPending}>
            {t('users.limitsDialog.save')}
          </Button>
        </>
      }
    >
      <form noValidate id="user-limits-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <Field key={f.key} label={t(f.label)} error={errors[f.key]}>
            <Input
              type="number"
              inputMode="numeric"
              min={f.min}
              className="tabular"
              value={draft[f.key]}
              placeholder={t('users.limitsDialog.placeholder', { value: f.def(defaults) })}
              onChange={(e) => {
                setDraft({ ...draft, [f.key]: e.target.value })
                setErrors({})
              }}
            />
          </Field>
        ))}
        {errors.form ? (
          <p role="alert" className="text-sm text-danger sm:col-span-2">
            {errors.form}
          </p>
        ) : null}
      </form>
    </Dialog>
  )
}
