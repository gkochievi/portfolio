/**
 * Hand-built node-graph canvas for the FAQ flow: absolutely positioned node
 * cards over an SVG edge layer, pointer-event dragging for nodes and for
 * connections (drag an option's handle onto a node), canvas panning, zoom
 * buttons and a small minimap. No graph library.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Headphones, Maximize, ZoomIn, ZoomOut } from 'lucide-react'

import { Badge, IconButton } from '@/components/ui'
import { cn } from '@/lib/cn'
import { pickText } from '@/lib/format'
import type { ContentLang, FaqNode, FaqTree } from '@/types'

export const NODE_W = 264
const HEAD_H = 32
const TEXT_H = 50
const OPT_H = 30
const PAD_B = 8
const MIN_ZOOM = 0.4
const MAX_ZOOM = 1.6

export function nodeHeight(node: FaqNode): number {
  return HEAD_H + TEXT_H + node.options.length * OPT_H + PAD_B
}

interface Props {
  tree: FaqTree
  lang: ContentLang
  selectedId: string | null
  issueNodeIds: ReadonlySet<string>
  /** Bump `n` to ask the canvas to centre on `id`. */
  focusRequest: { id: string; n: number } | null
  onSelect: (id: string | null) => void
  onMove: (id: string, position: { x: number; y: number }) => void
  onConnect: (nodeId: string, optionId: string, targetId: string) => void
}

