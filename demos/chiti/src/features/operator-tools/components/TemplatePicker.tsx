import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ImageIcon, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge, Button, EmptyState, ErrorState, Field, Input, Modal, Skeleton, toast, type BadgeTone } from '@/components/ui'
import { errorMessage, fieldError, isApiError } from '@/api/client'
import { cn } from '@/lib/cn'
import { formatRelative } from '@/lib/format'
import type { SessionDetail, TemplateSlot, WhatsAppTemplate } from '@/types'

import { useSendTemplate, useSyncTemplates, useTemplates } from '../api'
import type { TemplateErrorCode } from '../types'

const STATUS_TONE: Record<WhatsAppTemplate['status'], BadgeTone> = { APPROVED: 'success', PENDING: 'warning', REJECTED: 'danger', PAUSED: 'muted' }
const QUALITY_TONE: Record<WhatsAppTemplate['qualityScore'], BadgeTone> = { GREEN: 'success', YELLOW: 'warning', RED: 'danger', UNKNOWN: 'muted' }

function initialValues(template: WhatsAppTemplate, customerName: string): Record<string, string> {
  const first = customerName.trim().split(/\s+/)[0] ?? ''
  return Object.fromEntries(
    template.slots.map((slot) => [slot.key, slot.kind === 'media' ? slot.example : /name/i.test(slot.label) ? first : '']),
  )
}

/** `{{n}}` placeholders replaced by the typed value (or left as a muted chip while empty). */
function renderFilled(text: string, component: 'header' | 'body', values: Record<string, string>): ReactNode {
  return text.split(/(\{\{\d+\}\})/g).map((part, index) => {
    const match = /^\{\{(\d+)\}\}$/.exec(part)
    if (!match) return <Fragment key={index}>{part}</Fragment>
    const value = values[`${component}_${match[1]}`]?.trim()
    return value ? (
      <mark key={index} className="rounded-sm bg-accent-soft px-0.5 text-ink">
        {value}
      </mark>
    ) : (
      <span key={index} className="rounded-sm bg-sunken px-0.5 font-mono text-[11px] text-muted">
        {part}
      </span>
    )
  })
}

