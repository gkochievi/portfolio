import { useTranslation } from 'react-i18next'

import { Checkbox, Field, Input, Switch } from '@/components/ui'
import { FEATURE_KEYS, type LimitsDraft } from './limits'

/** The shared limits form: enabled, three daily maxima, largest audio file, feature toggles. */
export function LimitsFields({
  draft,
  onChange,
  errors,
  disabled,
  enabledLabel,
  enabledHint,
}: {
  draft: LimitsDraft
  onChange: (next: LimitsDraft) => void
  errors: Record<string, string>
  disabled?: boolean
  enabledLabel?: string
  enabledHint?: string
}) {
  const { t } = useTranslation('consolePlatform')
  const num = (key: 'analyses' | 'tts' | 'conversions' | 'audioMb', label: string, suffix?: string) => (
    <Field label={label} error={errors[key]}>
      <Input
        type="number"
        inputMode="numeric"
        min={0}
        className="tabular"
        value={draft[key]}
        disabled={disabled}
        trailing={suffix ? <span className="text-xs text-muted">{suffix}</span> : undefined}
        onChange={(e) => onChange({ ...draft, [key]: e.target.value })}
      />
    </Field>
  )
  return (
    <div className="space-y-5">
      <Switch
        checked={draft.enabled}
        onCheckedChange={(enabled) => onChange({ ...draft, enabled })}
        disabled={disabled}
        label={enabledLabel ?? t('limits.enabled')}
        description={enabledHint ?? t('limits.enabledHint')}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {num('analyses', t('limits.analyses'), t('limits.perDay'))}
        {num('tts', t('limits.tts'), t('limits.perDay'))}
        {num('conversions', t('limits.conversions'), t('limits.perDay'))}
        {num('audioMb', t('limits.audioMb'))}
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">{t('limits.features')}</legend>
        <div className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURE_KEYS.map((key) => (
            <Checkbox
              key={key}
              checked={draft.features[key]}
              disabled={disabled}
              onCheckedChange={(checked) => onChange({ ...draft, features: { ...draft.features, [key]: checked } })}
              label={t(`limits.feature.${key}`)}
            />
          ))}
        </div>
      </fieldset>
    </div>
  )
}
