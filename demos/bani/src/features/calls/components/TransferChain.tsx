import { Fragment } from 'react'

import { cn } from '@/lib/cn'
import type { UnifiedCdr } from '@/types'
import { useCallLabels } from './useCallLabels'

/** Party pills joined by the bronze line; each hop is labelled with its reason. */
export function TransferChain({ row, className }: { row: UnifiedCdr; className?: string }) {
  const { t, labels } = useCallLabels()
  const transfer = row.transfer
  if (!transfer || transfer.chain.length < 2) return null
  const { chain, hops } = transfer
  return (
    <div className={cn('min-w-0', className)}>
      <div className="mb-2 text-[12px] font-semibold text-muted">{t('chain.title')}</div>
      <ol className="flex flex-wrap items-end gap-y-3" aria-label={t('chain.title')}>
        {chain.map((party, i) => {
          const first = i === 0
          const last = i === chain.length - 1
          const hop = i > 0 ? hops[i - 2] : undefined
          const label = i === 0 ? '' : i === 1 ? t('chain.dialed') : hop ? labels.reason(hop.reason) : ''
          const part = i >= 1 ? hops[i - 1]?.toPartition : undefined
          return (
            <Fragment key={`${party}-${i}`}>
              {i > 0 && (
                <li aria-hidden className="flex min-w-[56px] flex-col items-center px-1">
                  <span className="mb-1 text-[11px] leading-none text-muted">{label}</span>
                  <span className="relative block h-[2px] w-full min-w-[40px] rounded-full bg-primary">
                    <span className="absolute -right-px -top-[3px] h-2 w-2 rotate-45 border-r-2 border-t-2 border-primary" />
                  </span>
                </li>
              )}
              <li
                className={cn(
                  'flex flex-col items-center rounded-full border px-3 py-1 font-mono text-[12.5px] tabular',
                  first ? 'border-line bg-sunken text-ink' : last ? 'border-primary bg-primary/10 text-ink' : 'border-line-strong bg-panel text-ink',
                )}
                title={part}
              >
                <span>{party}</span>
                {first && <span className="font-sans text-[10.5px] text-muted">{t('chain.caller')}</span>}
                {last && !first && <span className="font-sans text-[10.5px] text-muted">{t('chain.answered')}</span>}
              </li>
            </Fragment>
          )
        })}
      </ol>
    </div>
  )
}
