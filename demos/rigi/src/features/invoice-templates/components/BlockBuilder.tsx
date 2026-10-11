import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import {
  AlignLeft,
  ArrowDown,
  ArrowUp,
  Copy,
  Divide,
  FileText,
  GripVertical,
  Hash,
  Image as ImageIcon,
  ListChecks,
  MoveVertical,
  Rows3,
  Sigma,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'

import { Card, CardBody, CardHeader, EmptyState, IconButton } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { TemplateBlock, TemplateBlockType } from '@/types'

import { BLOCK_TYPES } from '../engine/document'
import { blockId, moveItem, newBlock } from '../lib/draft'
import { BlockInspector } from './BlockInspector'

const ICONS: Record<TemplateBlockType, LucideIcon> = {
  text: AlignLeft,
  image: ImageIcon,
  spacer: MoveVertical,
  divider: Divide,
  'page-number': Hash,
  'line-items': Rows3,
  tasks: ListChecks,
  totals: Sigma,
  notes: FileText,
}

interface Props {
  layout: TemplateBlock[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onChange: (layout: TemplateBlock[]) => void
}

function summary(block: TemplateBlock, t: (k: string) => string): string {
  const p = block.props
  switch (block.type) {
    case 'text':
      return String(p.text ?? '').replace(/\s+/g, ' ').slice(0, 70) || '—'
    case 'spacer':
      return `${p.height ?? 0} px`
    case 'divider':
      return `${p.thickness ?? 1} px`
    case 'image':
      return typeof p.src === 'string' && p.src ? `${p.width ?? 160} px` : '—'
    case 'notes':
      return String(p.label ?? '')
    default:
      return t(`blocks.hints.${block.type}`)
  }
}

function BlockRow(props: {
  block: TemplateBlock
  index: number
  count: number
  selected: boolean
  onSelect: () => void
  onMove: (to: number) => void
  onDuplicate: () => void
  onRemove: () => void
}) {
  const { block, index, count, selected } = props
  const { t } = useTranslation('invoice-templates')
  const drag = useDraggable({ id: block.id })
  const drop = useDroppable({ id: block.id })
  const Icon = ICONS[block.type]
  const style = drag.transform ? { transform: `translate3d(${drag.transform.x}px, ${drag.transform.y}px, 0)` } : undefined

  return (
    <li
      ref={(node) => {
        drag.setNodeRef(node)
        drop.setNodeRef(node)
      }}
      style={style}
      className={cn(
        'relative flex items-center gap-1 rounded-md border bg-panel pr-1 transition-colors',
        selected ? 'border-signal bg-row-hover' : 'border-hairline hover:border-hairline-strong',
        drop.isOver && !drag.isDragging && 'before:absolute before:inset-x-0 before:-top-[3px] before:h-[3px] before:rounded before:bg-signal',
        drag.isDragging && 'z-20 opacity-80 shadow-overlay',
      )}
    >
      <button
        type="button"
        ref={drag.setActivatorNodeRef}
        {...drag.listeners}
        {...drag.attributes}
        aria-label={t('blocks.drag')}
        title={t('blocks.drag')}
        className="flex h-11 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-l-md text-subtle hover:text-ink active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </button>
      <button
        type="button"
        onClick={props.onSelect}
        aria-pressed={selected}
        aria-label={`${t('blocks.select')}: ${t(`blocks.types.${block.type}`)}`}
        className="flex min-w-0 flex-1 items-center gap-2.5 py-2 text-left"
      >
        <Icon className="size-4 shrink-0 text-muted" />
        <span className="min-w-0">
          <span className="block text-sm font-medium leading-5">{t(`blocks.types.${block.type}`)}</span>
          <span className="block truncate text-xs text-muted">{summary(block, t as never)}</span>
        </span>
      </button>
      <div className="flex shrink-0 items-center">
        <IconButton label={t('blocks.moveUp')} icon={<ArrowUp />} size="sm" disabled={index === 0} onClick={() => props.onMove(index - 1)} />
        <IconButton label={t('blocks.moveDown')} icon={<ArrowDown />} size="sm" disabled={index === count - 1} onClick={() => props.onMove(index + 1)} />
        <IconButton label={t('blocks.duplicate')} icon={<Copy />} size="sm" className="hidden sm:inline-flex" onClick={props.onDuplicate} />
        <IconButton label={t('blocks.remove')} icon={<Trash2 />} size="sm" variant="destructive-ghost" onClick={props.onRemove} />
      </div>
    </li>
  )
}

/** Palette, reorderable block list and inspector. */
export function BlockBuilder({ layout, selectedId, onSelect, onChange }: Props) {
  const { t } = useTranslation('invoice-templates')
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const selected = layout.find((b) => b.id === selectedId) ?? null

  const add = (type: TemplateBlockType) => {
    const block = newBlock(type)
    // Insert after the selected block, otherwise at the end.
    const at = selected ? layout.findIndex((b) => b.id === selected.id) + 1 : layout.length
    onChange([...layout.slice(0, at), block, ...layout.slice(at)])
    onSelect(block.id)
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = layout.findIndex((b) => b.id === active.id)
    const to = layout.findIndex((b) => b.id === over.id)
    if (from >= 0 && to >= 0) onChange(moveItem(layout, from, to))
  }

  const remove = (id: string) => {
    const index = layout.findIndex((b) => b.id === id)
    const next = layout.filter((b) => b.id !== id)
    onChange(next)
    if (selectedId === id) onSelect(next[Math.min(index, next.length - 1)]?.id ?? null)
  }

  const duplicate = (block: TemplateBlock) => {
    const copy: TemplateBlock = { ...block, id: blockId(), props: { ...block.props } }
    const at = layout.findIndex((b) => b.id === block.id) + 1
    onChange([...layout.slice(0, at), copy, ...layout.slice(at)])
    onSelect(copy.id)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title={t('blocks.palette')} />
        <CardBody>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {BLOCK_TYPES.map((type) => {
              const Icon = ICONS[type]
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => add(type)}
                  className="flex items-center gap-2 rounded-md border border-hairline bg-panel px-2.5 py-2 text-left text-sm transition-colors hover:border-signal hover:bg-row-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal"
                >
                  <Icon className="size-4 shrink-0 text-muted" />
                  <span className="min-w-0 truncate">{t(`blocks.types.${type}`)}</span>
                </button>
              )
            })}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t('blocks.layout')} description={layout.length === 0 ? undefined : t('blocks.noneSelected')} />
        <CardBody>
          {layout.length === 0 ? (
            <EmptyState compact title={t('blocks.empty')} description={t('blocks.emptyHint')} />
          ) : (
            <DndContext sensors={sensors} onDragEnd={onDragEnd}>
              <ol className="space-y-1.5">
                {layout.map((block, index) => (
                  <Fragment key={block.id}>
                    <BlockRow
                      block={block}
                      index={index}
                      count={layout.length}
                      selected={block.id === selectedId}
                      onSelect={() => onSelect(block.id === selectedId ? null : block.id)}
                      onMove={(to) => onChange(moveItem(layout, index, to))}
                      onDuplicate={() => duplicate(block)}
                      onRemove={() => remove(block.id)}
                    />
                    {block.id === selectedId ? (
                      <li className="space-y-4 rounded-md border border-signal/50 bg-sunken p-4" aria-label={t('inspector.title')}>
                        <BlockInspector
                          block={block}
                          onChange={(patch) => onChange(layout.map((b) => (b.id === block.id ? { ...b, props: { ...b.props, ...patch } } : b)))}
                        />
                      </li>
                    ) : null}
                  </Fragment>
                ))}
              </ol>
            </DndContext>
          )}
        </CardBody>
      </Card>

    </div>
  )
}
