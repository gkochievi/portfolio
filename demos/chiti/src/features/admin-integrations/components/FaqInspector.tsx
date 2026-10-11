/**
 * Side inspector of the FAQ editor: node text (ka / en / ru), options with a
 * target select (the keyboard-accessible alternative to dragging a handle),
 * the transfer-to-operator flag and node deletion.
 */
import { useTranslation } from 'react-i18next'
import { Plus, Trash2 } from 'lucide-react'

import { Badge, Button, Card, Field, IconButton, LocalizedTextField, Select, Switch } from '@/components/ui'
import { pickText } from '@/lib/format'
import type { ContentLang, FaqNode, FaqOption, FaqTree } from '@/types'
import type { FaqIssue } from '../types'

const NONE = '__none'
const OPERATOR = '__operator'

interface Props {
  node: FaqNode | null
  tree: FaqTree
  lang: ContentLang
  issues: FaqIssue[]
  onPatchNode: (id: string, patch: Partial<FaqNode>) => void
  onPatchOption: (nodeId: string, optionId: string, patch: Partial<FaqOption>) => void
  onAddOption: (nodeId: string) => void
  onRemoveOption: (nodeId: string, optionId: string) => void
  onDeleteNode: (id: string) => void
}

export function FaqInspector({ node, tree, lang, issues, onPatchNode, onPatchOption, onAddOption, onRemoveOption, onDeleteNode }: Props) {
  const { t } = useTranslation('adminIntegrations')

  if (!node) {
    return (
      <Card className="flex h-full min-h-40 items-center justify-center text-center text-sm text-muted">
        <p className="max-w-60">{t('faq.inspector.empty')}</p>
      </Card>
    )
  }

  const isRoot = tree.rootIds.includes(node.id)
  const mine = issues.filter((issue) => issue.nodeId === node.id)
  const nodeIssues = mine.filter((issue) => !issue.optionId)
  const optionIssue = (optionId: string) => mine.filter((issue) => issue.optionId === optionId)
  const preview = (id: string) => {
    const target = tree.nodes[id]
    const text = target ? pickText(target.text, lang) : ''
    return `${t(`faq.node.${target?.type ?? 'question'}`)}: ${text || t('faq.node.empty')}`
  }
  const targets = Object.values(tree.nodes).filter((candidate) => candidate.id !== node.id)

  return (
    <Card padding="none" className="flex min-w-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-base font-semibold">{t('faq.inspector.title')}</h2>
          <Badge tone={node.type === 'question' ? 'accent' : 'neutral'} size="sm">{t(`faq.node.${node.type}`)}</Badge>
          {isRoot ? <Badge tone="primary" size="sm">{t('faq.node.root')}</Badge> : null}
        </div>
        <Button
          variant="danger-outline"
          size="sm"
          leftIcon={<Trash2 size={16} strokeWidth={1.75} />}
          disabled={isRoot}
          title={isRoot ? t('faq.inspector.rootCannotDelete') : undefined}
          onClick={() => onDeleteNode(node.id)}
        >
          {t('faq.inspector.deleteNode')}
        </Button>
      </div>

      <div className="flex flex-col gap-5 p-4">
        {nodeIssues.length > 0 ? (
          <ul className="flex flex-col gap-1 rounded-ui bg-danger-soft px-3 py-2 text-[13px] text-danger" role="alert">
            {nodeIssues.map((issue, index) => (
              <li key={index}>{t(`faq.issues.${issue.code}`)}</li>
            ))}
          </ul>
        ) : null}

        <Field label={t(node.type === 'question' ? 'faq.inspector.questionText' : 'faq.inspector.answerText')} required>
          <LocalizedTextField
            multiline
            rows={3}
            value={node.text}
            onChange={(text) => onPatchNode(node.id, { text })}
            invalid={nodeIssues.some((issue) => issue.code === 'empty_text')}
          />
        </Field>

        {node.type === 'question' ? (
          <section aria-labelledby="faq-options-title" className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h3 id="faq-options-title" className="text-sm font-semibold">{t('faq.inspector.options')}</h3>
              <Button variant="outline" size="xs" leftIcon={<Plus size={14} strokeWidth={1.75} />} onClick={() => onAddOption(node.id)}>
                {t('faq.inspector.addOption')}
              </Button>
            </div>
            {node.options.length === 0 ? <p className="rounded-ui border border-dashed border-line-strong px-3 py-3 text-[13px] text-muted">{t('faq.inspector.noOptions')}</p> : null}
            {node.options.map((option, index) => {
              const problems = optionIssue(option.id)
              const value = option.transferToOperator ? OPERATOR : option.nextId && tree.nodes[option.nextId] ? option.nextId : NONE
              return (
                <fieldset key={option.id} className="flex min-w-0 flex-col gap-2.5 rounded-ui border border-line bg-bg p-3">
                  <legend className="sr-only">{t('faq.inspector.optionN', { n: index + 1 })}</legend>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-muted">{t('faq.inspector.optionN', { n: index + 1 })}</span>
                    <IconButton
                      label={t('faq.inspector.removeOption')}
                      icon={<Trash2 size={16} strokeWidth={1.75} />}
                      size="xs"
                      variant="ghost"
                      onClick={() => onRemoveOption(node.id, option.id)}
                    />
                  </div>
                  <LocalizedTextField
                    value={option.label}
                    onChange={(label) => onPatchOption(node.id, option.id, { label })}
                    invalid={problems.some((issue) => issue.code === 'empty_label')}
                  />
                  <Field label={t('faq.inspector.leadsTo')}>
                    <Select
                      size="sm"
                      value={value}
                      aria-label={t('faq.inspector.leadsTo')}
                      invalid={problems.some((issue) => issue.code === 'option_no_target' || issue.code === 'dangling_target')}
                      onValueChange={(next) => {
                        if (next === OPERATOR) onPatchOption(node.id, option.id, { transferToOperator: true, nextId: null })
                        else if (next === NONE) onPatchOption(node.id, option.id, { transferToOperator: false, nextId: null })
                        else onPatchOption(node.id, option.id, { transferToOperator: false, nextId: next })
                      }}
                      options={[
                        { value: NONE, label: t('faq.inspector.noTarget'), textValue: t('faq.inspector.noTarget') },
                        { value: OPERATOR, label: t('faq.inspector.transfer'), textValue: t('faq.inspector.transfer') },
                        ...targets.map((target) => ({ value: target.id, label: preview(target.id), textValue: preview(target.id) })),
                      ]}
                    />
                  </Field>
                  <Switch
                    size="sm"
                    labelFirst
                    label={t('faq.inspector.transferFlag')}
                    checked={option.transferToOperator}
                    onCheckedChange={(checked) => onPatchOption(node.id, option.id, checked ? { transferToOperator: true, nextId: null } : { transferToOperator: false })}
                  />
                  {problems.length > 0 ? (
                    <ul className="text-[12.5px] text-danger" role="alert">
                      {problems.map((issue, i) => (
                        <li key={i}>{t(`faq.issues.${issue.code}`)}</li>
                      ))}
                    </ul>
                  ) : null}
                </fieldset>
              )
            })}
          </section>
        ) : (
          <p className="rounded-ui bg-sunken px-3 py-2 text-[13px] text-muted">{t('faq.inspector.answerHint')}</p>
        )}
      </div>
    </Card>
  )
}
