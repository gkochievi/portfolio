import { useRef, useState, type KeyboardEvent } from 'react'
import { FileUp, ImagePlus, SendHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { IconButton, Textarea, toast } from '@/components/ui'
import type { StaffMessage } from '@/types'

const MAX_LENGTH = 2000
const MAX_FILE_BYTES = 10 * 1024 * 1024

interface ComposerProps {
  onSend: (input: { type: StaffMessage['type']; content: string; fileUrl: string | null; fileName: string | null }) => void
  onTyping: () => void
  onStopTyping: () => void
}

export function Composer({ onSend, onTyping, onStopTyping }: ComposerProps) {
  const { t } = useTranslation('team')
  const [text, setText] = useState('')
  const imageInput = useRef<HTMLInputElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const tooLong = text.length > MAX_LENGTH
  const canSend = text.trim().length > 0

  const submit = () => {
    const content = text.trim()
    if (!content) return
    onSend({ type: 'text', content, fileUrl: null, fileName: null })
    setText('')
    onStopTyping()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit()
    }
  }

  const attach = (files: FileList | null, kind: 'image' | 'file') => {
    const file = files?.[0]
    if (!file) return
    if (file.size > MAX_FILE_BYTES) {
      toast.error(t('composer.tooBig'))
      return
    }
    const isImage = kind === 'image' || file.type.startsWith('image/')
    onSend({ type: isImage ? 'image' : 'file', content: text.trim(), fileUrl: URL.createObjectURL(file), fileName: file.name })
    setText('')
    onStopTyping()
  }

  return (
    <div className="border-t border-line bg-panel p-3">
      <div className="flex items-end gap-2">
        <div className="flex shrink-0 items-center">
          <IconButton label={t('composer.image')} icon={<ImagePlus size={18} strokeWidth={1.75} />} size="sm" onClick={() => imageInput.current?.click()} />
          <IconButton label={t('composer.file')} icon={<FileUp size={18} strokeWidth={1.75} />} size="sm" onClick={() => fileInput.current?.click()} />
        </div>
        <Textarea
          value={text}
          onChange={(event) => {
            setText(event.target.value)
            if (event.target.value) onTyping()
          }}
          onKeyDown={onKeyDown}
          onBlur={onStopTyping}
          placeholder={t('composer.placeholder')}
          aria-label={t('composer.placeholder')}
          rows={1}
          autoGrow
          maxRows={5}
          invalid={tooLong}
          className="min-h-10 flex-1"
        />
        <IconButton
          label={t('composer.send')}
          icon={<SendHorizontal size={18} strokeWidth={1.75} />}
          variant="primary"
          disabled={!canSend}
          onClick={submit}
        />
      </div>
      {tooLong ? <p className="mt-1.5 text-xs text-danger">{t('composer.tooLong', { max: MAX_LENGTH })}</p> : null}
      <input ref={imageInput} type="file" accept="image/*" hidden onChange={(event) => { attach(event.target.files, 'image'); event.target.value = '' }} />
      <input ref={fileInput} type="file" hidden onChange={(event) => { attach(event.target.files, 'file'); event.target.value = '' }} />
    </div>
  )
}
