/**
 * Split sign-in screen: brand panel (logo, tagline, a "now serving" ledger)
 * on the left, the form column on the right. Owner: shell.
 */
import type { ReactNode } from 'react'
import { DemoAccounts } from '@portfolio/demo-kit'
import { useTranslation } from 'react-i18next'

import { Logo } from '@/components/brand'
import type { RigiAccount } from '@/demo/accounts'
import { cn } from '@/lib/cn'
import { formatIndex, localName } from '@/lib/format'

function QueueBoard({ realm }: { realm: 'staff' | 'partner' }) {
  const { t } = useTranslation('shell')
  const rows = (t(`auth.board.${realm}`, { returnObjects: true }) as string[]) ?? []
  const active = Math.min(2, rows.length - 1)
  return (
    <ol className="mt-10 max-w-sm overflow-hidden rounded-lg border border-hairline bg-panel">
      {rows.map((row, i) => (
        <li
          key={row}
          className={cn(
            'flex h-11 items-center gap-3 border-b border-hairline px-4 text-[13px] last:border-0 animate-rise',
            i === active && 'serving bg-row-hover font-semibold',
            i < active && 'text-subtle line-through decoration-hairline-strong',
          )}
          style={{ animationDelay: `${i * 70}ms` }}
        >
          <span className="font-mono text-[11px] text-subtle">{formatIndex(i + 1)}</span>
          <span className="flex-1 truncate">{row}</span>
          {i === active ? <span className="eyebrow text-primary">{t('common:states.nextUp')}</span> : null}
          {i < active ? <span className="size-1.5 bg-success" aria-hidden /> : null}
        </li>
      ))}
    </ol>
  )
}

export function AuthScreen({ realm, children }: { realm: 'staff' | 'partner'; children: ReactNode }) {
  const { t } = useTranslation('shell')
  return (
    <div data-realm={realm} className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <aside className="relative hidden overflow-hidden border-r border-hairline bg-sunken px-12 py-12 lg:flex lg:flex-col">
        {realm === 'partner' ? <div className="absolute inset-x-0 top-0 h-1 bg-primary" aria-hidden /> : null}
        <Logo variant={realm} size={34} />
        <div className="mt-auto">
          <p className="eyebrow">{t(realm === 'partner' ? 'common:app.partnerSpace' : 'common:app.staffSpace')}</p>
          <h2 className="mt-2 max-w-md font-display text-[32px] font-bold leading-[38px] tracking-[-0.02em]">{t('common:app.tagline')}</h2>
          <p className="mt-3 max-w-md text-sm text-muted">{t(`auth.pitch.${realm}`)}</p>
          <QueueBoard realm={realm} />
        </div>
        <p className="mt-10 text-xs text-subtle">{t('auth.demoNote')}</p>
      </aside>
      <div className="flex min-w-0 flex-col px-4 pb-24 pt-16 sm:px-10 lg:justify-center lg:px-16">
        <div className="mx-auto w-full max-w-[440px]">
          <div className="mb-8 lg:hidden">
            <Logo variant={realm} size={30} />
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}

/** Demo persona cards in Rigi's style (one click signs in). */
export function PersonaCards({ accounts, onPick, disabled, currentId }: { accounts: readonly RigiAccount[]; onPick: (a: RigiAccount) => void; disabled?: boolean; currentId?: string | null }) {
  const { t } = useTranslation('shell')
  const localized = accounts.map((a) => ({
    ...a,
    name: localName(a),
    roleLabel: t(`common:role.${a.role}`),
    description: t(`personas.${a.id}`, { defaultValue: a.description ?? '' }),
  }))
  return (
    <DemoAccounts
      accounts={localized}
      onPick={(a) => onPick(accounts.find((x) => x.id === a.id)!)}
      disabled={disabled}
      currentId={currentId}
      label={t('auth.personas')}
      className="grid gap-2"
      classNames={{
        item: 'list-none',
        card: 'group flex w-full items-start gap-3 rounded-lg border border-hairline bg-panel px-3.5 py-3 text-left transition-colors duration-150 hover:border-hairline-strong hover:bg-row-hover hover:shadow-[inset_3px_0_0_var(--signal)] disabled:opacity-60 data-[current=true]:shadow-[inset_3px_0_0_var(--signal)]',
        avatar: 'inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-[var(--bdk-avatar,#1A1B1E)] text-xs font-semibold text-white',
        body: 'flex min-w-0 flex-1 flex-col',
        name: 'truncate text-[13px] font-semibold text-ink',
        role: 'eyebrow',
        email: 'truncate font-mono text-[11px] text-subtle',
        description: 'mt-1 text-xs text-muted',
      }}
    />
  )
}
