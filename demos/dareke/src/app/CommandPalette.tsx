/** Cmd/Ctrl+K command palette: role-filtered navigation, language, theme, sign out. */
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Command } from 'cmdk'
import { CornerDownLeft, Keyboard, Languages, LogOut, Moon, Search, Sun } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { Kbd } from '@/components/ui'
import { useLang } from '@/lib/localized'
import { useMe, useSignOut } from './controls'
import { navFor } from './nav'
import { toggleTheme, useTheme } from './theme'

function Item({ onSelect, icon, children, hint, value }: { onSelect: () => void; icon: ReactNode; children: ReactNode; hint?: ReactNode; value: string }) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="flex h-10 cursor-pointer select-none items-center gap-3 rounded-control px-3 text-sm text-ink outline-none data-[selected=true]:bg-sunken [&_svg]:size-[18px] [&_svg]:text-muted"
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint}
    </Command.Item>
  )
}

const groupClass =
  'px-1 py-1 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted'

export function CommandPalette({ open, onOpenChange, onShowShortcuts }: { open: boolean; onOpenChange: (o: boolean) => void; onShowShortcuts: () => void }) {
  const { t, i18n } = useTranslation('shell')
  const { t: tc } = useTranslation()
  const navigate = useNavigate()
  const { account } = useMe()
  const signOut = useSignOut()
  const theme = useTheme()
  const lang = useLang()
  const run = (fn: () => void) => {
    onOpenChange(false)
    fn()
  }
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="dk-overlay fixed inset-0 z-50 bg-[#0B1517]/45" />
        <DialogPrimitive.Content className="dk-dialog fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-32px)] max-w-xl -translate-x-1/2 overflow-hidden rounded-card border border-hairline bg-panel text-ink shadow-pop focus:outline-none">
          <DialogPrimitive.Title className="sr-only">{t('palette.title')}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">{t('palette.placeholder')}</DialogPrimitive.Description>
          <Command loop label={t('palette.title')}>
            <div className="flex items-center gap-2 border-b border-hairline px-4">
              <Search size={18} strokeWidth={1.75} className="text-muted" />
              <Command.Input
                autoFocus
                placeholder={t('palette.placeholder')}
                className="h-12 min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-muted focus-visible:shadow-none focus-visible:outline-none"
              />
              <Kbd>Esc</Kbd>
            </div>
            <Command.List className="max-h-[min(420px,60vh)] overflow-y-auto p-1">
              <Command.Empty className="px-4 py-8 text-center text-sm text-muted">{tc('states.noResults')}</Command.Empty>
              <Command.Group heading={t('palette.navigate')} className={groupClass}>
                {navFor(account?.role).map((item) => (
                  <Item
                    key={item.to}
                    value={`nav ${t(`nav.${item.key}`)} ${item.to}`}
                    icon={<item.icon strokeWidth={1.75} />}
                    onSelect={() => run(() => navigate(item.to))}
                    hint={<CornerDownLeft size={14} className="opacity-0 [[data-selected=true]_&]:opacity-100" />}
                  >
                    {t(`nav.${item.key}`)}
                  </Item>
                ))}
              </Command.Group>
              <Command.Group heading={t('palette.preferences')} className={groupClass}>
                <Item
                  value="language ena english ქართული"
                  icon={<Languages strokeWidth={1.75} />}
                  onSelect={() => run(() => void i18n.changeLanguage(lang === 'ka' ? 'en' : 'ka'))}
                >
                  {lang === 'ka' ? t('palette.toEnglish') : t('palette.toGeorgian')}
                </Item>
                <Item value="theme dark light თემა" icon={theme === 'dark' ? <Sun strokeWidth={1.75} /> : <Moon strokeWidth={1.75} />} onSelect={() => run(toggleTheme)}>
                  {theme === 'dark' ? t('palette.lightMode') : t('palette.darkMode')}
                </Item>
                <Item value="shortcuts keyboard" icon={<Keyboard strokeWidth={1.75} />} onSelect={() => run(onShowShortcuts)} hint={<Kbd>?</Kbd>}>
                  {t('shortcuts.title')}
                </Item>
              </Command.Group>
              <Command.Group heading={t('palette.account')} className={groupClass}>
                <Item value="sign out logout გასვლა" icon={<LogOut strokeWidth={1.75} />} onSelect={() => run(signOut)}>
                  {tc('actions.signOut')}
                </Item>
              </Command.Group>
            </Command.List>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
