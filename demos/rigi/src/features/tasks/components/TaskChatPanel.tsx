/**
 * CROSS-GROUP CONTRACT. Owner: tasks.
 * Task chat. Not a live socket: it fetches on mount, after a send, on Refresh,
 * and whenever the shell reports `task-messages` changed (the demo's canned
 * staff reply lands that way).
 * realm 'staff'   -> /api/tasks/:id/messages, with the internal-only checkbox.
 * realm 'partner' -> /api/portal/tasks/:id/messages, no internal control, the
 *                    partner's own messages are right-aligned.
 * Consumed by the L1 / technician workspace and by portal's PortalTaskPage.
 */
import { Lock, RefreshCw, Send } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Avatar, Badge, Banner, Button, Card, CardBody, CardHeader, Checkbox, EmptyState, IconButton, Skeleton, Textarea, toast } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatDateTime, localName } from '@/lib/format'

import { errorMessage, fieldErrorsOf, type TaskMessageDto, useSendTaskMessage, useTaskMessages } from '../api'

export interface TaskChatPanelProps {
  taskId: string
  realm: 'staff' | 'partner'
}

const MAX = 10000

function Bubble({ message, realm }: { message: TaskMessageDto; realm: 'staff' | 'partner' }) {
  const { t } = useTranslation('tasks')
  const fromPartner = message.authorKind === 'partner'
  // In the portal the partner's own messages sit on the right; staff keep the left.
  const mine = realm === 'partner' && fromPartner
  const name = localName({ fullName: message.authorName, fullNameKa: message.authorNameKa })
  return (
    <li className={cn('flex gap-2.5', mine && 'flex-row-reverse')}>
      <Avatar name={name} size="sm" />
      <div className={cn('min-w-0 max-w-[85%]', mine && 'text-right')}>
        <div className={cn('flex flex-wrap items-baseline gap-x-2 text-xs text-muted', mine && 'justify-end')}>
          <span className="font-medium text-ink">{realm === 'staff' && fromPartner ? t('chat.partnerAuthor', { name }) : name}</span>
          <span className="num">{formatDateTime(message.createdAt)}</span>
          {message.internalOnly ? (
            <Badge tone="warning" icon={<Lock aria-hidden />}>
              {t('chat.internalBadge')}
            </Badge>
          ) : null}
        </div>
        <div
          className={cn(
            'mt-1 inline-block whitespace-pre-wrap break-words rounded-lg border px-3 py-2 text-left text-sm',
            mine ? 'border-primary/30 bg-primary/10' : fromPartner ? 'border-accent/30 bg-accent/10' : 'border-hairline bg-panel',
            message.internalOnly && 'border-dashed border-warning/50 bg-warning/10',
          )}
        >
          {message.body}
        </div>
      </div>
    </li>
  )
}

export function TaskChatPanel({ taskId, realm }: TaskChatPanelProps) {
  const { t } = useTranslation(['tasks', 'common'])
  const messages = useTaskMessages(taskId, realm)
  const send = useSendTaskMessage(taskId, realm)
  const [body, setBody] = useState('')
  const [internalOnly, setInternalOnly] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const endRef = useRef<HTMLLIElement | null>(null)
  const count = messages.data?.length ?? 0

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [count])

  const submit = () => {
    const text = body.trim()
    if (!text) {
      setError(t('chat.errors.required'))
      return
    }
    if (text.length > MAX) {
      setError(t('chat.errors.tooLong', { max: MAX }))
      return
    }
    setError(null)
    send.mutate(
      { body: text, internalOnly: realm === 'staff' && internalOnly },
      {
        onSuccess: () => {
          setBody('')
          setInternalOnly(false)
          void messages.refetch()
        },
        onError: (e) => {
          const fields = fieldErrorsOf(e)
          setError(fields.body ?? errorMessage(e))
          toast.error(t('chat.sendFailed'))
        },
      },
    )
  }

  return (
    <Card>
      <CardHeader
        title={t('chat.title')}
        description={t(realm === 'staff' ? 'chat.descriptionStaff' : 'chat.descriptionPartner')}
        actions={
          <IconButton
            label={t('common:actions.refresh')}
            icon={<RefreshCw className={cn(messages.isFetching && 'animate-spin')} />}
            variant="ghost"
            onClick={() => void messages.refetch()}
          />
        }
      />
      <CardBody className="space-y-4">
        {messages.isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="ml-auto h-12 w-2/3" />
            <Skeleton className="h-12 w-1/2" />
          </div>
        ) : messages.isError ? (
          <Banner
            tone="danger"
            title={t('chat.loadFailed')}
            action={
              <Button size="sm" variant="secondary" onClick={() => void messages.refetch()}>
                {t('common:actions.retry')}
              </Button>
            }
          />
        ) : count === 0 ? (
          <EmptyState compact title={t('chat.empty')} description={t('chat.emptyHint')} />
        ) : (
          <ul className="max-h-[28rem] space-y-4 overflow-y-auto pr-1" aria-live="polite" aria-label={t('chat.title')}>
            {messages.data.map((m) => (
              <Bubble key={m.id} message={m} realm={realm} />
            ))}
            <li ref={endRef} aria-hidden />
          </ul>
        )}

        <div className="space-y-2 border-t border-hairline pt-4">
          <Textarea
            value={body}
            rows={3}
            invalid={Boolean(error)}
            placeholder={t('chat.placeholder')}
            aria-label={t('chat.placeholder')}
            onChange={(e) => {
              setBody(e.target.value)
              if (error) setError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                submit()
              }
            }}
          />
          {error ? <p className="text-xs text-danger">{error}</p> : null}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {realm === 'staff' ? (
              <Checkbox
                label={t('chat.internalOnly')}
                description={t('chat.internalOnlyHint')}
                checked={internalOnly}
                onChange={(e) => setInternalOnly(e.target.checked)}
              />
            ) : (
              <span />
            )}
            <div className="flex items-center gap-3">
              <span className="num text-xs text-subtle">
                {body.length}/{MAX}
              </span>
              <Button icon={<Send />} loading={send.isPending} onClick={submit}>
                {t('chat.send')}
              </Button>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  )
}