function Preview({ template, values }: { template: WhatsAppTemplate; values: Record<string, string> }) {
  const { t } = useTranslation('operatorTools')
  const media = template.slots.find((slot) => slot.component === 'header' && slot.kind === 'media')
  const { header, body, footer, buttons } = template.preview
  return (
    <div aria-label={t('templates.preview')} className="mx-auto w-full max-w-[300px] rounded-[26px] border-[5px] border-ink/85 bg-sunken p-2.5">
      <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-line-strong" aria-hidden />
      <div className="overflow-hidden rounded-bubble rounded-tl-[4px] border border-line bg-panel text-[13px] leading-relaxed text-ink">
        {media ? (
          <div className="grid h-24 place-items-center bg-hover text-muted">
            <span className="flex flex-col items-center gap-1 text-[11px]">
              <ImageIcon size={22} strokeWidth={1.5} aria-hidden />
              <span className="font-mono">{values[media.key] || media.example}</span>
            </span>
          </div>
        ) : null}
        <div className="space-y-1.5 px-3 py-2">
          {header ? <p className="font-semibold">{renderFilled(header, 'header', values)}</p> : null}
          <p className="whitespace-pre-wrap break-words">{renderFilled(body, 'body', values)}</p>
          {footer ? <p className="text-[11px] text-muted">{footer}</p> : null}
        </div>
        {buttons.length > 0 ? (
          <ul className="divide-y divide-line border-t border-line">
            {buttons.map((label) => (
              <li key={label} className="px-3 py-1.5 text-center text-[12.5px] font-medium text-accent">
                {label}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
}

function SlotField({ slot, value, error, onChange }: { slot: TemplateSlot; value: string; error: string | undefined; onChange: (value: string) => void }) {
  const { t } = useTranslation('operatorTools')
  return (
    <Field label={slot.label} {...(error ? { error } : {})} hint={slot.kind === 'url_suffix' ? t('templates.slot.urlSuffix') : slot.kind === 'media' ? t('templates.slot.media') : undefined}>
      <Input
        value={value}
        invalid={!!error}
        mono={slot.kind !== 'text'}
        placeholder={slot.example}
        maxLength={slot.kind === 'media' ? 120 : 200}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  )
}

export interface TemplatePickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  detail: SessionDetail
}

/** The WhatsApp template picker: catalogue list, slot form, live phone preview, send. */
export function TemplatePicker({ open, onOpenChange, detail }: TemplatePickerProps) {
  const { t, i18n } = useTranslation('operatorTools')
  const { t: tc } = useTranslation()
  const sessionId = detail.session.id
  const templates = useTemplates(open)
  const sync = useSyncTemplates()
  const send = useSendTemplate(sessionId)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})

  const sorted = useMemo(() => {
    const rank = (template: WhatsAppTemplate) => (template.sendable ? (template.recommendedForReengagement ? 0 : 1) : 2)
    return [...(templates.data?.templates ?? [])].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
  }, [templates.data])
  const selected = sorted.find((template) => template.id === selectedId) ?? null

  const choose = (template: WhatsAppTemplate) => {
    setSelectedId(template.id)
    setValues(initialValues(template, detail.customer.name))
    send.reset()
  }

  // Pre-select the best sendable template (recommended first) when the dialog opens.
  useEffect(() => {
    if (!open || selectedId || sorted.length === 0) return
    const first = sorted.find((template) => template.sendable)
    if (first) {
      setSelectedId(first.id)
      setValues(initialValues(first, detail.customer.name))
    }
  }, [open, selectedId, sorted, detail.customer.name])

  const error = send.error
  const code = error ? (fieldError(error, 'code') as TemplateErrorCode | undefined) : undefined
  const message = !error
    ? null
    : code === 'missing_values'
      ? t('templates.errors.missing_values')
      : code === 'wrong_channel'
        ? t('templates.errors.wrong_channel')
        : code === 'template_unsendable'
          ? `${t('templates.errors.template_unsendable')} ${isApiError(error) ? error.message : ''}`.trim()
          : errorMessage(error)

  const submit = () => {
    if (!selected) return
    send.mutate(
      { templateId: selected.id, values },
      {
        onSuccess: () => {
          toast.success(t('templates.sent', { name: selected.name }))
          onOpenChange(false)
        },
      },
    )
  }

  const grouped = (component: TemplateSlot['component']) => selected?.slots.filter((slot) => slot.component === component) ?? []

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      title={t('templates.title')}
      description={detail.window.open ? t('templates.descriptionOpen') : t('templates.descriptionClosed')}
      bodyClassName="p-0"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {tc('actions.cancel')}
          </Button>
          <Button variant="primary" disabled={!selected} loading={send.isPending} onClick={submit}>
            {t('templates.send')}
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-2.5">
        <p className="text-xs text-muted">
          {templates.data?.syncedAt ? t('templates.synced', { when: formatRelative(templates.data.syncedAt, i18n.language) }) : t('templates.notSynced')}
        </p>
        <Button size="xs" variant="outline" leftIcon={<RefreshCw size={13} />} loading={sync.isPending} onClick={() => sync.mutate(undefined, { onSuccess: () => toast.success(t('templates.refreshed')), onError: (err) => toast.error(errorMessage(err)) })}>
          {t('templates.refresh')}
        </Button>
      </div>

      {templates.isLoading ? (
        <div className="space-y-2 p-5">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : templates.isError ? (
        <ErrorState title={t('templates.loadError')} onRetry={() => void templates.refetch()} retryLabel={tc('actions.retry')} />
      ) : sorted.length === 0 ? (
        <EmptyState compact title={t('templates.emptyTitle')} description={t('templates.emptyBody')} />
      ) : (
        <div className="grid md:grid-cols-[270px_minmax(0,1fr)]">
          <ul className="max-h-[38vh] divide-y divide-line overflow-y-auto border-b border-line md:max-h-[56vh] md:border-b-0 md:border-r" aria-label={t('templates.list')}>
            {sorted.map((template) => (
              <li key={template.id}>
                <button
                  type="button"
                  disabled={!template.sendable}
                  aria-pressed={template.id === selectedId}
                  onClick={() => choose(template)}
                  className={cn(
                    'w-full px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
                    template.id === selectedId ? 'bg-accent-soft' : 'hover:bg-hover',
                    !template.sendable && 'cursor-not-allowed opacity-70 hover:bg-transparent',
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-[13px] font-medium text-ink">{template.name}</span>
                    <span className="font-mono text-[10.5px] uppercase text-muted">{template.language}</span>
                  </span>
                  <span className="mt-1.5 flex flex-wrap gap-1">
                    {template.recommendedForReengagement && template.sendable ? (
                      <Badge tone="primary" size="sm">
                        {t('templates.recommended')}
                      </Badge>
                    ) : null}
                    <Badge tone="outline" size="sm">
                      {t(`templates.category.${template.category}`)}
                    </Badge>
                    <Badge tone={STATUS_TONE[template.status]} size="sm">
                      {t(`templates.status.${template.status}`)}
                    </Badge>
                    <Badge tone={QUALITY_TONE[template.qualityScore]} size="sm" dot>
                      {t(`templates.quality.${template.qualityScore}`)}
                    </Badge>
                  </span>
                  {!template.sendable && template.unsendableReasons.length > 0 ? (
                    <span className="mt-1.5 block text-xs leading-snug text-danger">
                      {t('templates.unsendable')}: {template.unsendableReasons.join(' ')}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>

          <div className="min-w-0 p-5">
            {selected ? (
              <div className="grid gap-5 lg:grid-cols-2">
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault()
                    submit()
                  }}
                >
                  {(['header', 'body', 'button'] as const).map((component) => {
                    const slots = grouped(component)
                    if (slots.length === 0) return null
                    return (
                      <fieldset key={component} className="space-y-3">
                        <legend className="mb-1 text-xs font-medium text-muted">{t(`templates.slots.${component}`)}</legend>
                        {slots.map((slot) => (
                          <SlotField
                            key={slot.key}
                            slot={slot}
                            value={values[slot.key] ?? ''}
                            error={error ? fieldError(error, `slot:${slot.key}`) : undefined}
                            onChange={(value) => {
                              setValues((current) => ({ ...current, [slot.key]: value }))
                              if (send.isError) send.reset()
                            }}
                          />
                        ))}
                      </fieldset>
                    )
                  })}
                  {selected.slots.length === 0 ? <p className="text-[13px] text-muted">{t('templates.noSlots')}</p> : null}
                  {message ? (
                    <p role="alert" className="rounded-ui border border-danger/40 bg-danger-soft px-3 py-2 text-[13px] text-danger">
                      {message}
                    </p>
                  ) : null}
                </form>
                <Preview template={selected} values={values} />
              </div>
            ) : (
              <EmptyState compact title={t('templates.pickTitle')} description={t('templates.pickBody')} />
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
