import { RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge, Button, Callout, ConfirmDialog, Field, Input, PageHeader, ReadOnlyNote, Skeleton, toast } from '@/components/ui'
import { ApiError } from '@/lib/api'
import { useFormat } from '@/lib/format'
import { useCanEdit } from '@/lib/session'
import { errorMessage, useResetRubric, useRubric, useSaveRubric, type RubricDraft } from '../api'
import BandsCard from '../components/BandsCard'
import RubricEditor, { type IncomingDraft } from '../components/RubricEditor'
import RubricImport from '../components/RubricImport'

/** Scoring rubric + score bands for the workspace. OWNED BY: workspace-settings. */
export default function RubricPage() {
  const { t } = useTranslation('settings')
  const f = useFormat()
  const canEdit = useCanEdit()
  const rubric = useRubric()
  const save = useSaveRubric()
  const reset = useResetRubric()
  const [incoming, setIncoming] = useState<IncomingDraft | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [resetError, setResetError] = useState<string | null>(null)

  const data = rubric.data

  const onDraft = (draft: RubricDraft, filename: string) => {
    setIncoming({ ...draft, filename, id: `${Date.now()}` })
  }

  const doReset = async () => {
    setResetError(null)
    try {
      await reset.mutateAsync(password)
      setIncoming(null)
      setResetOpen(false)
      setPassword('')
      toast.success(t('reset.done'))
    } catch (error) {
      setResetError(error instanceof ApiError && error.status === 403 ? t('reset.wrong') : errorMessage(error, t('reset.failed')))
    }
  }

  return (
    <section>
      <PageHeader
        title={t('rubric.title')}
        description={t('rubric.subtitle')}
        meta={
          data ? (
            <>
              <Badge tone="primary" className="tabular">{t('rubric.version', { n: data.version })}</Badge>
              {data.is_default ? <Badge tone="neutral">{t('rubric.sharedBadge')}</Badge> : null}
              {data.updated_by ? (
                <span className="text-xs text-muted">{t('rubric.lastSaved', { when: f.relative(data.updated_at), who: data.updated_by })}</span>
              ) : null}
            </>
          ) : null
        }
        actions={
          canEdit && data && !data.is_default ? (
            <Button variant="secondary" icon={<RotateCcw />} onClick={() => setResetOpen(true)}>
              {t('reset.button')}
            </Button>
          ) : undefined
        }
      />

      <div className="max-w-5xl space-y-6">
        {canEdit ? null : <ReadOnlyNote />}

        {rubric.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : rubric.isError || !data ? (
          <Callout tone="danger" action={<Button size="sm" onClick={() => void rubric.refetch()}>{t('retry')}</Button>}>
            {t('loadError')}
          </Callout>
        ) : (
          <>
            {data.is_default ? (
              <Callout tone="info" title={t('rubric.shared.title')}>
                {t('rubric.shared.body', { version: data.default_version })}
              </Callout>
            ) : null}
            <RubricEditor
              key={`${data.id}:${data.version}:${data.is_default}`}
              initial={{ dimensions: data.dimensions, rubric: data.rubric }}
              incoming={incoming}
              readOnly={!canEdit}
              saving={save.isPending}
              onDiscardIncoming={() => setIncoming(null)}
              toolbar={
                canEdit ? (
                  <div className="flex flex-wrap items-center gap-3 rounded-card border border-line bg-sunken p-3">
                    <RubricImport onDraft={onDraft} />
                    <p className="min-w-0 flex-1 text-xs text-muted">{t('import.hint')}</p>
                  </div>
                ) : null
              }
              onSave={async (draft) => {
                const saved = await save.mutateAsync(draft)
                setIncoming(null)
                toast.success(t('rubric.savedToast', { n: saved.version }))
              }}
            />
          </>
        )}

        <BandsCard />
      </div>

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={(open) => {
          setResetOpen(open)
          if (!open) {
            setPassword('')
            setResetError(null)
          }
        }}
        danger
        title={t('reset.title')}
        body={t('reset.body')}
        confirmLabel={t('reset.confirm')}
        confirmDisabled={!password}
        onConfirm={doReset}
      >
        <Field label={t('reset.password')} hint={t('reset.passwordHint')} error={resetError}>
          <Input
            type="password"
            autoComplete="off"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setResetError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && password) void doReset()
            }}
          />
        </Field>
      </ConfirmDialog>
    </section>
  )
}
