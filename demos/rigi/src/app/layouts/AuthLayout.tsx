/** Frame for the sign-in screens: language + theme in the corner. Owner: shell. */
import { Outlet } from 'react-router-dom'

import { LanguageToggle, ThemeToggle } from '@/components/layout/chrome'

export function AuthLayout() {
  return (
    <div className="relative min-h-dvh bg-surface">
      <div className="absolute right-4 top-3 z-10 flex items-center gap-2 sm:right-6">
        <LanguageToggle />
        <ThemeToggle />
      </div>
      <Outlet />
    </div>
  )
}
