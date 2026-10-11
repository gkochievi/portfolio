/** Shared frame for 403 / 404. Owner: shell. */
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { Logo, QueueMotif } from '@/components/brand'
import { LanguageToggle, ThemeToggle } from '@/components/layout/chrome'
import { useMe } from '@/lib/session'

export function SystemScreen({ code, title, body, actions }: { code: string; title: ReactNode; body: ReactNode; actions: ReactNode }) {
  const me = useMe()
  return (
    <div data-realm={me?.realm ?? 'staff'} className="flex min-h-dvh flex-col bg-surface">
      <header className="flex h-14 items-center justify-between px-4 sm:px-6">
        <Link to={me?.home ?? '/'} className="rounded-md"><Logo variant={me?.realm === 'partner' ? 'partner' : 'staff'} size={26} /></Link>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-24">
        <div className="flex max-w-md flex-col items-center text-center">
          <QueueMotif count={5} size={14} withTicket />
          <p className="mt-8 font-mono text-[13px] text-subtle">{code}</p>
          <h1 className="mt-1 font-display text-[32px] font-bold leading-[38px] tracking-[-0.02em]">{title}</h1>
          <p className="mt-2 text-sm text-muted">{body}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">{actions}</div>
        </div>
      </main>
    </div>
  )
}
