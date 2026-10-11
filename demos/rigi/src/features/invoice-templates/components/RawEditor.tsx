import { Wand2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, Card, CardBody, CardHeader, ConfirmDialog, Field, Textarea, toast } from '@/components/ui'
import type { TemplateBlock } from '@/types'

import { compileBlocks } from '../engine/document'
import { insertAt } from '../lib/draft'
import { TokenPicker } from './TokenPicker'

interface Props {
  html: string
  css: string
  layout: TemplateBlock[]
  htmlError?: string
  onHtml: (html: string) => void
  onCss: (css: string) => void
}

/** Two monospace editors with the token catalogue beside them. */
export function RawEditor({ html, css, layout, htmlError, onHtml, onCss }: Props) {
  const { t } = useTranslation('invoice-templates')
  const htmlRef = useRef<HTMLTextAreaElement>(null)
  const [confirm, setConfirm] = useState(false)

  const insert = (snippet: string, token: string) => {
    const el = htmlRef.current
    const next = insertAt(html, snippet, el?.selectionStart ?? null, el?.selectionEnd ?? null)
    onHtml(next.value)
    toast.success(t('tokens.inserted', { token: `{{${token}}}` }), { duration: 1200 })
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(next.caret, next.caret)
    })
  }

  const generate = () => {
    onHtml(compileBlocks(layout))
    setConfirm(false)
    toast.success(t('raw.fromBlocksDone'))
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_14rem]">
      <div className="min-w-0 space-y-4">
        <Card>
          <CardHeader
            title={t('raw.html')}
            actions={
              <Button size="sm" variant="secondary" icon={<Wand2 />} onClick={() => (html.trim() ? setConfirm(true) : generate())}>
                {t('raw.fromBlocks')}
              </Button>
            }
          />
          <CardBody className="space-y-3">
            <Field error={htmlError} htmlFor="raw-html" label={t('raw.html')}>
              <Textarea
                id="raw-html"
                ref={htmlRef}
                mono
                rows={16}
                spellCheck={false}
                invalid={Boolean(htmlError)}
                value={html}
                onChange={(e) => onHtml(e.target.value)}
                className="min-h-64 whitespace-pre text-xs leading-5 [overflow-wrap:normal] overflow-x-auto"
              />
            </Field>
            <div className="rounded-md bg-sunken p-3 text-xs text-muted">
              <div className="eyebrow mb-1.5">{t('raw.syntaxTitle')}</div>
              <ul className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                <li><code className="font-mono text-ink">{'{{value}}'}</code> {t('raw.syntaxEscaped')}</li>
                <li><code className="font-mono text-ink">{'{{{value}}}'}</code> {t('raw.syntaxRaw')}</li>
                <li><code className="font-mono text-ink">{'{{#list}}…{{/list}}'}</code> {t('raw.syntaxSection')}</li>
                <li><code className="font-mono text-ink">{'{{^list}}…{{/list}}'}</code> {t('raw.syntaxInverted')}</li>
              </ul>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t('raw.css')} />
          <CardBody>
            <Textarea
              aria-label={t('raw.css')}
              mono
              rows={12}
              spellCheck={false}
              value={css}
              onChange={(e) => onCss(e.target.value)}
              className="min-h-48 whitespace-pre text-xs leading-5 [overflow-wrap:normal] overflow-x-auto"
            />
          </CardBody>
        </Card>
      </div>
      <Card className="h-fit xl:sticky xl:top-4">
        <CardHeader title={t('tokens.title')} description={t('tokens.hint')} />
        <CardBody>
          <TokenPicker withSections className="max-h-96" onInsert={insert} />
        </CardBody>
      </Card>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t('raw.confirmReplaceTitle')}
        description={t('raw.confirmReplaceDescription')}
        confirmLabel={t('raw.replace')}
        tone="danger"
        onConfirm={generate}
      />
    </div>
  )
}
