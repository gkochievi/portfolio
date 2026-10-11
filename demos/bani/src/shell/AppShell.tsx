/**
 * The console frame: pine icon rail (64px, expands to 248px), 56px top bar with
 * breadcrumbs, Cmd-K call search, KA/EN, theme and the View-as pill; bottom tab
 * bar under 768px. Guards every route by its `handle.feature`.
 */
import { Suspense, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation, useMatches, useNavigate } from 'react-router-dom'
import { useSession } from '@portfolio/demo-kit'
import { useTranslation } from 'react-i18next'
import { ChevronRight, LogOut, Moon, MoreHorizontal, PanelLeftClose, PanelLeftOpen, RotateCcw, Search, Sun } from 'lucide-react'
import { toast } from 'sonner'

import { LogoMark, Wordmark } from '@/components/brand'
import {
  Avatar,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconButton,
  Skeleton,
  Spinner,
  Tooltip,
} from '@/components/ui'
import { session } from '@/demo'
import { setLang } from '@/i18n'
import { cn } from '@/lib/cn'
import { useInvalidateOn } from '@/lib/live'
import { canSeeExtensionActivity } from '@/lib/rbac'
import type { RouteHandle } from '@/routes'
import type { Lang, Persona } from '@/types'
import { CommandSearch } from './CommandSearch'
import { firstPathFor, itemForPath, visibleGroups, type NavGroup, type NavItem } from './nav'
import { resetDemo, signOut, switchPersona, toggleTheme, useLang, useTheme } from './state'
import { ME_QUERY_KEY, useMe } from './useMe'

export function AppShell() {
  const persona = useSession(session)
  if (!persona) return <Navigate to="/login" replace />
  return <SignedInShell persona={persona} />
}

function SignedInShell({ persona }: { persona: Persona }) {
  const { t } = useTranslation()
  const { me, role } = useMe()
  const location = useLocation()
  const matches = useMatches()
  const [expanded, setExpanded] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  useInvalidateOn('rbac:changed', ME_QUERY_KEY)
  useInvalidateOn('users:changed', ME_QUERY_KEY)

  const handle = [...matches].reverse().find((m) => (m.handle as RouteHandle | undefined)?.titleKey)?.handle as
    | RouteHandle
    | undefined
  const features = me?.features ?? []
  const groups = useMemo(() => visibleGroups(features, role), [features, role])

  // Document title follows the page.
  useEffect(() => {
    const page = handle?.titleKey ? t(handle.titleKey) : ''
    document.title = page ? `${page} · ${t('common:product.name')}` : t('common:product.name')
  }, [handle?.titleKey, t])

  // Cmd/Ctrl-K opens the call search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Route guard (only once access is known, so a reload never bounces).
  let redirect: string | null = null
  if (me && handle) {
    const lacksFeature = handle.feature && !features.includes(handle.feature)
    const lacksAdmin = handle.adminOnly && !canSeeExtensionActivity(role)
    if (lacksFeature || lacksAdmin) redirect = firstPathFor(features)
  }
  if (redirect && redirect !== location.pathname) return <Navigate to={redirect} replace />

  return (
    <div className="flex min-h-[100dvh] bg-bg text-ink">
      <a
        href="#main"
        className="sr-only z-[80] rounded-md bg-primary px-3 py-2 text-on-primary focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        {t('shell:header.skip')}
      </a>
      <Rail groups={groups} expanded={expanded} onToggle={() => setExpanded((e) => !e)} loading={!me} />
      <div className={cn('flex min-w-0 flex-1 flex-col transition-[padding] duration-[220ms] ease-out-soft md:pl-16', expanded && 'md:pl-[248px]')}>
        <TopBar persona={persona} onSearch={() => setSearchOpen(true)} />
        <main id="main" className="mx-auto w-full max-w-[1440px] flex-1 px-4 pb-28 pt-5 md:px-6 md:pb-10 md:pt-6">
          {me ? (
            <Suspense fallback={<PageFallback />}>
              <Outlet />
            </Suspense>
          ) : (
            <PageFallback />
          )}
        </main>
      </div>
      <BottomTabs groups={groups} />
      <CommandSearch open={searchOpen} onOpenChange={setSearchOpen} groups={groups} canSearchCalls={features.includes('cdr')} />
    </div>
  )
}

