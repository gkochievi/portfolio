import type { ReactNode } from 'react'

import { BellCurve } from '@/components/brand'

/** Full-page message for 404 / 403 / crash screens. */
export function SystemMessage({ code, title, body, actions }: { code?: ReactNode; title: ReactNode; body?: ReactNode; actions?: ReactNode }) {
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center px-4 py-16 text-center">
      <BellCurve className="w-56" bead={0.86} />
      {code ? <div className="tabular mt-6 font-display text-5xl font-semibold text-accent">{code}</div> : null}
      <h1 className="mt-3 font-display text-2xl font-semibold">{title}</h1>
      {body ? <p className="mt-2 text-[15px] text-muted">{body}</p> : null}
      {actions ? <div className="mt-6 flex flex-wrap justify-center gap-2">{actions}</div> : null}
    </section>
  )
}
