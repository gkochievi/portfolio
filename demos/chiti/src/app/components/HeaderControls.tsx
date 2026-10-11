import type { ReactNode } from 'react'

import type { Operator } from '@/types'
import { LanguageSwitch, ThemeToggle } from '@/components/ui'
import { UserMenu } from './UserMenu'

/** Right side of every console header: language, theme, account. */
export function HeaderControls({ operator, children }: { operator?: Operator | null; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {children}
      <LanguageSwitch className="hidden sm:inline-flex" />
      <ThemeToggle />
      <UserMenu operator={operator} />
    </div>
  )
}

/** Compact controls for the mobile drawer footer. */
export function MobilePrefs() {
  return (
    <div className="flex items-center justify-between gap-2">
      <LanguageSwitch />
      <ThemeToggle />
    </div>
  )
}
