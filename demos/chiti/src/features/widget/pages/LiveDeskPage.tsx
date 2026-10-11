/** `/live`: the customer's storefront and widget (left) next to Luka's inbox (right). */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronUp, Headset, Store } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { LoadingBlock, SegmentedControl } from '@/components/ui'
import { cn } from '@/lib/cn'
import { signInAs, useAccount } from '@/lib/account'
import { request } from '@/lib/api'
import { InboxWorkspace } from '@/features/inbox/InboxWorkspace'

import { ChitiWidget } from '../components/ChitiWidget'
import { Storefront } from '../components/Storefront'

const STEPS = ['open', 'ask', 'human', 'claim', 'reply', 'rate'] as const

export default function LiveDeskPage() {
  const { t } = useTranslation('widget')
  const account = useAccount()
  const [view, setView] = useState<'customer' | 'operator'>('customer')
  const [script, setScript] = useState(() => typeof window === 'undefined' || window.innerWidth >= 1280)
  const isOperator = account?.role === 'operator'

  // The visitor is the customer; Luka drives the inbox.
  useEffect(() => {
    if (!account || account.role !== 'operator') signInAs('op_luka')
  }, [account])

  // While this page is open a human plays the operator, so Mariam stays quiet.
  useEffect(() => {
    void request('PATCH', '/demo/controls', { body: { operatorDriving: true } }).catch(() => undefined)
    return () => {
      void request('PATCH', '/demo/controls', { body: { operatorDriving: false } }).catch(() => undefined)
    }
  }, [])

  return (
    <main className="mx-auto flex w-full max-w-[1560px] flex-col gap-3 px-3 pb-4 pt-3 text-ink sm:px-4">
      <section aria-label={t('live.scriptTitle')} className="rounded-modal border border-line bg-panel">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
          <div className="min-w-0">
            <h1 className="m-0 font-display text-[17px] font-semibold leading-tight">{t('live.title')}</h1>
            <p className="m-0 mt-0.5 text-[13px] text-muted">{t('live.subtitle')}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link to="/" className="link hidden text-[13px] sm:inline">{t('live.back')}</Link>
            <button
              type="button"
              onClick={() => setScript((open) => !open)}
              aria-expanded={script}
              className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-ink px-3 py-1 text-[13px] font-medium hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {t('live.scriptTitle')}
              {script ? <ChevronUp size={15} strokeWidth={1.75} aria-hidden /> : <ChevronDown size={15} strokeWidth={1.75} aria-hidden />}
            </button>
          </div>
        </div>
        {script && (
          <ol className="m-0 grid list-none gap-2 border-t border-line p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {STEPS.map((step, index) => (
              <li key={step} className="flex gap-2.5 rounded-ui bg-sunken p-2.5 text-[12.5px] leading-snug">
                <span className="tabular grid size-6 shrink-0 place-items-center rounded-full border-[1.5px] border-ink bg-primary text-[12px] font-bold text-on-primary">{index + 1}</span>
                <span>
                  <strong className="block font-semibold">{t(`live.steps.${step}.title`)}</strong>
                  <span className="text-muted">{t(`live.steps.${step}.body`)}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="lg:hidden">
        <SegmentedControl<'customer' | 'operator'>
          aria-label={t('live.switch')}
          value={view}
          onChange={setView}
          options={[
            { value: 'customer', label: t('live.customer'), icon: <Store size={15} strokeWidth={1.75} /> },
            { value: 'operator', label: t('live.operator'), icon: <Headset size={15} strokeWidth={1.75} /> },
          ]}
        />
      </div>

      <div className={cn('grid min-h-[640px] gap-3 lg:min-h-[560px] lg:grid-cols-[minmax(380px,460px)_minmax(0,1fr)]', script ? 'lg:h-[calc(100dvh-16rem)]' : 'lg:h-[calc(100dvh-8.5rem)]')}>
        <section aria-label={t('live.customer')} className={cn('relative min-h-[640px] overflow-hidden rounded-modal border border-line bg-panel lg:min-h-0', view === 'operator' && 'max-lg:hidden')}>
          <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-2 border-b border-line bg-panel/95 px-3 py-1.5 text-[12px] font-medium text-muted">
            <Store size={14} strokeWidth={1.75} aria-hidden />
            {t('live.customerLabel')}
          </div>
          <div className="absolute inset-0 overflow-y-auto pt-8">
            <Storefront compact hideRibbon />
          </div>
          <ChitiWidget slug="vazi" mode="contained" defaultOpen persona />
        </section>

        <section aria-label={t('live.operator')} className={cn('flex min-h-[640px] min-w-0 flex-col overflow-hidden rounded-modal border border-line bg-panel lg:min-h-0', view === 'customer' && 'max-lg:hidden')}>
          <div className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-1.5 text-[12px] font-medium text-muted">
            <Headset size={14} strokeWidth={1.75} aria-hidden />
            {t('live.operatorLabel')}
          </div>
          <div className="min-h-0 flex-1">
            {isOperator ? <InboxWorkspace embedded /> : <LoadingBlock label={t('live.signingIn')} />}
          </div>
        </section>
      </div>
    </main>
  )
}
