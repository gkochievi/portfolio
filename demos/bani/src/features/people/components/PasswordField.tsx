import { Eye, EyeOff, KeyRound } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, CopyButton, IconButton, Input } from '@/components/ui'
import { generatePassword } from '../password'

/** Password input with Generate (reveals the value), show/hide and Copy. */
export function PasswordField({
  id,
  value,
  onChange,
  invalid,
  placeholder,
  onGenerated,
}: {
  id?: string
  value: string
  onChange: (v: string) => void
  invalid?: boolean
  placeholder?: string
  /** Called with true after Generate, false once the user types their own. */
  onGenerated?: (generated: boolean) => void
}) {
  const { t } = useTranslation('people')
  const [shown, setShown] = useState(false)
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="min-w-[200px] flex-1">
        <Input
          id={id}
          mono
          autoComplete="new-password"
          type={shown ? 'text' : 'password'}
          value={value}
          invalid={invalid}
          placeholder={placeholder}
          onChange={(e) => {
            onChange(e.target.value)
            onGenerated?.(false)
          }}
        />
      </div>
      <IconButton
        label={shown ? t('field.hide') : t('field.show')}
        icon={shown ? EyeOff : Eye}
        variant="secondary"
        onClick={() => setShown((s) => !s)}
      />
      {value && <CopyButton value={value} />}
      <Button
        icon={KeyRound}
        onClick={() => {
          onChange(generatePassword())
          setShown(true)
          onGenerated?.(true)
        }}
      >
        {t('field.generate')}
      </Button>
    </div>
  )
}
