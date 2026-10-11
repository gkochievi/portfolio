import { ImagePlus, Trash2 } from 'lucide-react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, Field, Input, NativeSelect, SegmentedControl, Switch, Textarea, toast } from '@/components/ui'
import type { TemplateBlock } from '@/types'

import { insertAt } from '../lib/draft'
import { TokenPicker } from './TokenPicker'

type Props = Record<string, string | number | boolean | null>

interface InspectorProps {
  block: TemplateBlock
  onChange: (patch: Props) => void
}

const IMAGE_MAX_BYTES = 1_000_000

const numberOr = (value: string, fallback: number): number => {
  const n = Number.parseFloat(value)
  return Number.isFinite(n) ? n : fallback
}

function AlignField({ value, onChange }: { value: unknown; onChange: (v: string) => void }) {
  const { t } = useTranslation('invoice-templates')
  return (
    <Field label={t('inspector.align')}>
      <SegmentedControl
        size="sm"
        value={value === 'center' || value === 'right' ? (value as string) : 'left'}
        onChange={onChange}
        options={[
          { value: 'left', label: t('inspector.alignLeft') },
          { value: 'center', label: t('inspector.alignCenter') },
          { value: 'right', label: t('inspector.alignRight') },
        ]}
      />
    </Field>
  )
}

function ImageField({ props, onChange }: { props: Props; onChange: (patch: Props) => void }) {
  const { t } = useTranslation('invoice-templates')
  const input = useRef<HTMLInputElement>(null)
  const src = typeof props.src === 'string' && props.src.startsWith('data:image/') ? props.src : null

  const onFile = (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return void toast.error(t('inspector.imageNotImage'))
    if (file.size > IMAGE_MAX_BYTES) return void toast.error(t('inspector.imageTooLarge'))
    const reader = new FileReader()
    reader.onload = () => onChange({ src: typeof reader.result === 'string' ? reader.result : null })
    reader.onerror = () => toast.error(t('inspector.imageReadError'))
    reader.readAsDataURL(file)
  }

  return (
    <div className="space-y-3">
      <div className="flex min-h-24 items-center justify-center rounded-md border border-dashed border-hairline-strong bg-sunken p-3">
        {src ? <img src={src} alt="" className="max-h-24 max-w-full object-contain" /> : <p className="text-center text-sm text-muted">{t('inspector.noImage')}</p>}
      </div>
      <input ref={input} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }} />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" icon={<ImagePlus />} onClick={() => input.current?.click()}>
          {src ? t('inspector.replace') : t('inspector.upload')}
        </Button>
        {src ? (
          <Button size="sm" variant="destructive-ghost" icon={<Trash2 />} onClick={() => onChange({ src: null })}>
            {t('inspector.removeImage')}
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted">{t('inspector.imageHint')}</p>
    </div>
  )
}

function TextField({ props, onChange }: { props: Props; onChange: (patch: Props) => void }) {
  const { t } = useTranslation('invoice-templates')
  const area = useRef<HTMLTextAreaElement>(null)
  const text = typeof props.text === 'string' ? props.text : ''

  const insert = (snippet: string) => {
    const el = area.current
    const next = insertAt(text, snippet, el?.selectionStart ?? null, el?.selectionEnd ?? null)
    onChange({ text: next.value })
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(next.caret, next.caret)
    })
  }

  return (
    <>
      <Field label={t('inspector.text')} hint={t('inspector.textHint')} htmlFor="blk-text">
        <Textarea id="blk-text" ref={area} mono rows={5} value={text} onChange={(e) => onChange({ text: e.target.value })} />
      </Field>
      <div>
        <div className="eyebrow mb-1.5">{t('inspector.insertToken')}</div>
        <TokenPicker className="max-h-56" onInsert={(snippet) => insert(snippet)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('inspector.size')} htmlFor="blk-size">
          <Input id="blk-size" type="number" min={8} max={48} value={String(props.size ?? 12)} onChange={(e) => onChange({ size: numberOr(e.target.value, 12) })} />
        </Field>
        <Field label={t('inspector.weight')} htmlFor="blk-weight">
          <NativeSelect
            id="blk-weight"
            value={String(props.weight ?? 400)}
            onChange={(e) => onChange({ weight: Number(e.target.value) })}
            options={[
              { value: '400', label: t('inspector.weightRegular') },
              { value: '500', label: t('inspector.weightMedium') },
              { value: '600', label: t('inspector.weightSemibold') },
              { value: '700', label: t('inspector.weightBold') },
            ]}
          />
        </Field>
      </div>
      <AlignField value={props.align} onChange={(align) => onChange({ align })} />
    </>
  )
}

