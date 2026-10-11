import { useTranslation } from 'react-i18next'

import { Banner, Field, SegmentedControl } from '@/components/ui'

/** Direct / Group access mode of a directory user; Group warns that roles follow the mapping. */
export function AccessModeField({ value, onChange }: { value: 'direct' | 'group'; onChange: (v: 'direct' | 'group') => void }) {
  const { t } = useTranslation('people')
  return (
    <div className="space-y-2">
      <Field label={t('access.label')} hint={value === 'group' ? t('access.groupHint') : t('access.directHint')}>
        <SegmentedControl<'direct' | 'group'>
          aria-label={t('access.label')}
          value={value}
          onChange={onChange}
          options={[
            { value: 'direct', label: t('access.direct') },
            { value: 'group', label: t('access.group') },
          ]}
        />
      </Field>
      {value === 'group' && (
        <Banner tone="warning" title={t('access.warningTitle')}>
          {t('access.warning')}
        </Banner>
      )}
    </div>
  )
}
