/**
 * Cmd-K / Ctrl-K palette: jump to any screen the persona can open, switch
 * theme or language, sign out. Owner: shell.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as RadixDialog from '@radix-ui/react-dialog'
import { Command } from 'cmdk'
import { CornerDownLeft, Languages, LogOut, Moon, Search, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AREA_ICON, destinationsFor } from '@/app/nav'
import { toggleTheme, useTheme } from '@/app/theme'
import { setLanguage } from '@/i18n'
import { signOutTo, useMe } from '@/lib/session'

const itemCls =
  'flex h-9 cursor-default select-none items-center gap-2.5 rounded-md px-2.5 text-[13px] text-ink outline-none data-[selected=true]:bg-row-hover data-[selected=true]:shadow-[inset_3px_0_0_var(--signal)] [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:stroke-[1.75] [&_svg]:text-muted'

export function CommandPalette() {
  const { t, i18n } = useTranslation('common')
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const me = useMe()
  const { resolved } = useTheme()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    const onOpen = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('rigi:command-palette', onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('rigi:command-palette', onOpen)
    }
  }, [])

  const run = (fn: () => void) => {
    setOpen(false)
    fn()
  }

  const destinations = destinationsFor(me)
  const areas = [...new Set(destinations.map((d) => d.area))]

  return (
    <RadixDialog.Root open={open} onOpenChange={setOpen}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-[var(--scrim)] animate-fade" />
        <RadixDialog.Content className="fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-32px)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-hairline bg-panel shadow-overlay outline-none animate-pop">
          <RadixDialog.Title className="sr-only">{t('chrome.commands')}</RadixDialog.Title>
          <RadixDialog.Description className="sr-only">{t('chrome.search')}</RadixDialog.Description>
          <Command label={t('chrome.commands')} loop>
            <div className="flex items-center gap-2 border-b border-hairline px-3">
              <Search className="size-4 shrink-0 stroke-[1.75] text-muted" aria-hidden />
              <Command.Input
                autoFocus
                placeholder={t('chrome.search')}
                className="h-12 w-full bg-transparent text-sm text-ink outline-none placeholder:text-subtle focus-visible:shadow-none focus-visible:outline-none"
              />
            </div>
            <Command.List className="max-h-[min(420px,60vh)] overflow-y-auto p-1.5 scrollbar-thin">
              <Command.Empty className="px-3 py-8 text-center text-[13px] text-muted">{t('chrome.noMatches')}</Command.Empty>
              {areas.map((area) => {
                const AreaIcon = AREA_ICON[area]
                return (
                  <Command.Group
                    key={area}
                    heading={t(`nav.areas.${area}`)}
                    className="[&_[cmdk-group-heading]]:eyebrow [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2"
                  >
                    {destinations
                      .filter((d) => d.area === area)
                      .map(({ item }) => {
                        const Icon = item.icon ?? AreaIcon
                        const label = t(`nav.${item.label}`)
                        return (
                          <Command.Item
                            key={`${area}-${item.to}`}
                            value={`${t(`nav.areas.${area}`)} ${label} ${item.to}`}
                            onSelect={() => run(() => navigate(item.to))}
                            className={itemCls}
                          >
                            <Icon aria-hidden />
                            <span className="flex-1 truncate">{label}</span>
                            <span className="font-mono text-[11px] text-subtle">{item.to.split('?')[0]}</span>
                          </Command.Item>
                        )
                      })}
                  </Command.Group>
                )
              })}
              <Command.Group heading={t('chrome.commands')} className="[&_[cmdk-group-heading]]:eyebrow [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2">
                <Command.Item value="theme dark light" onSelect={() => run(toggleTheme)} className={itemCls}>
                  {resolved === 'dark' ? <Sun aria-hidden /> : <Moon aria-hidden />}
                  <span className="flex-1">{t('chrome.toggleTheme')}</span>
                </Command.Item>
                <Command.Item
                  value="language ena english georgian"
                  onSelect={() => run(() => setLanguage(i18n.language === 'ka' ? 'en' : 'ka'))}
                  className={itemCls}
                >
                  <Languages aria-hidden />
                  <span className="flex-1">{i18n.language === 'ka' ? t('chrome.switchToEnglish') : t('chrome.switchLanguage')}</span>
                </Command.Item>
                {me ? (
                  <Command.Item value="sign out logout" onSelect={() => run(() => void signOutTo())} className={itemCls}>
                    <LogOut aria-hidden />
                    <span className="flex-1">{t('actions.signOut')}</span>
                  </Command.Item>
                ) : null}
              </Command.Group>
            </Command.List>
            <div className="flex items-center justify-end gap-1.5 border-t border-hairline px-3 py-2 text-[11px] text-subtle">
              <CornerDownLeft className="size-3.5 stroke-[1.75]" aria-hidden />
              {t('chrome.goTo')}
            </div>
          </Command>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}
