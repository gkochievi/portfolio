/** Global analysis instructions: free text appended to every analyser prompt. */
import { useEffect, useState } from 'react'
import { NotebookPen } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { errorMessage, fieldError } from '@/api/client'
import { Button, Field, Panel, Textarea, toast } from '@/components/ui'
import { formatNumber } from '@/lib/format'
import { useInstructions, useSaveInstructions } from '../api'
import { QueryState } from './bits'

export function InstructionsCard() {
  const { t, i18n } = useTranslation('consoleAi')
  const query = useInstructions()
  const save = useSaveInstructions()
  const [text, setText] = useState('')
  const [error, setError] = useState<string | undefined>()
  const saved = query.data?.instructions ?? ''
  const max = query.data?.max_length ?? 4000

  useEffect(() => {
    if (query.data) setText(query.data.instructions)
  }, [query.data])

  const dirty = text.trim() !== saved.trim()
  const tooLong = text.length > max

  const submit = async () => {
    setError(undefined)
    if (tooLong) return setError(t('instructions.errTooLong', { max: formatNumber(max, i18n.language) }))
    try {
      await save.mutateAsync(text)
      toast.success(t('instructions.saved'))
    } catch (e) {
      setError(fieldError(e, 'instructions') ?? errorMessage(e))
    }
  }

  return (
    <Panel title={t('instructions.title')} description={t('instructions.description')} icon={<NotebookPen />}>
      <QueryState loading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} rows={2}>
        <Field label={t('instructions.label')} error={error} hint={t('instructions.hint')}>
          <Textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('instructions.placeholder')} />
        </Field>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <span className={tooLong ? 'tabular text-xs text-danger' : 'tabular text-xs text-muted'}>
            {formatNumber(text.length, i18n.language)} / {formatNumber(max, i18n.language)}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" disabled={!dirty || save.isPending} onClick={() => { setText(saved); setError(undefined) }}>
              {t('discard')}
            </Button>
            <Button variant="primary" disabled={!dirty} loading={save.isPending} onClick={submit} className="min-w-24">
              {t('save')}
            </Button>
          </div>
        </div>
      </QueryState>
    </Panel>
  )
}
