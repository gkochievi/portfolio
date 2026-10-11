/**
 * Header controls: LangSwitch ("ENG / ქარ"), ThemeToggle, CopyButton.
 * Owner: design-system agent.
 */
import { Check, Copy, Moon, Sun } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { asLang, cn } from '@/lib/utils'
import type { Lang } from '@/types'
import { Button, IconButton } from './Button'
import { SegmentedControl } from './Tabs'
import { useTheme } from './theme'

/** ENG / ქარ segmented pill. Switches i18next (and <html lang>). */
export function LangSwitch({ size = 'sm', className }: { size?: 'sm' | 'md'; className?: string }) {
  const { t, i18n } = useTranslation('common')
  const lang = asLang(i18n.language)
  return (
    <SegmentedControl<Lang>
      label={t('language.label')}
      size={size}
      value={lang}
      onChange={(next) => void i18n.changeLanguage(next)}
      className={className}
      options={[
        { value: 'en', label: <span lang="en">{t('language.en')}</span> },
        { value: 'ka', label: <span lang="ka">{t('language.ka')}</span> },
      ]}
    />
  )
}

/** Sun/moon icon button. Follows the OS until clicked (in memory only). */
export function ThemeToggle({ size = 'md', className }: { size?: 'sm' | 'md'; className?: string }) {
  const { t } = useTranslation('common')
  const { theme, toggle } = useTheme()
  const dark = theme === 'dark'
  return (
    <IconButton
      size={size}
      className={className}
      label={dark ? t('theme.toLight') : t('theme.toDark')}
      icon={dark ? <Sun strokeWidth={1.75} /> : <Moon strokeWidth={1.75} />}
      onClick={toggle}
    />
  )
}

async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through (iframes without clipboard permission)
  }
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  } catch {
    return false
  }
}

export interface CopyButtonProps {
  value: string
  /** Visible text; icon-only when omitted. */
  label?: string
  size?: 'sm' | 'md'
  variant?: 'ghost' | 'secondary'
  className?: string
}

/** Copies `value`; shows a check for 1.5 s. */
export function CopyButton({ value, label, size = 'sm', variant = 'ghost', className }: CopyButtonProps) {
  const { t } = useTranslation('common')
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const copy = async () => {
    if (await writeClipboard(value)) {
      setCopied(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), 1500)
    }
  }
  const icon = copied ? <Check strokeWidth={2} className="text-success" /> : <Copy strokeWidth={1.75} />
  if (!label) {
    return <IconButton size={size} variant={variant} label={copied ? t('actions.copied') : t('actions.copy')} icon={icon} onClick={copy} className={className} />
  }
  return (
    <Button size={size === 'md' ? 'md' : 'sm'} variant={variant} leftIcon={icon} onClick={copy} className={cn(className)}>
      {copied ? t('actions.copied') : label}
    </Button>
  )
}