function PageFallback() {
  return (
    <div className="flex flex-col gap-4" aria-busy>
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-[2px] w-full" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-72" />
    </div>
  )
}

/* --------------------------------------------------------------------- rail */

function Rail({
  groups,
  expanded,
  onToggle,
  loading,
}: {
  groups: NavGroup[]
  expanded: boolean
  onToggle: () => void
  loading: boolean
}) {
  const { t } = useTranslation()
  const lang = useLang()
  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 hidden flex-col bg-pine text-linen transition-[width] duration-[220ms] ease-out-soft md:flex',
        expanded ? 'w-[248px]' : 'w-16',
      )}
      aria-label={t('shell:header.menu')}
    >
      <Link
        to="/"
        className={cn('flex h-14 shrink-0 items-center gap-3 border-b border-white/8', expanded ? 'px-4' : 'justify-center')}
        aria-label={t('common:product.name')}
      >
        <LogoMark size={30} />
        {expanded && <Wordmark lang={lang} tone="linen" className="text-[21px]" />}
      </Link>
      <nav className="scrollbar-thin flex-1 overflow-y-auto overflow-x-hidden py-3">
        {loading ? (
          <div className="flex flex-col items-center gap-3 px-3 pt-2">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="h-9 w-full animate-breathe rounded-[8px] bg-white/6" />
            ))}
          </div>
        ) : (
          groups.map((group, gi) => (
            <div key={group.id} className={cn(gi > 0 && 'mt-2 border-t border-white/8 pt-2')}>
              {expanded && (
                <div className="eyebrow px-5 pb-1 pt-2 !text-[10.5px] !text-[#9AA79F]">{t(`common:nav.groups.${group.id}`)}</div>
              )}
              {group.items.map((item) => (
                <RailLink key={item.path} item={item} expanded={expanded} />
              ))}
            </div>
          ))
        )}
      </nav>
      <div className="shrink-0 border-t border-white/8 p-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={expanded ? t('shell:header.collapse') : t('shell:header.expand')}
          title={expanded ? t('shell:header.collapse') : t('shell:header.expand')}
          className={cn(
            'flex h-9 w-full items-center gap-3 rounded-[8px] text-[#9AA79F] transition-colors duration-[160ms] hover:bg-white/6 hover:text-linen',
            expanded ? 'px-3' : 'justify-center',
          )}
        >
          {expanded ? <PanelLeftClose size={18} strokeWidth={1.75} /> : <PanelLeftOpen size={18} strokeWidth={1.75} />}
          {expanded && <span className="text-[13px]">{t('shell:header.collapse')}</span>}
        </button>
      </div>
    </aside>
  )
}

function RailLink({ item, expanded }: { item: NavItem; expanded: boolean }) {
  const { t } = useTranslation()
  const label = t(`common:${item.labelKey}`)
  const Icon = item.icon
  const link = (
    <NavLink
      to={item.path}
      end
      className={({ isActive }) =>
        cn(
          'group relative mx-2 my-0.5 flex h-10 items-center gap-3 rounded-[8px] transition-colors duration-[160ms] ease-out',
          expanded ? 'px-3' : 'justify-center',
          isActive ? 'bg-white/8 text-linen' : 'text-[#B9C3BC] hover:bg-white/5 hover:text-linen',
        )
      }
      aria-label={expanded ? undefined : label}
    >
      {({ isActive }) => (
        <>
          <span
            aria-hidden
            className={cn(
              'absolute -left-2 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-[#C2622F] transition-opacity duration-[160ms]',
              isActive ? 'opacity-100' : 'opacity-0',
            )}
          />
          <Icon size={18} strokeWidth={1.75} className={cn('shrink-0', isActive && 'text-brass')} aria-hidden />
          {expanded && <span className="truncate text-[13.5px] font-medium">{label}</span>}
        </>
      )}
    </NavLink>
  )
  return expanded ? link : <Tooltip content={label} side="right">{link}</Tooltip>
}

