/** `/`: the public splash. Signed-in visitors go straight to their card. */
import type { ReactNode } from 'react'
import { LayoutDashboard, LogIn, LogOut, Trophy, UserPlus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import { ItemToken, Logo, Wordmark } from '@/components/brand'
import { Button } from '@/components/ui'
import { http } from '@/lib/api'
import { useCurrentEvents } from '@/lib/queries'
import { isStaffRole } from '@/lib/roles'
import { LanguageToggle, ThemeToggle } from '@/shell/controls'
import { useCurrentUser } from '@/shell/session'
import { useLang } from '@/i18n'
import { LandingSnowfall } from '../components/LandingSnowfall'

export default function LandingPage() {
  const { t } = useTranslation('hub')
  const lang = useLang()
  const navigate = useNavigate()
  const user = useCurrentUser()
  const { data: events } = useCurrentEvents()

  if (user && !user.disabled) return <Navigate to="/me" replace />

  const staff = !!user && isStaffRole(user.role)
  const showStandings = !!events?.current?.leaderboardVisible

  const signOut = async () => {
    await http.post('/auth/logout')
    navigate('/', { replace: true })
  }

  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-surface text-ink">
      <LandingSnowfall />

      <header className="relative z-10 flex items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Logo size={32} title={t('common:appName')} />
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-[520px] flex-1 flex-col justify-center px-4 pb-10 pt-4">
        <p className="mb-4 inline-flex items-center gap-2 self-start rounded-chip bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent-ink">
          <span className="size-1.5 rounded-full bg-accent animate-live-dot" aria-hidden />
          {t('landing.eyebrow')}
        </p>
        <h1 className="font-display text-[64px] leading-none sm:text-[88px]">
          <Wordmark lang={lang} />
          <span className="sr-only">{t('common:appName')}</span>
        </h1>
        <p className="mt-4 font-display text-xl leading-snug text-ink sm:text-2xl">{t('common:tagline')}</p>
        <p className="mt-4 text-base text-muted">{t('landing.howTo')}</p>

        <ul className="mt-5 grid grid-cols-3 gap-2" aria-label={t('landing.legend')}>
          <LegendItem token={<ItemToken type="GOOD" name="Kvamli Coffee" imageUrl="media/items/kvamli-coffee.svg" size={36} />} label={t('landing.legendGood')} points="+50" tone="text-success" />
          <LegendItem token={<ItemToken type="MINOR" name="Icicle" size={36} />} label={t('landing.legendMinor')} points="−10" tone="text-warning" />
          <LegendItem token={<ItemToken type="MAJOR" name="Storm cloud" size={36} />} label={t('landing.legendMajor')} points="−500" tone="text-danger" />
        </ul>

        <div className="mt-8 grid gap-3">
          <Button asChild size="lg" block>
            <Link to="/register">
              <UserPlus className="size-5" aria-hidden />
              {t('landing.register')}
            </Link>
          </Button>
          {user ? (
            <Button size="lg" block variant="secondary" onClick={() => void signOut()} leftIcon={<LogOut className="size-5" aria-hidden />}>
              {t('common:actions.signOut')}
            </Button>
          ) : (
            <Button asChild size="lg" block variant="secondary">
              <Link to="/login">
                <LogIn className="size-5" aria-hidden />
                {t('common:actions.signIn')}
              </Link>
            </Button>
          )}
        </div>

        {(showStandings || staff) && (
          <nav aria-label={t('landing.more')} className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm font-semibold">
            {showStandings && (
              <Link to="/leaderboard" className="inline-flex items-center gap-1.5 rounded-chip text-primary hover:underline">
                <Trophy className="size-4" strokeWidth={1.75} aria-hidden />
                {t('landing.standings')}
              </Link>
            )}
            {staff && (
              <Link to="/admin" className="inline-flex items-center gap-1.5 rounded-chip text-primary hover:underline">
                <LayoutDashboard className="size-4" strokeWidth={1.75} aria-hidden />
                {t('landing.admin')}
              </Link>
            )}
          </nav>
        )}
      </main>

      <footer className="relative z-10 px-4 pb-5 text-center text-xs text-muted">
        {t('landing.footer', { organiser: t('common:organiser') })}
      </footer>
    </div>
  )
}

function LegendItem({ token, label, points, tone }: { token: ReactNode; label: string; points: string; tone: string }) {
  return (
    <li className="flex flex-col items-center gap-1.5 rounded-card border border-line bg-panel/80 px-2 py-3 text-center">
      {token}
      <span className={`font-mono text-sm font-bold tabular-nums ${tone}`}>{points}</span>
      <span className="text-xs leading-tight text-muted">{label}</span>
    </li>
  )
}
