import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, EyeOff, Eye, ExternalLink, MessageSquareReply, Send, Trash2 } from 'lucide-react'

import { errorMessage } from '@/api/client'
import { Avatar, Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, FilterChip, PageHeader, SkeletonRow, Textarea, Toolbar, toast } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatRelative } from '@/lib/format'
import { useNow } from '@/lib/realtime'
import type { PageComment } from '@/types'

import { useComments, useDeleteComment, useHideComment, useReplyComment } from '../api'
import { BackLink, ChannelIcon, copyText, useFieldMessage, useLang, type Lang } from '../components/shared'

type Filter = 'all' | 'facebook_messenger' | 'instagram'

export default function CommentsPage() {
  const { t } = useTranslation(['adminIntegrations', 'common'])
  const lang = useLang()
  const [filter, setFilter] = useState<Filter>('all')
  const query = useComments(filter)
  const [toDelete, setToDelete] = useState<PageComment | null>(null)
  const remove = useDeleteComment()
  const nowMs = useNow(30_000)

  const groups = useMemo(() => {
    const map = new Map<string, { postId: string; caption: string; channel: PageComment['channel']; comments: PageComment[]; latest: number }>()
    for (const comment of query.data ?? []) {
      const group = map.get(comment.externalPostId) ?? { postId: comment.externalPostId, caption: comment.postCaption, channel: comment.channel, comments: [], latest: 0 }
      group.comments.push(comment)
      group.latest = Math.max(group.latest, Date.parse(comment.externalCreatedAt))
      map.set(comment.externalPostId, group)
    }
    return [...map.values()].sort((a, b) => b.latest - a.latest)
  }, [query.data])

  const header = (
    <>
      <BackLink />
      <PageHeader title={t('comments.title')} description={t('comments.description')} />
      <Toolbar>
        {(['all', 'facebook_messenger', 'instagram'] as const).map((value) => (
          <FilterChip key={value} active={filter === value} onClick={() => setFilter(value)} icon={value === 'all' ? undefined : <ChannelIcon channel={value} size={14} />}>
            {value === 'all' ? t('comments.filter.all') : t(`comments.platform.${value}`)}
          </FilterChip>
        ))}
      </Toolbar>
    </>
  )

  if (query.isError && !query.data) {
    return (
      <div>
        {header}
        <ErrorState title={t('comments.loadError')} description={errorMessage(query.error)} onRetry={() => void query.refetch()} retryLabel={t('common:actions.retry')} />
      </div>
    )
  }

  if (!query.data) {
    return (
      <div>
        {header}
        <Card className="flex flex-col gap-4">
          {[0, 1, 2].map((n) => (
            <SkeletonRow key={n} />
          ))}
        </Card>
      </div>
    )
  }

  return (
    <div>
      {header}
      {groups.length === 0 ? (
        <EmptyState title={t('comments.empty.title')} description={t('comments.empty.description')} />
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((group) => (
            <Card key={group.postId} padding="none">
              <header className="flex items-start gap-3 border-b border-line bg-sunken px-4 py-3">
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-ui bg-panel">
                  <ChannelIcon channel={group.channel} size={18} />
                </span>
                <div className="min-w-0">
                  <p className="text-xs text-muted">{t('comments.post', { channel: t(`comments.platform.${group.channel}`), count: group.comments.length })}</p>
                  <p className="line-clamp-2 text-sm font-medium">{group.caption}</p>
                </div>
              </header>
              <ul className="divide-y divide-line">
                {group.comments.map((comment) => (
                  <CommentItem key={comment.id} comment={comment} lang={lang} nowMs={nowMs} onDelete={() => setToDelete(comment)} />
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        tone="danger"
        title={t('comments.deleteTitle')}
        description={t('comments.deleteDescription', { author: toDelete?.authorName ?? '' })}
        confirmLabel={t('common:actions.delete')}
        onConfirm={async () => {
          if (!toDelete) return
          await remove.mutateAsync(toDelete.id)
          toast.success(t('comments.deleted'))
        }}
      />
    </div>
  )
}

function CommentItem({ comment, lang, nowMs, onDelete }: { comment: PageComment; lang: Lang; nowMs: number; onDelete: () => void }) {
  const { t } = useTranslation(['adminIntegrations', 'common'])
  const reply = useReplyComment()
  const hide = useHideComment()
  const message = useFieldMessage()
  const [replying, setReplying] = useState(false)
  const [text, setText] = useState('')
  const [showLink, setShowLink] = useState(false)

  const send = async () => {
    try {
      await reply.mutateAsync({ id: comment.id, text })
      setReplying(false)
      setText('')
      toast.success(t('comments.replySent'))
    } catch (error) {
      if (!message(error, 'text')) toast.error(errorMessage(error))
    }
  }

  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:gap-4">
      <Avatar name={comment.authorName} avatarId={comment.authorAvatarId} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium">{comment.authorName}</span>
          <span className="inline-flex items-center gap-1 text-xs text-muted">
            <ChannelIcon channel={comment.channel} size={12} />
            {t(`comments.platform.${comment.channel}`)}
          </span>
          <span className="text-xs text-muted">· {formatRelative(comment.externalCreatedAt, lang, nowMs)}</span>
          {comment.isHidden ? (
            <Badge tone="warning" size="sm" icon={<EyeOff />}>
              {t('comments.hidden')}
            </Badge>
          ) : null}
        </div>
        <p className={cn('mt-1 whitespace-pre-wrap break-words text-sm', comment.isHidden && 'text-muted line-through decoration-line-strong/60')}>{comment.text}</p>

        {comment.repliedAt && comment.replyText ? (
          <div className="mt-3 rounded-ui border-l-2 border-accent bg-accent-soft px-3 py-2 text-sm">
            <p className="mb-0.5 text-xs text-muted">{t('comments.repliedBy', { name: comment.repliedByName ?? '', time: formatRelative(comment.repliedAt, lang, nowMs) })}</p>
            <p className="whitespace-pre-wrap break-words">{comment.replyText}</p>
          </div>
        ) : null}

        {replying ? (
          <form
            className="mt-3 flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              void send()
            }}
          >
            <Textarea
              autoFocus
              rows={3}
              maxLength={1000}
              value={text}
              invalid={!!message(reply.error, 'text')}
              placeholder={t('comments.replyPlaceholder')}
              aria-label={t('comments.replyPlaceholder')}
              onChange={(event) => setText(event.target.value)}
            />
            {message(reply.error, 'text') ? <p className="text-[13px] text-danger" role="alert">{message(reply.error, 'text')}</p> : null}
            <div className="flex gap-2">
              <Button type="submit" size="sm" variant="accent" loading={reply.isPending} disabled={!text.trim()} leftIcon={<Send size={14} strokeWidth={1.75} />}>
                {t('comments.sendReply')}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setReplying(false)}>
                {t('common:actions.cancel')}
              </Button>
            </div>
          </form>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-1.5">
          {!comment.repliedAt && !replying ? (
            <Button size="xs" variant="outline" leftIcon={<MessageSquareReply size={14} strokeWidth={1.75} />} onClick={() => setReplying(true)}>
              {t('comments.reply')}
            </Button>
          ) : null}
          <Button
            size="xs"
            variant="outline"
            loading={hide.isPending}
            leftIcon={comment.isHidden ? <Eye size={14} strokeWidth={1.75} /> : <EyeOff size={14} strokeWidth={1.75} />}
            onClick={async () => {
              try {
                await hide.mutateAsync({ id: comment.id, hidden: !comment.isHidden })
                toast.success(comment.isHidden ? t('comments.unhidden') : t('comments.hiddenToast'))
              } catch (error) {
                toast.error(errorMessage(error))
              }
            }}
          >
            {comment.isHidden ? t('comments.unhide') : t('comments.hide')}
          </Button>
          <Button size="xs" variant="danger-outline" leftIcon={<Trash2 size={14} strokeWidth={1.75} />} onClick={onDelete}>
            {t('common:actions.delete')}
          </Button>
          <Button size="xs" variant="ghost" leftIcon={<ExternalLink size={14} strokeWidth={1.75} />} aria-expanded={showLink} onClick={() => setShowLink((v) => !v)}>
            {t('comments.openOnPlatform')}
          </Button>
        </div>

        {showLink ? (
          <div className="mt-2 flex items-center gap-2 rounded-ui bg-sunken px-3 py-2">
            <code className="min-w-0 flex-1 break-all font-mono text-[12.5px]">{comment.permalink}</code>
            <Button
              size="xs"
              variant="ghost"
              leftIcon={<Copy size={14} strokeWidth={1.75} />}
              onClick={async () => ((await copyText(comment.permalink)) ? toast.success(t('common:actions.copied')) : toast.error(t('channels.meta.copyFailed')))}
            >
              {t('common:actions.copy')}
            </Button>
          </div>
        ) : null}
      </div>
    </li>
  )
}
