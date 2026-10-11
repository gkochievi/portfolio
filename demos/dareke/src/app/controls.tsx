/** Shared shell controls: language + theme toggles, sign-out, my display name. */
import { useQuery } from '@tanstack/react-query'
import { useSession } from '@portfolio/demo-kit'
import { Moon, Sun } from 'lucide-react'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { IconButton } from '@/components/ui'
import { session } from '@/demo/store'
import { get } from '@/lib/api'
import { cn } from '@/lib/cn'
import { pickText, useLang } from '@/lib/localized'
import { queryClient } from '@/lib/queryClient'
import type { User } from '@/types'
import { toggleTheme, useTheme } from './theme'

/** EN / ქარ segmented toggle. */
export function LanguageToggle({ className, tone = 'default' }: { className?: string; tone?: 'default' | 'onDark' }) {
  const { t, i18n } = useTranslation()
  const lang = useLang()
  return (
    <div
      role="radiogroup"
      aria-label={t('language.label')}
      className={cn(
        'inline-flex h-8 items-center rounded-control border p-0.5 text-xs font-semibold',
        tone === 'onDark' ? 'border-white/15' : 'border-hairline bg-sunken',
        className,
      )}
    >
      {(['en', 'ka'] as const).map((code) => {
        const active = lang === code
        return (
          <button
            key={code}
            type="button"
            role="radio"
            aria-checked={active}
            lang={code}
            onClick={() => void i18n.changeLanguage(code)}
            className={cn(
              'h-full min-w-9 rounded-[4px] px-2 transition-colors',
              tone === 'onDark'
                ? active
                  ? 'bg-lime text-[#142321]'
                  : 'text-[#9AABA6] hover:text-[#E8EFE9]'
                : active
                  ? 'bg-panel text-ink shadow-[0_0_0_1px_var(--color-hairline)] dark:bg-carbon'
                  : 'text-muted hover:text-ink',
            )}
          >
            {t(`language.short_${code}`)}
          </button>
        )
      })}
    </div>
  )
}

export function ThemeToggle({ className }: { className?: string }) {
  const { t } = useTranslation()
  const theme = useTheme()
  return (
    <IconButton
      label={theme === 'dark' ? t('theme.light') : t('theme.dark')}
      icon={theme === 'dark' ? <Sun size={18} strokeWidth={1.75} /> : <Moon size={18} strokeWidth={1.75} />}
      onClick={toggleTheme}
      size="sm"
      className={className}
    />
  )
}

export function useSignOut() {
  const navigate = useNavigate()
  return useCallback(() => {
    session.signOut()
    queryClient.clear()
    navigate('/login')
  }, [navigate])
}

/** The signed-in account plus its bilingual display name (from /auth/me when it loads). */
export function useMe() {
  const account = useSession(session)
  const lang = useLang()
  const { data } = useQuery({
    queryKey: ['me', 'user', account?.id],
    queryFn: () => get<User>('/auth/me'),
    enabled: Boolean(account),
    staleTime: 60_000,
    retry: false,
  })
  const name = data && data.id === account?.userId ? pickText(data.displayName, lang) : (account?.name ?? '')
  return { account, user: data ?? null, name }
}
