import { Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { toggleTheme, useResolvedTheme } from '@/styles/theme'
import { IconButton } from './IconButton'

/** Sun/moon toggle (follows the OS until clicked; in memory only). */
export function ThemeToggle({ className }: { className?: string }) {
  const { t } = useTranslation()
  const theme = useResolvedTheme()
  return (
    <IconButton
      className={className}
      variant="muted"
      size="md"
      label={theme === 'dark' ? t('theme.toLight') : t('theme.toDark')}
      icon={theme === 'dark' ? <Sun strokeWidth={1.75} /> : <Moon strokeWidth={1.75} />}
      onClick={toggleTheme}
    />
  )
}
