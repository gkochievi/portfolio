import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, Dialog } from '@/components/ui'

const W = 600
const H = 200

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** PNG data URL of the 600x200 drawing. */
  onSave: (dataUrl: string) => void
}

/** A 600x200 canvas pad exported as a transparent PNG data URL (nothing leaves the browser). */
export function SignaturePadDialog({ open, onOpenChange, onSave }: Props) {
  const { t } = useTranslation(['invoice-templates', 'common'])
  const canvas = useRef<HTMLCanvasElement | null>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const [dirty, setDirty] = useState(false)
  const [showEmpty, setShowEmpty] = useState(false)

  const context = useCallback(() => {
    const ctx = canvas.current?.getContext('2d') ?? null
    if (ctx) {
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.lineWidth = 3
      ctx.strokeStyle = '#1F2124'
    }
    return ctx
  }, [])

  const clear = useCallback(() => {
    canvas.current?.getContext('2d')?.clearRect(0, 0, W, H)
    setDirty(false)
    setShowEmpty(false)
  }, [])

  useEffect(() => {
    if (open) {
      setDirty(false)
      setShowEmpty(false)
    }
  }, [open])

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: ((e.clientX - rect.left) / rect.width) * W, y: ((e.clientY - rect.top) / rect.height) * H }
  }

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = true
    const p = point(e)
    last.current = p
    const ctx = context()
    if (ctx) {
      // A tap leaves a dot.
      ctx.beginPath()
      ctx.moveTo(p.x, p.y)
      ctx.lineTo(p.x + 0.01, p.y)
      ctx.stroke()
    }
    setDirty(true)
    setShowEmpty(false)
  }

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current) return
    const p = point(e)
    const ctx = context()
    if (!ctx) return
    ctx.beginPath()
    ctx.moveTo(last.current.x, last.current.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    last.current = p
  }

  const end = () => {
    drawing.current = false
    last.current = null
  }

  const save = () => {
    if (!dirty || !canvas.current) return setShowEmpty(true)
    onSave(canvas.current.toDataURL('image/png'))
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={t('signature.dialogTitle')}
      description={t('signature.dialogDescription')}
      footer={
        <>
          <Button variant="ghost" onClick={clear}>
            {t('signature.clearPad')}
          </Button>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common:actions.cancel')}
          </Button>
          <Button onClick={save}>{t('signature.use')}</Button>
        </>
      }
    >
      <div className="rounded-md border border-hairline-strong bg-white">
        <canvas
          ref={canvas}
          width={W}
          height={H}
          role="img"
          aria-label={t('signature.canvasLabel')}
          className="block aspect-[3/1] w-full cursor-crosshair touch-none"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={end}
          onPointerCancel={end}
          onPointerLeave={end}
        />
      </div>
      <div className="mt-2 h-px bg-hairline" aria-hidden />
      {showEmpty ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {t('signature.empty')}
        </p>
      ) : null}
    </Dialog>
  )
}
