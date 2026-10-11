import { Eraser, PenLine, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'

import {
  Badge,
  Banner,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  Field,
  Input,
  NativeSelect,
  PageHeader,
  SegmentedControl,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
  toast,
} from '@/components/ui'
import { isApiError } from '@/lib/api'
import type { InvoiceTemplate, TemplateMode } from '@/types'

import {
  useCreateTemplate,
  useDeleteTemplate,
  usePartnerOptions,
  useSaveTemplate,
  useSetDefaultTemplate,
  type TemplateDraft,
} from '../api'
import { blankDraft, draftOf, sameDraft } from '../lib/draft'
import { BlockBuilder } from './BlockBuilder'
import { RawEditor } from './RawEditor'
import { SignaturePadDialog } from './SignaturePadDialog'
import { TemplatePreview } from './TemplatePreview'

type Tab = 'blocks' | 'html' | 'signature'

interface Props {
  /** Omit to create a new template. */
  template?: InvoiceTemplate
}

export function TemplateEditor({ template }: Props) {
  const { t } = useTranslation(['invoice-templates', 'common'])
  const navigate = useNavigate()
  const partners = usePartnerOptions()
  const create = useCreateTemplate()
  const save = useSaveTemplate(template?.id ?? '')
  const setDefault = useSetDefaultTemplate()
  const remove = useDeleteTemplate()

  const [baseline, setBaseline] = useState<TemplateDraft>(() => (template ? draftOf(template) : blankDraft()))
  const [draft, setDraft] = useState<TemplateDraft>(baseline)
  const [wantsDefault, setWantsDefault] = useState(false)
  const [tab, setTab] = useState<Tab>('blocks')
  const [view, setView] = useState<'edit' | 'preview'>('edit')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [padOpen, setPadOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [errors, setErrors] = useState<{ name?: string; html?: string }>({})

  const isDefault = template?.isDefault ?? false
  const dirty = !sameDraft(draft, baseline) || (wantsDefault && !isDefault)
  const seenVersion = template?.updatedAt

  // A colleague (or another tab of this demo) saved the same template: adopt it unless the user has unsaved edits.
  useEffect(() => {
    if (!template || dirty) return
    const next = draftOf(template)
    if (!sameDraft(next, baseline)) {
      setBaseline(next)
      setDraft(next)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seenVersion])

  const patch = (changes: Partial<TemplateDraft>) => setDraft((d) => ({ ...d, ...changes }))

  const nameSchema = useMemo(
    () => z.string().trim().min(1, t('editor.nameRequired')).max(200, t('editor.nameTooLong')),
    [t],
  )

  const pending = create.isPending || save.isPending || setDefault.isPending
  const sourceLabel = (mode: TemplateMode) => (mode === 'blocks' ? t('editor.sourceBlocks') : t('editor.sourceHtml'))

  const onSave = async () => {
    const parsed = nameSchema.safeParse(draft.name)
    if (!parsed.success) {
      setErrors({ name: parsed.error.issues[0]?.message })
      setView('edit')
      return
    }
    setErrors({})
    const body: TemplateDraft = { ...draft, name: parsed.data }
    try {
      if (!template) {
        const created = await create.mutateAsync({ ...body, isDefault: wantsDefault })
        toast.success(t('editor.created'))
        navigate(`/accountant/templates/${created.id}`, { replace: true })
        return
      }
      let saved = await save.mutateAsync(body)
      if (wantsDefault && !saved.isDefault) {
        saved = await setDefault.mutateAsync(template.id)
        toast.success(t('editor.defaultSet'))
      } else {
        toast.success(t('editor.saved'))
      }
      const next = draftOf(saved)
      setBaseline(next)
      setDraft(next)
      setWantsDefault(false)
    } catch (error) {
      if (isApiError(error) && error.status === 400) {
        const fields = error.fieldErrors ?? {}
        setErrors({ name: fields.name?.[0], html: fields.html?.[0] })
        if (fields.html) setTab('html')
        toast.error(error.message)
      } else {
        toast.error(isApiError(error) ? error.message : t('editor.saveError'))
      }
    }
  }

  const onDelete = async () => {
    if (!template) return
    try {
      await remove.mutateAsync(template.id)
      toast.success(t('editor.deleted'))
      setConfirmDelete(false)
      navigate('/accountant/templates', { replace: true })
    } catch (error) {
      setConfirmDelete(false)
      toast.error(isApiError(error, 409) ? t('editor.deleteDefaultBlocked') : isApiError(error) ? error.message : t('editor.saveError'))
    }
  }

  const activePartners = (partners.data ?? []).filter((p) => p.isActive || p.id === draft.partnerId)
  const modeBanner = (forTab: 'blocks' | 'html') =>
    draft.mode !== forTab ? (
      <Banner
        tone="info"
        title={t('editor.usedForPdf')}
        action={
          <Button size="sm" variant="secondary" onClick={() => patch({ mode: forTab })}>
            {forTab === 'blocks' ? t('editor.useBlocks') : t('editor.useHtml')}
          </Button>
        }
      >
        {t('editor.usedByPdf', { source: sourceLabel(draft.mode) })}
      </Banner>
    ) : null

  const previewSource = useMemo(
    () => ({ mode: draft.mode, html: draft.html, css: draft.css, layout: draft.layout, signatureDataUrl: draft.signatureDataUrl }),
    [draft.mode, draft.html, draft.css, draft.layout, draft.signatureDataUrl],
  )

  return (
    <div>
      <PageHeader
        eyebrow={template ? t('editor.eyebrowEdit') : t('editor.eyebrowNew')}
        title={draft.name.trim() || t('editor.titleNew')}
        back={{ to: '/accountant/templates', label: t('editor.back') }}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            {isDefault ? <Badge tone="primary">{t('badge.default')}</Badge> : null}
            <Badge tone="outline" dot={false}>
              {t('editor.usedForPdf')}: {sourceLabel(draft.mode)}
            </Badge>
            {template ? (
              <span className={dirty ? 'text-sm text-warning' : 'text-sm text-muted'} aria-live="polite">
                {dirty ? t('editor.unsaved') : t('editor.allSaved')}
              </span>
            ) : null}
          </div>
        }
        actions={
          <>
            {template ? (
              <Tooltip content={isDefault ? t('editor.deleteDefaultBlocked') : t('editor.delete')}>
                <span>
                  <Button variant="destructive-ghost" icon={<Trash2 />} disabled={isDefault} onClick={() => setConfirmDelete(true)}>
                    {t('editor.delete')}
                  </Button>
                </span>
              </Tooltip>
            ) : null}
            <Button loading={pending} disabled={template ? !dirty : false} onClick={() => void onSave()}>
              {template ? t('editor.save') : t('editor.create')}
            </Button>
          </>
        }
      />

      <div className="mb-4 lg:hidden">
        <SegmentedControl
          value={view}
          onChange={(v) => setView(v as 'edit' | 'preview')}
          options={[
            { value: 'edit', label: t('editor.editTab') },
            { value: 'preview', label: t('editor.previewTab') },
          ]}
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <div className={view === 'preview' ? 'hidden min-w-0 space-y-4 lg:block' : 'min-w-0 space-y-4'}>
          <Card>
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <Field label={t('editor.name')} htmlFor="tpl-name" error={errors.name} required>
                <Input
                  id="tpl-name"
                  value={draft.name}
                  maxLength={200}
                  invalid={Boolean(errors.name)}
                  placeholder={t('editor.namePlaceholder')}
                  onChange={(e) => {
                    patch({ name: e.target.value })
                    if (errors.name) setErrors((er) => ({ ...er, name: undefined }))
                  }}
                />
              </Field>
              <Field label={t('editor.scope')} htmlFor="tpl-scope" hint={t('editor.scopeHint')}>
                <NativeSelect
                  id="tpl-scope"
                  value={draft.partnerId ?? ''}
                  onChange={(e) => patch({ partnerId: e.target.value || null })}
                  options={[{ value: '', label: t('editor.scopeGlobal') }, ...activePartners.map((p) => ({ value: p.id, label: p.name }))]}
                />
              </Field>
              <div className="sm:col-span-2">
                <Switch
                  checked={isDefault || wantsDefault}
                  disabled={isDefault}
                  onCheckedChange={setWantsDefault}
                  label={t('editor.isDefault')}
                  description={isDefault ? t('editor.isDefaultOn') : t('editor.isDefaultHint')}
                />
              </div>
            </CardBody>
          </Card>

          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
            <TabsList>
              <TabsTrigger value="blocks">{t('tabs.blocks')}</TabsTrigger>
              <TabsTrigger value="html">{t('tabs.html')}</TabsTrigger>
              <TabsTrigger value="signature">{t('tabs.signature')}</TabsTrigger>
            </TabsList>

            <TabsContent value="blocks" className="mt-4 space-y-4">
              {modeBanner('blocks')}
              <BlockBuilder
                layout={draft.layout}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onChange={(layout) => patch({ layout, mode: 'blocks' })}
              />
            </TabsContent>

            <TabsContent value="html" className="mt-4 space-y-4">
              {modeBanner('html')}
              <RawEditor
                html={draft.html}
                css={draft.css}
                layout={draft.layout}
                htmlError={errors.html}
                onHtml={(html) => {
                  patch({ html, mode: 'html' })
                  if (errors.html) setErrors((er) => ({ ...er, html: undefined }))
                }}
                onCss={(css) => patch({ css })}
              />
            </TabsContent>

            <TabsContent value="signature" className="mt-4">
              <Card>
                <CardHeader title={t('signature.title')} description={t('signature.description')} />
                <CardBody className="space-y-4">
                  <div className="flex min-h-32 items-center justify-center rounded-md border border-dashed border-hairline-strong bg-white p-4">
                    {draft.signatureDataUrl ? (
                      <div className="w-60 max-w-full">
                        <img src={draft.signatureDataUrl} alt={t('signature.title')} className="h-20 w-full object-contain" />
                        <div className="mt-1 border-t border-ink pt-1 text-[10px] text-muted">{t('signature.printedAs')}</div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted">{t('signature.none')}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button icon={<PenLine />} onClick={() => setPadOpen(true)}>
                      {draft.signatureDataUrl ? t('signature.redraw') : t('signature.draw')}
                    </Button>
                    {draft.signatureDataUrl ? (
                      <Button variant="destructive-ghost" icon={<Eraser />} onClick={() => patch({ signatureDataUrl: null })}>
                        {t('signature.clear')}
                      </Button>
                    ) : null}
                  </div>
                </CardBody>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className={view === 'edit' ? 'hidden min-w-0 lg:sticky lg:top-4 lg:block' : 'min-w-0 lg:sticky lg:top-4'}>
          <TemplatePreview source={previewSource} />
        </div>
      </div>

      <SignaturePadDialog open={padOpen} onOpenChange={setPadOpen} onSave={(signatureDataUrl) => patch({ signatureDataUrl })} />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('editor.deleteTitle')}
        description={t('editor.deleteDescription', { name: baseline.name })}
        confirmLabel={t('editor.delete')}
        tone="danger"
        pending={remove.isPending}
        onConfirm={() => void onDelete()}
      />
    </div>
  )
}
