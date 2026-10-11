import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { HelpCircle, MessageSquareText, Plus, RotateCcw, Save } from 'lucide-react'

import { errorMessage, fieldError, isApiError } from '@/api/client'
import { Button, Card, EmptyState, ErrorState, PageHeader, SegmentedControl, Skeleton, Switch, toast } from '@/components/ui'
import { useBusEvent } from '@/lib/realtime'
import type { ContentLang, FaqNode, FaqOption, FaqTree } from '@/types'

import { useFaq, useSaveFaq } from '../api'
import { FaqCanvas, NODE_W, nodeHeight } from '../components/FaqCanvas'
import { FaqInspector } from '../components/FaqInspector'
import { BackLink, Notice } from '../components/shared'
import { validateFaqTree } from '../faqValidation'
import type { FaqIssue, FaqState } from '../types'

const clone = <T,>(value: T): T => structuredClone(value)
let counter = 0
const uid = (prefix: string) => `${prefix}${Date.now().toString(36)}${(counter++).toString(36)}`

export default function FaqEditorPage() {
  const { t } = useTranslation(['adminIntegrations', 'common'])
  const query = useFaq()
  const save = useSaveFaq()
  const [draft, setDraft] = useState<FaqState | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [previewLang, setPreviewLang] = useState<ContentLang>('en')
  const [showIssues, setShowIssues] = useState(false)
  const [focusRequest, setFocusRequest] = useState<{ id: string; n: number } | null>(null)
  const server = query.data

  useEffect(() => {
    if (!draft && server) {
      setDraft(clone(server))
      setSelectedId(server.tree.rootIds[0] ?? null)
    }
  }, [draft, server])
  useBusEvent('demo:reset', () => {
    setDraft(null)
    setShowIssues(false)
  })

  const dirty = useMemo(() => !!draft && !!server && JSON.stringify(draft) !== JSON.stringify(server), [draft, server])
  const issues: FaqIssue[] = useMemo(() => (draft && showIssues ? validateFaqTree(draft.tree) : []), [draft, showIssues])
  const issueNodeIds = useMemo(() => new Set(issues.map((issue) => issue.nodeId)), [issues])

  const patchTree = useCallback((fn: (tree: FaqTree) => void) => {
    setDraft((current) => {
      if (!current) return current
      const tree = clone(current.tree)
      fn(tree)
      return { ...current, tree }
    })
  }, [])

  const focusNode = useCallback((id: string) => {
    setSelectedId(id)
    setFocusRequest((current) => ({ id, n: (current?.n ?? 0) + 1 }))
    requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById(`faq-node-${id}`)?.focus({ preventScroll: true })))
  }, [])

  const moveNode = useCallback(
    (id: string, position: { x: number; y: number }) =>
      setDraft((current) => {
        if (!current?.tree.nodes[id]) return current
        return { ...current, tree: { ...current.tree, nodes: { ...current.tree.nodes, [id]: { ...current.tree.nodes[id], position } } } }
      }),
    [],
  )

  const connect = useCallback(
    (nodeId: string, optionId: string, targetId: string) => patchTree((tree) => {
      const option = tree.nodes[nodeId]?.options.find((item) => item.id === optionId)
      if (option) {
        option.nextId = targetId
        option.transferToOperator = false
      }
    }),
    [patchTree],
  )

  const patchNode = (id: string, patch: Partial<FaqNode>) => patchTree((tree) => {
    const node = tree.nodes[id]
    if (node) Object.assign(node, patch)
  })

  const patchOption = (nodeId: string, optionId: string, patch: Partial<FaqOption>) => patchTree((tree) => {
    const option = tree.nodes[nodeId]?.options.find((item) => item.id === optionId)
    if (option) Object.assign(option, patch)
  })

  const addOption = (nodeId: string) => patchTree((tree) => {
    tree.nodes[nodeId]?.options.push({ id: uid('opt_'), label: { ka: '', en: '', ru: '' }, nextId: null, transferToOperator: false })
  })

  const removeOption = (nodeId: string, optionId: string) => patchTree((tree) => {
    const node = tree.nodes[nodeId]
    if (node) node.options = node.options.filter((option) => option.id !== optionId)
  })

  const deleteNode = (id: string) => {
    if (!draft || draft.tree.rootIds.includes(id)) return
    patchTree((tree) => {
      delete tree.nodes[id]
      for (const node of Object.values(tree.nodes)) {
        for (const option of node.options) if (option.nextId === id) option.nextId = null
      }
    })
    setSelectedId(draft.tree.rootIds[0] ?? null)
  }

  const addNode = (type: 'question' | 'answer') => {
    if (!draft) return
    const id = uid(type === 'question' ? 'faq_q_' : 'faq_a_')
    // Drop it below the lowest node, in the column of the selected one.
    const all = Object.values(draft.tree.nodes)
    const anchor = (selectedId && draft.tree.nodes[selectedId]) || all[0]
    const bottom = all.reduce((max, node) => Math.max(max, node.position.y + nodeHeight(node)), 0)
    const node: FaqNode = {
      id,
      type,
      text: type === 'question' ? { ka: 'ახალი კითხვა', en: 'New question', ru: 'Новый вопрос' } : { ka: 'ახალი პასუხი', en: 'New answer', ru: 'Новый ответ' },
      position: { x: (anchor?.position.x ?? 0) + (all.length % 2 === 0 ? 0 : NODE_W + 40), y: bottom + 40 },
      options: type === 'question' ? [{ id: uid('opt_'), label: { ka: 'ვარიანტი', en: 'Option', ru: 'Вариант' }, nextId: null, transferToOperator: false }] : [],
    }
    patchTree((tree) => {
      tree.nodes[id] = node
    })
    focusNode(id)
  }

  const discard = () => {
    if (!server) return
    setDraft(clone(server))
    setSelectedId(server.tree.rootIds[0] ?? null)
    setShowIssues(false)
  }

  const submit = async () => {
    if (!draft) return
    const found = validateFaqTree(draft.tree)
    if (found.length > 0) {
      setShowIssues(true)
      const first = found[0]
      if (first?.nodeId) focusNode(first.nodeId)
      toast.error(t('faq.toast.invalid', { count: new Set(found.map((issue) => issue.nodeId)).size }))
      return
    }
    try {
      const saved = await save.mutateAsync({ faqEnabled: draft.faqEnabled, faqShowOperatorButton: draft.faqShowOperatorButton, tree: draft.tree })
      setDraft(clone(saved))
      setShowIssues(false)
      toast.success(t('faq.toast.saved'))
    } catch (error) {
      if (isApiError(error) && fieldError(error, 'tree')) {
        setShowIssues(true)
        const first = error.fieldErrors.nodes?.[0]
        if (first) focusNode(first)
        toast.error(t('faq.toast.invalid', { count: error.fieldErrors.nodes?.length ?? 1 }))
      } else {
        toast.error(errorMessage(error))
      }
    }
  }

  const header = (
    <>
      <BackLink />
      <PageHeader
        title={t('faq.title')}
        description={t('faq.description')}
        meta={dirty ? <span className="rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-medium text-ink">{t('faq.unsaved')}</span> : null}
        actions={
          <>
            <Button variant="secondary" leftIcon={<RotateCcw size={16} strokeWidth={1.75} />} disabled={!dirty || save.isPending} onClick={discard}>
              {t('faq.discard')}
            </Button>
            <Button leftIcon={<Save size={16} strokeWidth={1.75} />} loading={save.isPending} disabled={!draft || (!dirty && !showIssues)} onClick={() => void submit()}>
              {t('common:actions.save')}
            </Button>
          </>
        }
      />
    </>
  )

  if (query.isError && !server) {
    return (
      <div>
        {header}
        <ErrorState title={t('faq.loadError')} description={errorMessage(query.error)} onRetry={() => void query.refetch()} retryLabel={t('common:actions.retry')} />
      </div>
    )
  }

  if (!draft) {
    return (
      <div>
        {header}
        <Skeleton className="mb-4 h-20 w-full" />
        <Skeleton className="h-[460px] w-full" />
      </div>
    )
  }

  const nodeCount = Object.keys(draft.tree.nodes).length
  const selected = selectedId ? (draft.tree.nodes[selectedId] ?? null) : null
  const problemNodes = [...issueNodeIds]

  return (
    <div>
      {header}

      <Card className="mb-4 grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-center">
        <Switch labelFirst label={t('faq.enabled')} description={t('faq.enabledHint')} checked={draft.faqEnabled} onCheckedChange={(faqEnabled) => setDraft({ ...draft, faqEnabled })} />
        <Switch
          labelFirst
          label={t('faq.showOperator')}
          description={t('faq.showOperatorHint')}
          checked={draft.faqShowOperatorButton}
          onCheckedChange={(faqShowOperatorButton) => setDraft({ ...draft, faqShowOperatorButton })}
        />
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted">{t('faq.previewLanguage')}</span>
          <SegmentedControl<ContentLang>
            aria-label={t('faq.previewLanguage')}
            size="sm"
            value={previewLang}
            onChange={setPreviewLang}
            options={[
              { value: 'ka', label: t('common:lang.ka') },
              { value: 'en', label: t('common:lang.en') },
              { value: 'ru', label: t('common:lang.ru') },
            ]}
          />
        </div>
      </Card>

      {issues.length > 0 ? (
        <Notice tone="danger" className="mb-4" title={t('faq.problemsTitle', { count: problemNodes.length })}>
          <ul className="mt-1 flex flex-wrap gap-2">
            {problemNodes.map((id) => (
              <li key={id}>
                <button type="button" className="rounded-full border border-danger/40 bg-panel px-2.5 py-0.5 text-xs text-ink hover:bg-hover" onClick={() => focusNode(id)}>
                  {draft.tree.nodes[id]?.text[previewLang] || draft.tree.nodes[id]?.text.en || t('faq.node.empty')}
                </button>
              </li>
            ))}
          </ul>
        </Notice>
      ) : null}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">{t('faq.nodeCount', { count: nodeCount })}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" leftIcon={<HelpCircle size={16} strokeWidth={1.75} />} onClick={() => addNode('question')}>
            {t('faq.addQuestion')}
          </Button>
          <Button variant="outline" size="sm" leftIcon={<MessageSquareText size={16} strokeWidth={1.75} />} onClick={() => addNode('answer')}>
            {t('faq.addAnswer')}
          </Button>
        </div>
      </div>

      {nodeCount === 0 ? (
        <EmptyState title={t('faq.empty.title')} description={t('faq.empty.description')} action={<Button leftIcon={<Plus size={16} strokeWidth={1.75} />} onClick={() => addNode('question')}>{t('faq.addQuestion')}</Button>} />
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
          <FaqCanvas
            tree={draft.tree}
            lang={previewLang}
            selectedId={selectedId}
            issueNodeIds={issueNodeIds}
            focusRequest={focusRequest}
            onSelect={setSelectedId}
            onMove={moveNode}
            onConnect={connect}
          />
          <FaqInspector
            node={selected}
            tree={draft.tree}
            lang={previewLang}
            issues={issues}
            onPatchNode={patchNode}
            onPatchOption={patchOption}
            onAddOption={addOption}
            onRemoveOption={removeOption}
            onDeleteNode={deleteNode}
          />
        </div>
      )}
    </div>
  )
}
