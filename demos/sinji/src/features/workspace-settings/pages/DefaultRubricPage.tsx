import { useTranslation } from 'react-i18next'

import { Badge, Button, Callout, Skeleton, toast } from '@/components/ui'
import { useFormat } from '@/lib/format'
import { useDefaultRubric, useSaveDefaultRubric } from '../api'
import RubricEditor from '../components/RubricEditor'

/** The global default rubric (operator, inside the console). OWNED BY: workspace-settings. */
export default function DefaultRubricPage() {
  const { t } = useTranslation('settings')
  const f = useFormat()
  const query = useDefaultRubric()
  const save = useSaveDefaultRubric()
  const data = query.data

  return (
    <section className="max-w-5xl space-y-5">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-2xl font-semibold">{t('defaultRubric.title')}</h2>
          {data ? (
            <>
              <Badge tone="primary" className="tabular">{t('rubric.version', { n: data.version })}</Badge>
              <Badge tone={data.source === 'saved' ? 'accent' : 'neutral'}>{t(`defaultRubric.source.${data.source}`)}</Badge>
            </>
          ) : null}
        </div>
        <p className="mt-1 max-w-3xl text-[15px] text-muted">{t('defaultRubric.description')}</p>
        {data?.updated_by ? <p className="mt-1 text-xs text-muted">{t('rubric.lastSaved', { when: f.relative(data.updated_at), who: data.updated_by })}</p> : null}
      </header>

      {query.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : query.isError || !data ? (
        <Callout tone="danger" action={<Button size="sm" onClick={() => void query.refetch()}>{t('retry')}</Button>}>
          {t('loadError')}
        </Callout>
      ) : (
        <>
          <Callout tone="info">{t('defaultRubric.note')}</Callout>
          <RubricEditor
            key={`${data.version}:${data.source}`}
            initial={{ dimensions: data.dimensions, rubric: data.rubric }}
            readOnly={false}
            allowValidate
            saving={save.isPending}
            onSave={async (draft) => {
              const saved = await save.mutateAsync(draft)
              toast.success(t('defaultRubric.saved', { n: saved.version }))
            }}
          />
        </>
      )}
    </section>
  )
}