/* ------------------------------------------------------------------ top bar */

function TopBar({ persona, onSearch }: { persona: Persona; onSearch: () => void }) {
  const { t } = useTranslation()
  const location = useLocation()
  const lang = useLang()
  const found = itemForPath(location.pathname)
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-bg/92 px-3 backdrop-blur md:px-6">
      <Link to="/" className="md:hidden" aria-label={t('common:product.name')}>
        <LogoMark size={28} />
      </Link>
      <nav aria-label="Breadcrumb" className="hidden min-w-0 flex-1 items-center gap-1.5 text-[13px] sm:flex">
        <span className="truncate text-muted">{t('common:tenant.name')}</span>
        {found && (
          <>
            {found.group.items.length > 1 && (
              <>
                <ChevronRight size={14} className="shrink-0 text-faint" aria-hidden />
                <span className="truncate text-muted">{t(`common:nav.groups.${found.group.id}`)}</span>
              </>
            )}
            <ChevronRight size={14} className="shrink-0 text-faint" aria-hidden />
            <span className="truncate font-medium text-ink">{t(`common:${found.item.labelKey}`)}</span>
          </>
        )}
      </nav>
      <div className="flex-1 sm:hidden" />

      <button
        type="button"
        onClick={onSearch}
        className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-line-strong bg-panel px-2.5 text-[13px] text-muted transition-colors hover:text-ink lg:w-[260px]"
        aria-label={t('shell:search.open')}
      >
        <Search size={16} strokeWidth={1.75} aria-hidden />
        <span className="hidden flex-1 text-left lg:inline">{t('shell:search.open')}</span>
        <kbd className="hidden rounded border border-line px-1.5 font-mono text-[11px] lg:inline">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
      </button>

      <LangToggle lang={lang} />
      <ThemeToggle />
      <ViewAsMenu persona={persona} lang={lang} />
    </header>
  )
}

