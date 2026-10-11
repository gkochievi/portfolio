import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, Hash, MessageSquare } from 'lucide-react'

import { Avatar, EmptyState, ErrorState, LoadingBlock } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatSmartDate, formatTime, personName, pickText } from '@/lib/format'
import { useInvalidateOn } from '@/lib/realtime'
import { queryKeys } from '@/api/queryKeys'
import type { StaffConversation } from '@/types'

import { useStaffChatMessages, useStaffChats } from '../api'

function conversationTitle(conversation: StaffConversation, lang: string): string {
  if (conversation.title) return pickText(conversation.title, lang)
  return conversation.members.map((member) => personName(member.name, lang)).join(' · ')
}

/** Team-chat audit: every staff conversation of the tenant, read-only. */
export function StaffChatTab({ tenantId }: { tenantId: string }) {
  const { t, i18n } = useTranslation('superadmin')
  const lang = i18n.language
  const chats = useStaffChats(tenantId)
  const [selected, setSelected] = useState<string | null>(null)
  useInvalidateOn(['staff:message', 'staff:conversation'], queryKeys.superadmin.all)

  useEffect(() => {
    if (selected === null && chats.data && chats.data[0]) setSelected(chats.data[0].id)
  }, [chats.data, selected])

  const messages = useStaffChatMessages(selected)
  const current = chats.data?.find((row) => row.id === selected)

  if (chats.isLoading) return <LoadingBlock label={t('common:states.loading')} />
  if (chats.isError) return <ErrorState title={t('chats.error')} onRetry={() => void chats.refetch()} retryLabel={t('common:actions.retry')} />
  if (!chats.data || chats.data.length === 0) return <EmptyState compact icon={<MessageSquare />} title={t('chats.empty')} description={t('chats.emptyHint')} />

  return (
    <div className="space-y-3">
      <p className="inline-flex items-center gap-2 rounded-ui bg-sunken px-3 py-2 text-[13px] text-muted">
        <Eye size={15} strokeWidth={1.75} aria-hidden />
        {t('chats.readOnly')}
      </p>
      <div className="grid gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
        <ul className="max-h-[420px] divide-y divide-line overflow-auto rounded-modal border border-line bg-panel" aria-label={t('chats.list')}>
          {chats.data.map((conversation) => (
            <li key={conversation.id}>
              <button
                type="button"
                onClick={() => setSelected(conversation.id)}
                aria-current={conversation.id === selected}
                className={cn('flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent', conversation.id === selected && 'bg-accent-soft')}
              >
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-sunken text-muted" aria-hidden>
                  {conversation.kind === 'room' ? <Hash size={15} strokeWidth={1.75} /> : <MessageSquare size={15} strokeWidth={1.75} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[13px] font-medium text-ink">{conversationTitle(conversation, lang)}</span>
                    {conversation.lastMessageAt && <span className="shrink-0 text-[11px] text-muted">{formatSmartDate(conversation.lastMessageAt, lang)}</span>}
                  </span>
                  <span className="block truncate text-[12px] text-muted">{conversation.lastMessageText ?? t('chats.noMessages')}</span>
                  <span className="text-[11px] text-muted">{t('chats.members', { count: conversation.members.length })}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>

        <div className="min-w-0 rounded-modal border border-line bg-panel">
          <header className="border-b border-line px-4 py-2.5 text-[14px] font-medium text-ink">{current ? conversationTitle(current, lang) : ''}</header>
          <div className="max-h-[420px] space-y-3 overflow-auto p-4" tabIndex={0} aria-label={t('chats.thread')}>
            {messages.isLoading ? (
              <LoadingBlock label={t('common:states.loading')} />
            ) : messages.isError ? (
              <ErrorState title={t('chats.error')} onRetry={() => void messages.refetch()} retryLabel={t('common:actions.retry')} />
            ) : (messages.data ?? []).length === 0 ? (
              <EmptyState compact title={t('chats.noMessages')} />
            ) : (
              (messages.data ?? []).map((message) => (
                <div key={message.id} className="flex items-start gap-2.5">
                  <Avatar name={personName(message.senderName, lang)} size="sm" />
                  <div className="min-w-0">
                    <p className="text-[12px] text-muted">
                      <span className="font-medium text-ink">{personName(message.senderName, lang)}</span> · {t(`common:role.${message.senderRole}`)} · {formatSmartDate(message.timestamp, lang)} {formatTime(message.timestamp)}
                    </p>
                    <p className="mt-0.5 whitespace-pre-wrap break-words rounded-bubble bg-sunken px-3 py-2 text-[14px] text-ink">
                      {message.type === 'text' ? message.content : (message.fileName ?? message.content)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
