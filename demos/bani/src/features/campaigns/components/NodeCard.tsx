/** Health card for one contact-centre node. */
import { AlertTriangle, Server } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Card, CardBody, Mono, StatusChip } from '@/components/ui'
import { cn } from '@/lib/cn'
import { fmtNumber, fmtUptime } from '@/lib/format'
import { useLang } from '@/shell/state'
import type { CcNode } from '@/types'

function barTone(pct: number): string {
  if (pct >= 90) return 'bg-danger'
  if (pct >= 75) return 'bg-warning'
  return 'bg-success'
}

function Meter({ label, pct, detail }: { label: string; pct: number | null; detail?: string }) {
  const value = pct == null ? 0 : Math.min(100, Math.max(0, pct))
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
        <span className="text-muted">{label}</span>
        <span className="font-mono tabular font-semibold text-ink">{pct == null ? '-' : `${Math.round(pct)}%`}</span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct == null ? undefined : Math.round(value)}
        className="h-2 overflow-hidden rounded-full bg-sunken"
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-700 ease-out', pct == null ? 'bg-line' : barTone(value))}
          style={{ width: `${value}%` }}
        />
      </div>
      {detail && <div className="mt-1 font-mono text-[12px] tabular text-muted">{detail}</div>}
    </div>
  )
}

export function NodeCard({ node }: { node: CcNode }) {
  const { t } = useTranslation('campaigns')
  const lang = useLang()
  const up = node.status === 'up'
  const usedMB = node.memory ? node.memory.totalMB - node.memory.availableMB : null

  return (
    <Card className={cn(!up && 'border-danger/40')}>
      <CardBody className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className={cn(
                'mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px]',
                up ? 'bg-pine/10 text-pine' : 'bg-danger/12 text-danger',
              )}
            >
              <Server size={18} strokeWidth={1.75} aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-[16px] font-semibold text-ink">{node.label}</h2>
              <div className="truncate font-mono text-[12.5px] text-muted" title={node.host}>
                {node.host}
              </div>
              <div className="text-[12.5px] text-faint">
                {t('nodes.sysName')}: <Mono muted>{node.sysName}</Mono>
              </div>
            </div>
          </div>
          <StatusChip tone={up ? 'success' : 'danger'}>{up ? t('nodes.up') : t('nodes.down')}</StatusChip>
        </div>

        {up ? (
          <>
            <Meter label={t('nodes.cpu')} pct={node.cpuPct} />
            <Meter
              label={t('nodes.memory')}
              pct={node.memory?.usedPct ?? null}
              detail={
                node.memory && usedMB != null
                  ? t('nodes.memoryDetail', { used: fmtNumber(usedMB, lang), total: fmtNumber(node.memory.totalMB, lang) })
                  : undefined
              }
            />
          </>
        ) : (
          <div className="flex items-start gap-2 rounded-[8px] bg-danger/10 px-3 py-2.5 text-[13px] text-danger" role="alert">
            <AlertTriangle size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />
            <div className="min-w-0">
              <div className="font-medium">{t('nodes.unreachable')}</div>
              <div className="break-words">{node.error ?? t('nodes.noReply')}</div>
            </div>
          </div>
        )}

        <div className="flex items-baseline justify-between gap-3 border-t border-line pt-3 text-[13px]">
          <span className="text-muted">{t('nodes.uptime')}</span>
          <span className="font-mono tabular font-semibold text-ink">{up ? fmtUptime(node.uptimeSeconds, lang) : '-'}</span>
        </div>
      </CardBody>
    </Card>
  )
}
