/**
 * Header controls shared by the staff and partner shells: language toggle,
 * theme toggle, user menu, Cmd-K trigger. Owner: shell.
 */
import { LogOut, Moon, Monitor, Search, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { setThemeMode, useTheme } from '@/app/theme'
import {
  Avatar,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconButton,
  Kbd,
  SegmentedControl,
} from '@/components/ui'
import { setLanguage } from '@/i18n'
import { cn } from '@/lib/cn'
import { localName } from '@/lib/format'
import { signOutTo, useMe } from '@/lib/session'

export function LanguageToggle({ className }: { className?: string }) {
  const { t, i18n } = useTranslation('common')
  const lang = i18n.language === 'ka' ? 'ka' : 'en'
  return (
    <SegmentedControl
      size="sm"
      aria-label={t('chrome.language')}
      value={lang}
      onChange={(v) => setLanguage(v)}
      className={className}
      options={[
        { value: 'en', label: 'EN', title: t('chrome.switchToEnglish') },
        { value: 'ka', label: 'ქარ', title: t('chrome.switchLanguage') },
      ]}
    />
  )
}

export function ThemeToggle() {
  const { t } = useTranslation('common')
  const { resolved, toggle } = useTheme()
  return (
    <IconButton
      label={t('chrome.toggleTheme')}
      icon={resolved === 'dark' ? <Sun aria-hidden /> : <Moon aria-hidden />}
      onClick={toggle}
    />
  )
}

export function openCommandPalette(): void {
  window.dispatchEvent(new CustomEvent('rigi:command-palette'))
}

export function SearchTrigger({ className }: { className?: string }) {
  const { t } = useTranslation('common')
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
  return (
    <>
      <button
        type="button"
        onClick={openCommandPalette}
        className={cn(
          'hidden h-8 w-56 items-center gap-2 rounded-md border border-hairline-strong bg-panel px-2.5 text-[13px] text-subtle transition-colors hover:border-ink/30 hover:text-muted md:inline-flex lg:w-64',
          className,
        )}
      >
        <Search className="size-4 stroke-[1.75]" aria-hidden />
        <span className="flex-1 truncate text-left">{t('chrome.search')}</span>
        <Kbd>{mac ? '⌘K' : 'Ctrl K'}</Kbd>
      </button>
      <IconButton label={t('chrome.searchShort')} icon={<Search aria-hidden />} onClick={openCommandPalette} className="md:hidden" />
    </>
  )
}

export function UserMenu() {
  const { t } = useTranslation('common')
  const me = useMe()
  const { mode } = useTheme()
  if (!me) return null
  const name = localName(me)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded-md pl-1 pr-1 text-left transition-colors hover:bg-ink/6 sm:pr-2"
          aria-label={t('chrome.account')}
        >
          <Avatar name={me.name} size="sm" color={me.avatarColor} />
          <span className="hidden min-w-0 flex-col leading-tight lg:flex">
            <span className="max-w-[160px] truncate text-[13px] font-medium">{name}</span>
            <span className="max-w-[160px] truncate text-[11px] text-muted">{t(`role.${me.role}`)}</span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <Avatar name={me.name} size="md" color={me.avatarColor} />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold">{name}</p>
            <p className="truncate text-xs text-muted">{me.email}</p>
            <p className="truncate text-xs text-muted">{t(`role.${me.role}`)}</p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t('chrome.theme')}</DropdownMenuLabel>
        <DropdownMenuItem icon={<Sun aria-hidden />} onSelect={() => setThemeMode('light')} hint={mode === 'light' ? '•' : undefined}>
          {t('chrome.themeLight')}
        </DropdownMenuItem>
        <DropdownMenuItem icon={<Moon aria-hidden />} onSelect={() => setThemeMode('dark')} hint={mode === 'dark' ? '•' : undefined}>
          {t('chrome.themeDark')}
        </DropdownMenuItem>
        <DropdownMenuItem icon={<Monitor aria-hidden />} onSelect={() => setThemeMode('system')} hint={mode === 'system' ? '•' : undefined}>
          {t('chrome.themeSystem')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={<LogOut aria-hidden />} onSelect={() => void signOutTo()}>
          {t('actions.signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
