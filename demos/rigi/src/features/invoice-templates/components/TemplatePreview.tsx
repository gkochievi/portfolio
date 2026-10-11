import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Banner, Card, CardHeader, Skeleton } from '@/components/ui'
import { isApiError } from '@/lib/api'
import type { TemplateBlock, TemplateMode } from '@/types'

import { previewTemplate } from '../api'

const PAGE_W = 794
const PAGE_H = 1123

export interface PreviewSource {
  mode: TemplateMode
  html: string
  css: string
  layout: TemplateBlock[]
  signatureDataUrl: string | null
}

interface Props {
  source: PreviewSource
  className?: string
}

/**
 * Live preview: the draft goes through POST /invoice-templates/preview on every
 * change (debounced) and the returned document is shown in a scaled A4 iframe.
 * The frame is sandboxed without scripts; same-origin only so the bundled fonts load.
 */
export function TemplatePreview({ source, className }: Props) {
  const { t, i18n } = useTranslation('invoice-templates')
  const lang = i18n.language === 'ka' ? 'ka' : 'en'
  const [html, setHtml] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(true)
  const [height, setHeight] = useState(PAGE_H)
  const [scale, setScale] = useState(0.6)
  const box = useRef<HTMLDivElement>(null)
  const seq = useRef(0)

  useEffect(() => {
    const id = ++seq.current
    setBusy(true)
    const timer = window.setTimeout(() => {
      previewTemplate(source, lang)
        .then((res) => {
          if (id !== seq.current) return
          setHtml(res.html)
          setError(null)
        })
        .catch((e: unknown) => {
          if (id !== seq.current) return
          setError(isApiError(e) ? e.message : t('preview.error'))
        })
        .finally(() => {
          if (id === seq.current) setBusy(false)
        })
    }, 250)
    return () => window.clearTimeout(timer)
  }, [source, lang, t])

  useEffect(() => {
    const el = box.current
    if (!el) return
    const update = () => setScale(Math.min(1, Math.max(0.2, el.clientWidth / PAGE_W)))
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <Card className={className}>
      <CardHeader title={t('preview.title')} description={t('preview.sample')} actions={busy ? <span className="text-xs text-muted">{t('preview.rendering')}</span> : undefined} />
      <div className="space-y-3 p-3">
        {error ? (
          <Banner tone="danger" title={t('preview.error')}>
            <span className="break-words font-mono text-xs">{error}</span>
          </Banner>
        ) : null}
        <div ref={box} className="w-full overflow-hidden rounded-md border border-hairline bg-sunken p-0">
          {html === null ? (
            <Skeleton className="aspect-[210/297] w-full" />
          ) : (
            <div style={{ height: height * scale }} className="relative">
              <iframe
                title={t('preview.frameTitle')}
                sandbox="allow-same-origin"
                srcDoc={html}
                style={{ width: PAGE_W, height, transform: `scale(${scale})`, transformOrigin: 'top left' }}
                className="absolute left-0 top-0 border-0 bg-white"
                onLoad={(e) => {
                  const doc = e.currentTarget.contentDocument
                  const h = doc ? Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight ?? 0) : PAGE_H
                  setHeight(Math.max(PAGE_H, h))
                }}
              />
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
