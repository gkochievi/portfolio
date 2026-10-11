import { AudioLines, ClipboardCheck, FileText, ShieldCheck, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, toast } from '@/components/ui'
import type { Recording } from '@/types'
import { runAllAtOnce, type ResultKey, type RunKey } from '../api'

export const RESULT_ICON = {
  factcheck: ShieldCheck,
  score: ClipboardCheck,
  semantic: AudioLines,
  summary: FileText,
} as const

const RAN_FLAG: Record<ResultKey, keyof Recording['ran']> = {
  factcheck: 'factcheck',
  score: 'score',
  semantic: 'semantic',
  summary: 'summary',
}

export function RunBar({
  rec,
  run,
  runningKeys,
}: {
  rec: Recording
  run: (keys: RunKey[]) => void
  runningKeys: readonly string[]
}) {
  const { t } = useTranslation('workbench')
  const [stage, setStage] = useState<null | 'transcribe' | 'parallel' | 'score'>(null)
  const transcribing = rec.status === 'transcribing'
  const ready = rec.segments.length > 0 && !transcribing
  const allBusy = stage !== null

  const runAll = async () => {
    setStage('transcribe')
    try {
      const result = await runAllAtOnce(rec.id, setStage)
      if (result.failed.length === 0) toast.success(t('run.allDone'))
      else
        toast.warning(
          t('run.allPartial', {
            ok: result.ok.length,
            failed: result.failed.map((f) => t(`analysers.${f.key}`)).join(', '),
          }),
          { description: result.failed[0]?.message },
        )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('run.failed'))
    } finally {
      setStage(null)
    }
  }

  return (
    <div className="rounded-card border border-line bg-panel p-3">
      <div className="flex flex-wrap items-center gap-2">
        {(['factcheck', 'score', 'semantic', 'summary'] as const).map((key) => {
          const Icon = RESULT_ICON[key]
          const busy = runningKeys.includes(key)
          const done = rec.ran[RAN_FLAG[key]]
          return (
            <Button
              key={key}
              variant="secondary"
              size="sm"
              icon={<Icon className="size-4" />}
              loading={busy}
              disabled={!ready || allBusy}
              onClick={() => run([key])}
              className="min-w-28"
            >
              {done ? t('run.rerun', { name: t(`analysers.${key}`) }) : t('run.run', { name: t(`analysers.${key}`) })}
            </Button>
          )
        })}
        <Button
          variant="primary"
          size="sm"
          icon={<Sparkles className="size-4" />}
          loading={allBusy}
          disabled={transcribing || (rec.status === 'error' && rec.source === 'text')}
          onClick={() => void runAll()}
          className="min-w-32 sm:ml-auto"
        >
          {allBusy ? t(`run.stage.${stage}`) : t('run.all')}
        </Button>
      </div>
      {!ready && !transcribing ? <p className="mt-2 text-xs text-muted">{t('run.needsTranscript')}</p> : null}
    </div>
  )
}