interface Connecting {
  nodeId: string
  optionId: string
  x: number
  y: number
  hover: string | null
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function FaqCanvas({ tree, lang, selectedId, issueNodeIds, focusRequest, onSelect, onMove, onConnect }: Props) {
  const { t } = useTranslation('adminIntegrations')
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 800, h: 560 })
  const [pan, setPan] = useState({ x: 24, y: 24 })
  const [zoom, setZoom] = useState(0.85)
  const [connecting, setConnecting] = useState<Connecting | null>(null)
  const panRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null)
  const dragRef = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number } | null>(null)
  const fitted = useRef(false)

  const nodes = useMemo(() => Object.values(tree.nodes), [tree.nodes])

  const bounds = useMemo(() => {
    if (nodes.length === 0) return { minX: 0, minY: 0, maxX: 400, maxY: 300 }
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const node of nodes) {
      minX = Math.min(minX, node.position.x)
      minY = Math.min(minY, node.position.y)
      maxX = Math.max(maxX, node.position.x + NODE_W)
      maxY = Math.max(maxY, node.position.y + nodeHeight(node))
    }
    return { minX, minY, maxX, maxY }
  }, [nodes])

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const fit = useCallback(() => {
    const width = bounds.maxX - bounds.minX + 80
    const height = bounds.maxY - bounds.minY + 80
    const next = clamp(Math.min(size.w / width, size.h / height), MIN_ZOOM, 1)
    setZoom(next)
    setPan({ x: (size.w - (bounds.maxX - bounds.minX) * next) / 2 - bounds.minX * next, y: (size.h - (bounds.maxY - bounds.minY) * next) / 2 - bounds.minY * next })
  }, [bounds, size.h, size.w])

  useEffect(() => {
    if (fitted.current || nodes.length === 0 || size.w < 50) return
    fitted.current = true
    fit()
  }, [fit, nodes.length, size.w])

  useEffect(() => {
    if (!focusRequest) return
    const node = tree.nodes[focusRequest.id]
    if (!node) return
    setPan({ x: size.w / 2 - (node.position.x + NODE_W / 2) * zoom, y: size.h / 2 - (node.position.y + nodeHeight(node) / 2) * zoom })
    // Only a new request re-centres; later zoom or drag changes must not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest?.n])

  const zoomBy = (factor: number) => {
    const next = clamp(zoom * factor, MIN_ZOOM, MAX_ZOOM)
    // Keep the centre of the viewport fixed.
    const cx = (size.w / 2 - pan.x) / zoom
    const cy = (size.h / 2 - pan.y) / zoom
    setZoom(next)
    setPan({ x: size.w / 2 - cx * next, y: size.h / 2 - cy * next })
  }

  const toWorld = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect()
    return { x: (clientX - (rect?.left ?? 0) - pan.x) / zoom, y: (clientY - (rect?.top ?? 0) - pan.y) / zoom }
  }

  /* ------------------------------------------------------------ panning */
  const onBackgroundDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    onSelect(null)
    panRef.current = { sx: event.clientX, sy: event.clientY, ox: pan.x, oy: pan.y }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onBackgroundMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = panRef.current
    if (!start) return
    setPan({ x: start.ox + event.clientX - start.sx, y: start.oy + event.clientY - start.sy })
  }
  const onBackgroundUp = () => {
    panRef.current = null
  }

  /* ------------------------------------------------------ node dragging */
  const onHeadDown = (event: ReactPointerEvent<HTMLDivElement>, node: FaqNode) => {
    if (event.button !== 0) return
    event.stopPropagation()
    onSelect(node.id)
    dragRef.current = { id: node.id, sx: event.clientX, sy: event.clientY, ox: node.position.x, oy: node.position.y }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onHeadMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) return
    onMove(drag.id, { x: Math.round(drag.ox + (event.clientX - drag.sx) / zoom), y: Math.round(drag.oy + (event.clientY - drag.sy) / zoom) })
  }
  const onHeadUp = () => {
    dragRef.current = null
  }

  const onNodeKey = (event: KeyboardEvent<HTMLDivElement>, node: FaqNode) => {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelect(node.id)
      return
    }
    const step = event.shiftKey ? 80 : 20
    const delta: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
    const move = delta[event.key]
    if (!move) return
    event.preventDefault()
    onMove(node.id, { x: node.position.x + move[0], y: node.position.y + move[1] })
  }

  /* ---------------------------------------------------- connect by drag */
  const nodeAt = (x: number, y: number, except: string): string | null => {
    for (const node of nodes) {
      if (node.id === except) continue
      if (x >= node.position.x && x <= node.position.x + NODE_W && y >= node.position.y && y <= node.position.y + nodeHeight(node)) return node.id
    }
    return null
  }
  const onHandleDown = (event: ReactPointerEvent<HTMLButtonElement>, node: FaqNode, optionId: string) => {
    if (event.button !== 0) return
    event.stopPropagation()
    onSelect(node.id)
    const world = toWorld(event.clientX, event.clientY)
    setConnecting({ nodeId: node.id, optionId, x: world.x, y: world.y, hover: null })
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onHandleMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!connecting) return
    const world = toWorld(event.clientX, event.clientY)
    setConnecting({ ...connecting, x: world.x, y: world.y, hover: nodeAt(world.x, world.y, connecting.nodeId) })
  }
  const onHandleUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!connecting) return
    const world = toWorld(event.clientX, event.clientY)
    const target = nodeAt(world.x, world.y, connecting.nodeId)
    if (target) onConnect(connecting.nodeId, connecting.optionId, target)
    setConnecting(null)
  }

  /* -------------------------------------------------------------- edges */
  const edges = useMemo(() => {
    const list: { key: string; d: string }[] = []
    for (const node of nodes) {
      node.options.forEach((option, index) => {
        const target = option.nextId ? tree.nodes[option.nextId] : undefined
        if (!target) return
        const sx = node.position.x + NODE_W
        const sy = node.position.y + HEAD_H + TEXT_H + index * OPT_H + OPT_H / 2
        const tx = target.position.x
        const ty = target.position.y + HEAD_H / 2
        const bend = Math.max(48, Math.abs(tx - sx) / 2)
        list.push({ key: `${node.id}:${option.id}`, d: `M ${sx} ${sy} C ${sx + bend} ${sy}, ${tx - bend} ${ty}, ${tx} ${ty}` })
      })
    }
    return list
  }, [nodes, tree.nodes])

  const liveEdge = useMemo(() => {
    if (!connecting) return null
    const node = tree.nodes[connecting.nodeId]
    if (!node) return null
    const index = node.options.findIndex((option) => option.id === connecting.optionId)
    const sx = node.position.x + NODE_W
    const sy = node.position.y + HEAD_H + TEXT_H + index * OPT_H + OPT_H / 2
    const bend = Math.max(48, Math.abs(connecting.x - sx) / 2)
    return `M ${sx} ${sy} C ${sx + bend} ${sy}, ${connecting.x - bend} ${connecting.y}, ${connecting.x} ${connecting.y}`
  }, [connecting, tree.nodes])

  /* ------------------------------------------------------------ minimap */
  const MM_W = 168
  const MM_H = 108
  const view = { x: -pan.x / zoom, y: -pan.y / zoom, w: size.w / zoom, h: size.h / zoom }
  const mm = {
    minX: Math.min(bounds.minX, view.x) - 40,
    minY: Math.min(bounds.minY, view.y) - 40,
    maxX: Math.max(bounds.maxX, view.x + view.w) + 40,
    maxY: Math.max(bounds.maxY, view.y + view.h) + 40,
  }
  const mmScale = Math.min(MM_W / (mm.maxX - mm.minX), MM_H / (mm.maxY - mm.minY))
  const mmCentre = (event: ReactPointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const wx = mm.minX + (event.clientX - rect.left) / mmScale
    const wy = mm.minY + (event.clientY - rect.top) / mmScale
    setPan({ x: size.w / 2 - wx * zoom, y: size.h / 2 - wy * zoom })
  }

  return (
    <div
      ref={containerRef}
      className="relative h-[460px] touch-none select-none overflow-hidden rounded-modal border border-line bg-sunken sm:h-[600px]"
      style={{ backgroundImage: 'radial-gradient(var(--c-line) 1px, transparent 1px)', backgroundSize: `${24 * zoom}px ${24 * zoom}px`, backgroundPosition: `${pan.x}px ${pan.y}px` }}
      onPointerDown={onBackgroundDown}
      onPointerMove={onBackgroundMove}
      onPointerUp={onBackgroundUp}
      onPointerCancel={onBackgroundUp}
      role="application"
      aria-label={t('faq.canvas.label')}
    >
      <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
        <svg className="pointer-events-none absolute left-0 top-0 overflow-visible text-accent" width={1} height={1} aria-hidden>
          <defs>
            <marker id="faq-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
            </marker>
          </defs>
          {edges.map((edge) => (
            <path key={edge.key} d={edge.d} fill="none" stroke="currentColor" strokeWidth={1.75} markerEnd="url(#faq-arrow)" opacity={0.85} />
          ))}
          {liveEdge ? <path d={liveEdge} fill="none" stroke="currentColor" strokeWidth={1.75} strokeDasharray="5 5" markerEnd="url(#faq-arrow)" /> : null}
        </svg>

        {nodes.map((node) => {
          const isRoot = tree.rootIds.includes(node.id)
          const selected = node.id === selectedId
          const issue = issueNodeIds.has(node.id)
          const hovered = connecting?.hover === node.id
          const text = pickText(node.text, lang)
          return (
            <div
              key={node.id}
              id={`faq-node-${node.id}`}
              tabIndex={0}
              role="group"
              aria-label={text || t('faq.node.empty')}
              onKeyDown={(event) => onNodeKey(event, node)}
              onPointerDown={(event) => {
                event.stopPropagation()
                onSelect(node.id)
              }}
              className={cn(
                'absolute rounded-ui border bg-panel text-ink shadow-none outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent',
                selected ? 'border-accent ring-2 ring-accent/40' : 'border-line-strong',
                issue && 'outline outline-2 outline-danger',
                hovered && 'ring-2 ring-primary',
              )}
              style={{ left: node.position.x, top: node.position.y, width: NODE_W, height: nodeHeight(node) }}
            >
              <div
                className="flex cursor-grab items-center gap-1.5 rounded-t-ui border-b border-line bg-sunken px-2.5 active:cursor-grabbing"
                style={{ height: HEAD_H }}
                onPointerDown={(event) => onHeadDown(event, node)}
                onPointerMove={onHeadMove}
                onPointerUp={onHeadUp}
                onPointerCancel={onHeadUp}
              >
                <Badge tone={node.type === 'question' ? 'accent' : 'neutral'} size="sm">
                  {t(`faq.node.${node.type}`)}
                </Badge>
                {isRoot ? <Badge tone="primary" size="sm">{t('faq.node.root')}</Badge> : null}
                {issue ? <Badge tone="danger" size="sm">{t('faq.node.problem')}</Badge> : null}
              </div>
              <p className={cn('line-clamp-2 px-2.5 py-1.5 text-[13px] leading-snug', !text && 'italic text-muted')} style={{ height: TEXT_H }}>
                {text || t('faq.node.empty')}
              </p>
              {node.options.map((option) => {
                const label = pickText(option.label, lang)
                return (
                  <div key={option.id} className="relative flex items-center gap-1.5 border-t border-line px-2.5 text-[12.5px]" style={{ height: OPT_H }}>
                    <span className={cn('min-w-0 flex-1 truncate', !label && 'italic text-muted')}>{label || t('faq.node.emptyOption')}</span>
                    {option.transferToOperator ? (
                      <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted">
                        <Headphones size={13} strokeWidth={1.75} aria-hidden />
                        {t('faq.node.toOperator')}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      aria-label={t('faq.node.dragHandle', { label: label || t('faq.node.emptyOption') })}
                      title={t('faq.node.dragHandleHint')}
                      className={cn(
                        'absolute -right-2 top-1/2 size-4 -translate-y-1/2 cursor-crosshair touch-none rounded-full border-2 bg-panel transition-colors hover:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                        option.nextId || option.transferToOperator ? 'border-accent bg-accent' : 'border-line-strong',
                      )}
                      onPointerDown={(event) => onHandleDown(event, node, option.id)}
                      onPointerMove={onHandleMove}
                      onPointerUp={onHandleUp}
                      onPointerCancel={() => setConnecting(null)}
                    />
                  </div>
                )
              })}
              <span aria-hidden className="absolute -left-1.5 size-3 rounded-full border-2 border-line-strong bg-panel" style={{ top: HEAD_H / 2 - 6 }} />
            </div>
          )
        })}
      </div>

      <div className="absolute left-3 top-3 flex items-center gap-1 rounded-ui border border-line bg-panel p-1">
        <IconButton label={t('faq.canvas.zoomOut')} icon={<ZoomOut size={18} strokeWidth={1.75} />} size="sm" variant="ghost" onClick={() => zoomBy(1 / 1.2)} />
        <span className="tabular w-11 text-center text-xs text-muted" aria-live="polite">{Math.round(zoom * 100)}%</span>
        <IconButton label={t('faq.canvas.zoomIn')} icon={<ZoomIn size={18} strokeWidth={1.75} />} size="sm" variant="ghost" onClick={() => zoomBy(1.2)} />
        <IconButton label={t('faq.canvas.fit')} icon={<Maximize size={18} strokeWidth={1.75} />} size="sm" variant="ghost" onClick={fit} />
      </div>
      <p className="pointer-events-none absolute bottom-3 left-3 hidden max-w-[55%] rounded-ui bg-panel/90 px-2 py-1 text-[11px] text-muted sm:block">{t('faq.canvas.hint')}</p>

      <svg
        width={MM_W}
        height={MM_H}
        className="absolute bottom-3 right-3 hidden touch-none rounded-ui border border-line bg-panel sm:block"
        role="img"
        aria-label={t('faq.canvas.minimap')}
        onPointerDown={(event) => {
          event.stopPropagation()
          event.currentTarget.setPointerCapture(event.pointerId)
          mmCentre(event)
        }}
        onPointerMove={(event) => {
          if (event.buttons === 1) mmCentre(event)
        }}
      >
        <g transform={`scale(${mmScale}) translate(${-mm.minX} ${-mm.minY})`}>
          {nodes.map((node) => (
            <rect
              key={node.id}
              x={node.position.x}
              y={node.position.y}
              width={NODE_W}
              height={nodeHeight(node)}
              rx={8}
              fill={issueNodeIds.has(node.id) ? 'var(--c-danger, #c0392b)' : node.id === selectedId ? 'var(--c-accent)' : 'var(--c-muted)'}
              opacity={node.id === selectedId || issueNodeIds.has(node.id) ? 1 : 0.55}
            />
          ))}
          <rect x={view.x} y={view.y} width={view.w} height={view.h} fill="none" stroke="var(--c-accent)" strokeWidth={2 / mmScale} />
        </g>
      </svg>
    </div>
  )
}