export function LangToggle({ lang, className }: { lang: Lang; className?: string }) {
  const { t } = useTranslation()
  const options: { value: Lang; label: string }[] = [
    { value: 'ka', label: 'ქარ' },
    { value: 'en', label: 'EN' },
  ]
  return (
    <div role="radiogroup" aria-label={t('shell:header.language')} className={cn('inline-flex h-9 items-center rounded-[8px] border border-line-strong bg-panel p-0.5', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={lang === o.value}
          lang={o.value}
          onClick={() => setLang(o.value)}
          className={cn(
            'inline-flex h-full items-center rounded-[6px] px-2 text-[12.5px] font-semibold transition-colors duration-[160ms]',
            lang === o.value ? 'bg-pine text-linen dark:bg-linen dark:text-pine' : 'text-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function ThemeToggle({ className }: { className?: string }) {
  const { t } = useTranslation()
  const theme = useTheme()
  return (
    <IconButton
      className={cn('border border-line-strong bg-panel', className)}
      label={theme === 'dark' ? t('shell:header.toLight') : t('shell:header.toDark')}
      icon={theme === 'dark' ? Sun : Moon}
      onClick={toggleTheme}
    />
  )
}

function ViewAsMenu({ persona, lang }: { persona: Persona; lang: Lang }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const name = lang === 'ka' ? persona.nameKa : persona.name
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 max-w-[260px] items-center gap-2 rounded-full border border-primary/70 bg-panel pl-1 pr-2 transition-colors duration-[160ms] hover:bg-primary/6 sm:pr-3"
          aria-label={`${t('shell:header.viewAs')}: ${name}, ${t(`common:roles.${persona.role}`)}`}
        >
          <Avatar name={persona.name} color={persona.avatarColor} size={28} />
          <span className="hidden min-w-0 flex-col text-left leading-tight sm:flex">
            <span className="truncate text-[12.5px] font-semibold text-ink">{name}</span>
            <span className="truncate text-[11px] text-muted">{t(`common:roles.${persona.role}`)}</span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[300px]">
        <div className="flex items-center gap-3 px-2.5 py-2.5">
          <Avatar name={persona.name} color={persona.avatarColor} size={36} />
          <div className="min-w-0">
            <div className="text-[11.5px] text-muted">{t('shell:header.signedInAs')}</div>
            <div className="truncate text-[14px] font-semibold">{name}</div>
            <div className="truncate text-[12px] text-muted">{persona.email}</div>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t('shell:header.viewAs')}</DropdownMenuLabel>
        <div className="scrollbar-thin max-h-[320px] overflow-y-auto">
          {session.accounts.map((p) => (
            <DropdownMenuItem
              key={p.id}
              checked={p.id === persona.id}
              onSelect={() => {
                if (p.id !== persona.id) switchPersona(p.id, navigate)
              }}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <Avatar name={p.name} color={p.avatarColor} size={24} />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium">{lang === 'ka' ? p.nameKa : p.name}</span>
                  <span className="block truncate text-[11.5px] text-muted">{t(`common:roles.${p.role}`)}</span>
                </span>
              </span>
            </DropdownMenuItem>
          ))}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          icon={RotateCcw}
          onSelect={() => {
            resetDemo()
            toast.success(t('shell:header.resetDone'))
          }}
        >
          {t('shell:header.resetDemo')}
        </DropdownMenuItem>
        <DropdownMenuItem icon={LogOut} tone="danger" onSelect={() => signOut(navigate)}>
          {t('shell:header.signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* -------------------------------------------------------------- bottom tabs */

function BottomTabs({ groups }: { groups: NavGroup[] }) {
  const { t } = useTranslation()
  const location = useLocation()
  const items = groups.flatMap((g) => g.items)
  if (items.length === 0) return null
  const primary = items.length <= 5 ? items : items.slice(0, 4)
  const overflow = items.length <= 5 ? [] : items.slice(4)
  const overflowActive = overflow.some((i) => location.pathname === i.path)
  return (
    <nav
      aria-label={t('shell:header.menu')}
      className="fixed inset-x-0 bottom-0 z-40 flex h-[60px] items-stretch border-t border-white/8 bg-pine pb-[env(safe-area-inset-bottom)] text-linen md:hidden"
    >
      {primary.map((item) => (
        <TabLink key={item.path} item={item} />
      ))}
      {overflow.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn('relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[10.5px]', overflowActive ? 'text-linen' : 'text-[#B9C3BC]')}
            >
              {overflowActive && <span aria-hidden className="absolute inset-x-5 top-0 h-[3px] rounded-b-full bg-[#C2622F]" />}
              <MoreHorizontal size={20} strokeWidth={1.75} className={overflowActive ? 'text-brass' : undefined} aria-hidden />
              <span className="max-w-full truncate px-1">{t('shell:header.more')}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="end" sideOffset={8}>
            {overflow.map((item) => (
              <OverflowItem key={item.path} item={item} />
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </nav>
  )
}

function OverflowItem({ item }: { item: NavItem }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  return (
    <DropdownMenuItem icon={item.icon} checked={location.pathname === item.path} onSelect={() => navigate(item.path)}>
      {t(`common:${item.labelKey}`)}
    </DropdownMenuItem>
  )
}

function TabLink({ item }: { item: NavItem }) {
  const { t } = useTranslation()
  const Icon = item.icon
  return (
    <NavLink
      to={item.path}
      end
      className={({ isActive }) =>
        cn('relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[10.5px]', isActive ? 'text-linen' : 'text-[#B9C3BC]')
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span aria-hidden className="absolute inset-x-5 top-0 h-[3px] rounded-b-full bg-[#C2622F]" />}
          <Icon size={20} strokeWidth={1.75} className={isActive ? 'text-brass' : undefined} aria-hidden />
          <span className="max-w-full truncate px-1">{t(`common:${item.labelKey}`)}</span>
        </>
      )}
    </NavLink>
  )
}

/** Small centred spinner for route-level loading. */
export function CenteredSpinner({ children }: { children?: ReactNode }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center gap-2 text-muted">
      <Spinner />
      {children}
    </div>
  )
}
