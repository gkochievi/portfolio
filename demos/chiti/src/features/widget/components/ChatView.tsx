/** The live conversation: messages, typing, waiting note, composer, ended banner. */
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { ArrowDown, Headset } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button, Spinner, toast } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { Lang } from '@/types'

import type { WidgetController, WidgetState } from '../controller'
import { TypingIndicator, WidgetBubble, WidgetComposer } from './chatParts'

export interface ChatViewProps {
  state: WidgetState
  controller: WidgetController
  lang: Lang
}

export function ChatView({ state, controller }: ChatViewProps) {
  const { t } = useTranslation('widget')
  const { session, messages, typing } = state
  const [draft, setDraft] = useState('')
  const [newBelow, setNewBelow] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const atBottom = useRef(true)
  const mountedAt = useRef(Date.now())

  const ended = session?.status === 'ended'
  const botMode = session?.aiState === 'bot'
  const waiting = !!session && session.status === 'waiting' && session.aiState !== 'bot'
  const last = messages[messages.length - 1]

  const scrollToBottom = useCallback((smooth = true) => {
    const el = scroller.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
    atBottom.current = true
    setNewBelow(false)
  }, [])

  // First paint: jump to the end without animation.
  useLayoutEffect(() => {
    scrollToBottom(false)
  }, [scrollToBottom])

  useLayoutEffect(() => {
    if (!last) return
    if (atBottom.current || last.sender === 'user') scrollToBottom(true)
    else setNewBelow(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, last?.id, typing?.who, waiting])

  const onScroll = () => {
    const el = scroller.current
    if (!el) return
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    if (atBottom.current) setNewBelow(false)
  }

  const send = async () => {
    const text = draft
    if (!text.trim()) return
    setDraft('')
    const error = await controller.sendText(text)
    if (error) {
      setDraft(text)
      toast.error(error)
    }
  }

  const sendFile = async (file: File) => {
    const error = await controller.sendFile(file)
    if (error === 'FILE_TOO_LARGE') toast.error(t('chat.fileTooLarge'))
    else if (error) toast.error(error)
  }

  const sendLocation = async () => {
    const error = await controller.sendLocation()
    if (error) toast.error(error)
  }

  const humanChip = botMode && !state.humanRequested && messages.length > 0

  const endedKey = session?.endedBy === 'customer' ? 'customer' : session?.endedBy === 'system' ? 'system' : session?.endedBy === 'admin' ? 'admin' : 'operator'

  const typingLabel =
    typing?.who === 'bot' ? t('typing.bot') : typing ? t('typing.operator', { name: typing.name ?? state.operator?.nickname ?? t('typing.someone') }) : null

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={scroller} onScroll={onScroll} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3.5 py-3" role="log" aria-live="polite" aria-label={t('chat.log')}>
        {messages.map((message, index) => {
          const previous = messages[index - 1]
          const showSender = !previous || previous.sender !== message.sender || previous.senderName !== message.senderName
          return (
            <WidgetBubble
              key={message.id}
              message={message}
              showSender={showSender}
              fresh={Date.parse(message.timestamp) > mountedAt.current}
              preChatCaption={message.isPreChat && !previous?.isPreChat}
            />
          )
        })}
        {typingLabel && <TypingIndicator label={typingLabel} bot={typing?.who === 'bot'} />}
        {waiting && (
          <div className="mx-auto mt-1 flex items-center gap-2 rounded-full border border-line bg-sunken px-3 py-1.5 text-[12.5px] text-muted" role="status">
            <Spinner size={14} />
            <span>{t('chat.waiting')}</span>
          </div>
        )}
        {ended && (
          <p className={cn('mx-auto mt-1 max-w-[90%] rounded-ui bg-sunken px-3 py-2 text-center text-[12.5px] text-muted')} role="status">
            {t(`chat.ended.${endedKey}`)}
          </p>
        )}
      </div>

      {newBelow && (
        <button
          type="button"
          onClick={() => scrollToBottom(true)}
          className="absolute bottom-[76px] left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-ink bg-primary px-3 py-1 text-[12px] font-medium text-on-primary shadow-pop animate-pop-in"
        >
          <ArrowDown size={13} strokeWidth={2} aria-hidden />
          {t('chat.newBelow')}
        </button>
      )}

      {ended ? (
        <div className="border-t border-line bg-panel px-4 py-3">
          <Button variant="primary" block onClick={() => controller.reset()}>
            {t('chat.startNew')}
          </Button>
        </div>
      ) : (
        <>
          {humanChip && (
            <div className="flex justify-center border-t border-line bg-panel px-3 pb-0 pt-2">
              <button
                type="button"
                disabled={state.requestingHuman}
                onClick={async () => {
                  const error = await controller.requestHuman()
                  if (error) toast.error(error)
                }}
                className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-accent bg-panel px-3.5 py-1.5 text-[13px] font-medium text-accent hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
              >
                <Headset size={15} strokeWidth={1.75} aria-hidden />
                {t('chat.talkToHuman')}
              </button>
            </div>
          )}
          <WidgetComposer
            value={draft}
            onChange={(value) => {
              setDraft(value)
              controller.notifyTyping(value)
            }}
            onSend={send}
            onFile={sendFile}
            onLocation={sendLocation}
            placeholder={t('chat.placeholder')}
          />
        </>
      )}
    </div>
  )
}