/** Side inspector: edits the props of the selected block. */
export function BlockInspector({ block, onChange }: InspectorProps) {
  const { t } = useTranslation('invoice-templates')
  const p = block.props

  switch (block.type) {
    case 'text':
      return <TextField props={p} onChange={onChange} />
    case 'image':
      return (
        <>
          <ImageField props={p} onChange={onChange} />
          <Field label={t('inspector.width')} htmlFor="blk-width">
            <Input id="blk-width" type="number" min={16} max={700} value={String(p.width ?? 160)} onChange={(e) => onChange({ width: numberOr(e.target.value, 160) })} />
          </Field>
          <AlignField value={p.align} onChange={(align) => onChange({ align })} />
        </>
      )
    case 'spacer':
      return (
        <Field label={t('inspector.height')} htmlFor="blk-height">
          <div className="flex items-center gap-3">
            <input
              aria-label={t('inspector.height')}
              type="range"
              min={0}
              max={200}
              step={2}
              value={Number(p.height ?? 16)}
              onChange={(e) => onChange({ height: Number(e.target.value) })}
              className="h-2 flex-1 accent-[var(--primary)]"
            />
            <Input id="blk-height" type="number" min={0} max={400} className="w-24" value={String(p.height ?? 16)} onChange={(e) => onChange({ height: numberOr(e.target.value, 16) })} />
          </div>
        </Field>
      )
    case 'divider':
      return (
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('inspector.color')} htmlFor="blk-color">
            <input
              id="blk-color"
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(String(p.color)) ? String(p.color) : '#d9d9d3'}
              onChange={(e) => onChange({ color: e.target.value })}
              className="h-9 w-full cursor-pointer rounded-md border border-hairline bg-panel p-1"
            />
          </Field>
          <Field label={t('inspector.thickness')} htmlFor="blk-thickness">
            <Input id="blk-thickness" type="number" min={1} max={8} value={String(p.thickness ?? 1)} onChange={(e) => onChange({ thickness: numberOr(e.target.value, 1) })} />
          </Field>
        </div>
      )
    case 'page-number':
      return (
        <>
          <AlignField value={p.align} onChange={(align) => onChange({ align })} />
          <p className="text-xs text-muted">{t('inspector.pageNumberHint')}</p>
        </>
      )
    case 'line-items':
      return (
        <>
          <Switch checked={p.showQuantity !== false} onCheckedChange={(showQuantity) => onChange({ showQuantity })} label={t('inspector.showQuantity')} />
          <Switch checked={p.showUnitPrice !== false} onCheckedChange={(showUnitPrice) => onChange({ showUnitPrice })} label={t('inspector.showUnitPrice')} />
          <p className="text-xs text-muted">{t('inspector.lineItemsHint')}</p>
        </>
      )
    case 'tasks':
      return (
        <>
          <Switch checked={p.showRate !== false} onCheckedChange={(showRate) => onChange({ showRate })} label={t('inspector.showRate')} />
          <p className="text-xs text-muted">{t('inspector.tasksHint')}</p>
        </>
      )
    case 'totals':
      return (
        <>
          <AlignField value={p.align} onChange={(align) => onChange({ align })} />
          <Switch checked={p.showTax !== false} onCheckedChange={(showTax) => onChange({ showTax })} label={t('inspector.showTax')} />
          <p className="text-xs text-muted">{t('inspector.totalsHint')}</p>
        </>
      )
    case 'notes':
      return (
        <Field label={t('inspector.label')} htmlFor="blk-label">
          <Input id="blk-label" maxLength={60} value={String(p.label ?? '')} onChange={(e) => onChange({ label: e.target.value })} />
        </Field>
      )
    default:
      return null
  }
}
