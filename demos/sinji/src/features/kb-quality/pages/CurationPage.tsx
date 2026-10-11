import { CheckCheck, ListChecks, RefreshCw, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Button,
  Callout,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  PageHeader,
  ReadOnlyNote,
  Skeleton,
  StatTile,
  Tabs,
  Textarea,
  toast,
} from '@/components/ui'
import { useCanEdit } from '@/lib/session'
import type { CurationProposal } from '@/types'
import { useAcceptProposal, useBulkAccept, useCurationLive, useDeclineProposal, useProposals, useRunCuration } from '../api'
import { errorText } from '../components/bits'
import { ProposalCard } from '../components/ProposalCard'

type Dialogs =
  | { kind: 'edit'; proposal: CurationProposal }
  | { kind: 'decline'; proposal: CurationProposal }
  | { kind: 'remove'; proposal: CurationProposal }
  | { kind: 'bulk' }
  | null

function groupByCluster(items: CurationProposal[]): Array<[string, CurationProposal[]]> {
  const groups = new Map<string, CurationProposal[]>()
  for (const item of items) groups.set(item.cluster, [...(groups.get(item.cluster) ?? []), item])
  return [...groups]
}

export default function CurationPage() {
  const { t } = useTranslation('kbQuality')
  const canEdit = useCanEdit()
  useCurationLive()
  const pending = useProposals('pending')
  const accepted = useProposals('accepted')
  const declined = useProposals('declined')
  const accept = useAcceptProposal()
  const decline = useDeclineProposal()
  const bulk = useBulkAccept()
  const run = useRunCuration()

  const [tab, setTab] = useState<CurationProposal['state']>('pending')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dialog, setDialog] = useState<Dialogs>(null)
  const [draft, setDraft] = useState('')
  const [draftError, setDraftError] = useState<string | undefined>()
  const [mining, setMining] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const pendingItems = useMemo(() => pending.data ?? [], [pending.data])
  // Drop selections for proposals that are no longer pending (decided here or in another tab).
  useEffect(() => {
    setSelected((prev) => {
      const ids = new Set(pendingItems.filter((p) => p.op !== 'remove').map((p) => p.id))
      const next = new Set([...prev].filter((id) => ids.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [pendingItems])

  const highPriority = pendingItems.filter((p) => p.priority === 'high').length
  const bulkable = pendingItems.filter((p) => p.op !== 'remove')

  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  const doAccept = async (proposal: CurationProposal, content?: string) => {
    setBusyId(proposal.id)
    try {
      await accept.mutateAsync({ id: proposal.id, ...(content !== undefined ? { content } : {}) })
      toast.success(t(`curation.toast.accepted.${proposal.op}`))
      return true
    } catch (error) {
      toast.error(errorText(error, t('common.actionError')))
      return false
    } finally {
      setBusyId(null)
    }
  }

  const onAccept = (proposal: CurationProposal) => {
    if (proposal.op === 'remove') setDialog({ kind: 'remove', proposal })
    else void doAccept(proposal)
  }

  const openEdit = (proposal: CurationProposal) => {
    setDraft(proposal.proposed_content)
    setDraftError(undefined)
    setDialog({ kind: 'edit', proposal })
  }
  const openDecline = (proposal: CurationProposal) => {
    setDraft('')
    setDraftError(undefined)
    setDialog({ kind: 'decline', proposal })
  }

  const submitEdit = async () => {
    if (dialog?.kind !== 'edit') return
    if (!draft.trim()) return setDraftError(t('curation.edit.required'))
    if (await doAccept(dialog.proposal, draft)) setDialog(null)
  }

  const submitDecline = async () => {
    if (dialog?.kind !== 'decline') return
    if (!draft.trim()) return setDraftError(t('curation.decline.required'))
    try {
      await decline.mutateAsync({ id: dialog.proposal.id, reason: draft.trim() })
      toast.success(t('curation.toast.declined'))
      setDialog(null)
    } catch (error) {
      setDraftError(errorText(error, t('common.actionError')))
    }
  }

  const submitBulk = async () => {
    try {
      const result = await bulk.mutateAsync([...selected])
      setSelected(new Set())
      toast.success(t('curation.toast.bulk', { count: result.accepted }))
    } catch (error) {
      toast.error(errorText(error, t('common.actionError')))
    }
  }

  const runNow = async () => {
    try {
      const result = await run.mutateAsync()
      if (result.added === 0) {
        toast.info(t('curation.toast.runNone'))
        return
      }
      setMining(true)
      toast.info(t('curation.toast.runStarted'))
      setTimeout(() => {
        setMining(false)
        toast.success(t('curation.toast.runDone', { count: result.added }))
      }, 2300)
    } catch (error) {
      toast.error(errorText(error, t('common.actionError')))
    }
  }

  const refreshAll = () => {
    void pending.refetch()
    void accepted.refetch()
    void declined.refetch()
  }

  const renderList = (query: ReturnType<typeof useProposals>, state: CurationProposal['state']) => {
    if (query.isLoading) {
      return (
        <div className="space-y-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )
    }
    if (query.isError) {
      return (
        <Callout tone="danger" title={t('common.loadError')} action={<Button size="sm" onClick={() => void query.refetch()}>{t('common.retry')}</Button>}>
          {errorText(query.error, t('common.loadError'))}
        </Callout>
      )
    }
    const items = query.data ?? []
    if (items.length === 0) {
      return <EmptyState icon={<ListChecks className="size-5" />} title={t(`curation.empty.${state}.title`)} body={t(`curation.empty.${state}.body`)} />
    }
    return (
      <div className="space-y-8">
        {groupByCluster(items).map(([cluster, group]) => (
          <section key={cluster} aria-label={cluster}>
            <h2 className="mb-3 flex items-baseline gap-2 text-sm font-medium text-muted">
              <span className="caps text-[11px]">{t('curation.cluster')}</span>
              <span className="text-ink">{cluster}</span>
              <span className="tabular text-xs">({group.length})</span>
            </h2>
            <div className="space-y-4">
              {group.map((proposal) => (
                <ProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  canEdit={canEdit}
                  selected={selected.has(proposal.id)}
                  onSelect={(on) => toggle(proposal.id, on)}
                  onAccept={() => onAccept(proposal)}
                  onEdit={() => openEdit(proposal)}
                  onDecline={() => openDecline(proposal)}
                  busy={busyId === proposal.id}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={t('curation.title')}
        description={t('curation.description')}
        actions={
          <>
            <Button variant="secondary" size="sm" icon={<RefreshCw className="size-4" />} onClick={refreshAll}>
              {t('common.refresh')}
            </Button>
            {canEdit ? (
              <Button variant="accent" size="sm" loading={run.isPending || mining} icon={<Sparkles className="size-4" />} onClick={() => void runNow()}>
                {mining ? t('curation.mining') : t('curation.runNow')}
              </Button>
            ) : null}
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label={t('curation.stats.pending')} value={String(pendingItems.length)} />
        <StatTile label={t('curation.stats.high')} value={String(highPriority)} tone={highPriority > 0 ? 'danger' : undefined} />
        <StatTile label={t('curation.stats.accepted')} value={String(accepted.data?.length ?? 0)} />
        <StatTile label={t('curation.stats.declined')} value={String(declined.data?.length ?? 0)} />
      </div>

      {!canEdit ? <ReadOnlyNote>{t('curation.readOnly')}</ReadOnlyNote> : null}

      {canEdit && tab === 'pending' && bulkable.length > 0 ? (
        <div className="sticky top-2 z-10 mb-4 flex flex-wrap items-center gap-2 rounded-card border border-line bg-panel/95 px-4 py-2.5 backdrop-blur">
          <span className="text-sm text-muted">
            {selected.size > 0 ? t('curation.selected', { count: selected.size }) : t('curation.bulkHint')}
          </span>
          <span className="ml-auto" />
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setSelected(selected.size === bulkable.length ? new Set() : new Set(bulkable.map((p) => p.id)))}
          >
            {selected.size === bulkable.length ? t('curation.clearSelection') : t('curation.selectAll')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={selected.size === 0}
            loading={bulk.isPending}
            icon={<CheckCheck className="size-4" />}
            onClick={() => setDialog({ kind: 'bulk' })}
          >
            {t('curation.bulkAccept')}
          </Button>
        </div>
      ) : null}

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as CurationProposal['state'])}
        items={[
          { value: 'pending', label: t('curation.tabs.pending'), count: pendingItems.length, content: <div className="pt-5">{renderList(pending, 'pending')}</div> },
          { value: 'accepted', label: t('curation.tabs.accepted'), count: accepted.data?.length ?? 0, content: <div className="pt-5">{renderList(accepted, 'accepted')}</div> },
          { value: 'declined', label: t('curation.tabs.declined'), count: declined.data?.length ?? 0, content: <div className="pt-5">{renderList(declined, 'declined')}</div> },
        ]}
      />

      <Dialog
        open={dialog?.kind === 'edit'}
        onOpenChange={(open) => !open && setDialog(null)}
        size="lg"
        title={t('curation.edit.title')}
        description={t('curation.edit.description')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" loading={accept.isPending} onClick={() => void submitEdit()}>
              {t('curation.edit.submit')}
            </Button>
          </>
        }
      >
        <Field label={t('curation.edit.label')} error={draftError}>
          <Textarea rows={9} value={draft} onChange={(e) => setDraft(e.target.value)} />
        </Field>
      </Dialog>

      <Dialog
        open={dialog?.kind === 'decline'}
        onOpenChange={(open) => !open && setDialog(null)}
        title={t('curation.decline.title')}
        description={t('curation.decline.description')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" loading={decline.isPending} onClick={() => void submitDecline()}>
              {t('curation.decline.submit')}
            </Button>
          </>
        }
      >
        <Field label={t('curation.decline.label')} error={draftError}>
          <Textarea rows={4} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t('curation.decline.placeholder')} />
        </Field>
      </Dialog>

      <ConfirmDialog
        open={dialog?.kind === 'remove'}
        onOpenChange={(open) => !open && setDialog(null)}
        title={t('curation.removeConfirm.title')}
        body={t('curation.removeConfirm.body', { title: dialog?.kind === 'remove' ? (dialog.proposal.target?.title ?? dialog.proposal.title) : '' })}
        confirmLabel={t('curation.removeConfirm.confirm')}
        danger
        onConfirm={async () => {
          if (dialog?.kind === 'remove') await doAccept(dialog.proposal)
        }}
      />

      <ConfirmDialog
        open={dialog?.kind === 'bulk'}
        onOpenChange={(open) => !open && setDialog(null)}
        title={t('curation.bulkConfirm.title', { count: selected.size })}
        body={t('curation.bulkConfirm.body')}
        confirmLabel={t('curation.bulkAccept')}
        onConfirm={submitBulk}
      />
    </div>
  )
}
