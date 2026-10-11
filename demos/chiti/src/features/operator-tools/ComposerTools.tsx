import { useState } from 'react'
import { LayoutTemplate } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button, IconButton } from '@/components/ui'
import type { SessionDetail } from '@/types'

import { QuickReplies } from './components/QuickReplies'
import { TemplatePicker } from './components/TemplatePicker'

/**
 * Buttons that sit in the inbox composer toolbar: the quick-replies popover
 * (always) and the WhatsApp template picker (WhatsApp chats; highlighted when
 * the free-form window is closed and a template is the only way to write).
 */
export interface ComposerToolsProps {
  detail: SessionDetail
  onInsert: (text: string) => void
}

export function ComposerTools({ detail, onInsert }: ComposerToolsProps) {
  const { t } = useTranslation('operatorTools')
  const [pickerOpen, setPickerOpen] = useState(false)
  const { session, window: replyWindow } = detail
  if (session.status === 'ended') return null

  const isWhatsApp = session.channel === 'whatsapp'
  const highlight = isWhatsApp && replyWindow.remedy === 'template'

  return (
    <>
      <QuickReplies sessionId={session.id} customerLang={session.clientLanguage} onInsert={onInsert} />
      {isWhatsApp ? (
        <>
          {highlight ? (
            <Button size="xs" variant="primary" leftIcon={<LayoutTemplate size={14} />} onClick={() => setPickerOpen(true)}>
              {t('templates.sendButton')}
            </Button>
          ) : (
            <IconButton label={t('templates.open')} icon={<LayoutTemplate />} variant="muted" size="sm" onClick={() => setPickerOpen(true)} />
          )}
          <TemplatePicker open={pickerOpen} onOpenChange={setPickerOpen} detail={detail} />
        </>
      ) : null}
    </>
  )
}
