import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Check, Sparkles } from 'lucide-react'

import { Button, Dialog, ProgressBar, Spinner, toast } from '@/components/ui'
import { errorMessage, fieldError } from '@/api/client'
import { cn } from '@/lib/cn'
import type { Id } from '@/types'
import { useCreateSummary, useSummary } from '../api'

const MAX_CALLS = 10

/**
 * "Summarise" for 1-10 selected recordings: POST /summaries, show the two
 * stages (per call, then merge) while the digest is built, then open it.
 */
export function SummariseButton({
  recordingIds,
  disabled,
  variant = 'secondary',
  size = 'sm',
}: {
  recordingIds: Id[]
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'xs' | 'sm' | 'md'
}) {
  const { t } = useTranslation('analysis')
  const navigate = useNavigate()
  const create = useCreateSummary()
  const [pendingId, setPendingId] = useState<Id | null>(null)
  const digest = useSummary(pendingId ?? undefined)
  const handled = useRef<string | null>(null)

  const count = recordingIds.length
  const tooMany = count > MAX_CALLS
  const data = digest.data
  const stagesDone = data?.stages.length ?? 0

  useEffect(() => {
    if (!pendingId || !data || handled.current === pendingId) return
    if (data.status === 'done') {
      handled.current = pendingId
      toast.success(t('summarise.ready'))
      setPendingId(null)
      navigate(`/workspace/summaries/${pendingId}`)
    } else if (data.status === 'error') {
      handled.current = pendingId
      toast.error(t('summarise.failed'))
      setPendingId(null)
    }
  }, [data, pendingId, navigate, t])

  useEffect(() => {
    if (pendingId && digest.isError) {
      toast.error(errorMessage(digest.error, t('summarise.failed')))
      setPendingId(null)
    }
  }, [pendingId, digest.isError, digest.error, t])

  const start = () => {
    if (count === 0 || tooMany) return
    create.mutate(recordingIds, {
      onSuccess: (summary) => setPendingId(summary.id),
      onError: (e) => toast.error(fieldError(e, 'recording_ids') ?? errorMessage(e, t('summarise.failed'))),
    })
  }

  const steps: Array<{ key: 'per_call' | 'merge'; label: string }> = [
    { key: 'per_call', label: t('summarise.stage.per_call', { count }) },
    { key: 'merge', label: t('summarise.stage.merge') },
  ]

  return (
    <>
      <Button
        size={size}
        variant={variant}
        disabled={disabled || count === 0 || tooMany || create.isPending || !!pendingId}
        loading={create.isPending}
        icon={<Sparkles className="size-3.5" aria-hidden />}
        onClick={start}
        title={tooMany ? t('summarise.tooMany', { max: MAX_CALLS }) : undefined}
      >
        {t('summarise.button', { count })}
      </Button>

      <Dialog
        open={!!pendingId}
        onOpenChange={() => undefined}
        locked
        size="sm"
        title={t('summarise.title', { count })}
        description={t('summarise.description')}
      >
        <div className="space-y-4" aria-live="polite">
          <ProgressBar value={Math.min(100, 8 + stagesDone * 46)} />
          <ol className="space-y-2">
            {steps.map((step, i) => {
              const done = stagesDone > i
              const active = stagesDone === i
              return (
                <li key={step.key} className={cn('flex items-center gap-2.5 text-sm', done || active ? 'text-ink' : 'text-subtle')}>
                  <span
                    className={cn(
                      'grid size-5 shrink-0 place-items-center rounded-full border text-[10px]',
                      done ? 'border-success bg-success/15 text-success' : active ? 'border-primary text-primary' : 'border-line',
                    )}
                  >
                    {done ? <Check className="size-3" aria-hidden /> : active ? <Spinner size={12} /> : i + 1}
                  </span>
                  <span>{step.label}</span>
                  {done && data ? <span className="tabular ml-auto text-xs text-muted">{(data.stages[i]!.ms / 1000).toFixed(1)} s</span> : null}
                </li>
              )
            })}
          </ol>
        </div>
      </Dialog>
    </>
  )
}
