/** Header controls shared by every shell: KA/EN toggle, theme toggle, user menu. */
import { ChevronDown, Gamepad2, LayoutDashboard, LogOut, Moon, Sun, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import {
  Avatar,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconButton,
  RoleBadge,
  Segmented,
  Skeleton,
} from '@/components/ui'
import { setLang, useLang, type Lang } from '@/i18n'
import { http } from '@/lib/api'
import { useMe } from '@/lib/queries'
import { displayName } from './session'
import { toggleTheme, useResolvedTheme } from './theme'

/** Georgian first, as the brief asks. */
export function LanguageToggle({ className }: { className?: string }) {
  const { t } = useTranslation()
  const lang = useLang()
  return (
    <Segmented<Lang>
      size="sm"
      aria-label={t('common:language.switch')}
      value={lang}
      onChange={setLang}
      className={className}
      options={[
        { value: 'ka', label: <span lang="ka">{t('common:language.short.ka')}</span>, title: t('common:language.ka') },
        { value: 'en', label: t('common:language.short.en'), title: t('common:language.en') },
      ]}
    />
  )
}

export function ThemeToggle({ className }: { className?: string }) {
  const { t } = useTranslation()
  const theme = useResolvedTheme()
  return (
    <IconButton
      label={t('common:theme.toggle')}
      icon={theme === 'dark' ? <Sun /> : <Moon />}
      onClick={toggleTheme}
      className={className}
    />
  )
}

export function UserMenu() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { data: me, isLoading } = useMe()
  if (isLoading) return <Skeleton className="size-9 rounded-full" />
  if (!me) return null
  const name = displayName(me, i18n.language)

  const signOut = async () => {
    await http.post('/auth/logout')
    navigate('/', { replace: true })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('shell:user.menu')}
          className="flex h-10 items-center gap-2 rounded-card pl-1 pr-1.5 text-ink transition-colors hover:bg-sunken data-[state=open]:bg-sunken"
        >
          <Avatar name={name} size="sm" tone={me.isStaff ? 'ink' : 'primary'} />
          <span className="hidden max-w-[150px] truncate text-sm font-semibold xl:block">{name}</span>
          <ChevronDown className="size-4 text-muted" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[260px]">
        <DropdownMenuLabel>
          <span className="block text-xs text-muted">{t('shell:user.signedInAs')}</span>
          <span className="block truncate font-semibold text-ink">{name}</span>
          <span className="block truncate text-xs text-muted">{me.email}</span>
          <RoleBadge role={me.role} size="sm" className="mt-2" />
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {me.isStaff && (
          <DropdownMenuItem onSelect={() => navigate('/admin')}>
            <LayoutDashboard />
            {t('shell:nav.console')}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => navigate('/me')}>
          <UserRound />
          {t('shell:nav.myCard')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate('/play')}>
          <Gamepad2 />
          {t('shell:nav.play')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem danger onSelect={() => void signOut()}>
          <LogOut />
          {t('common:actions.signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
