import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CheckCheck, Download, EyeOff, ListPlus, MessagesSquare } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { MailStatusChip } from '@/components/status'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  CopyButton,
  DescriptionList,
  EmptyState,
  PageHeader,
  PageSkeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast,
} from '@/components/ui'
import { downloadText } from '@/lib/csv'
import { formatDateTime } from '@/lib/format'

import { errorMessage, useIgnoreMail, useMail, useTriageMail } from '../api'
import { AttachmentList } from '../components/AttachmentList'
import { HtmlBody } from '../components/HtmlBody'
import { TaskLinkList } from '../components/TaskLinkList'

const IGNORABLE = ['new', 'triaged', 'followup']

export default function MailDetailPage() {
  const { t } = useTranslation(['support-desk', 'common'])
  const { mailId = '' } = useParams()
  const query = useMail(mailId)
  const ignore = useIgnoreMail()
  const triage = useTriageMail()
  const [confirmIgnore, setConfirmIgnore] = useState(false)

  if (query.isPending) return <PageSkeleton />
  if (query.isError || !query.data) {
    return (
      <>
        <PageHeader title={t('mail.notFoundTitle')} back={{ to: '/l1/mails', label: t('mail.back') }} />
        <EmptyState
          title={t('mail.notFound')}
          action={<Button variant="secondary" onClick={() => void query.refetch()}>{t('common:actions.retry')}</Button>}
        />
      </>
    )
  }

  const { mail, attachments, linkedTasks, thread, partner, raw } = query.data
  const canIgnore = IGNORABLE.includes(mail.status)
  const addrs = (list: string[]) => (list.length ? list.join(', ') : '-')

  const onIgnore = () =>
    ignore.mutate(mail.id, {
      onSuccess: () => {
        setConfirmIgnore(false)
        toast.success(t('mail.ignored'))
      },
      onError: (e) => {
        setConfirmIgnore(false)
        toast.error(errorMessage(e))
      },
    })
  const onTriage = () =>
    triage.mutate(mail.id, {
      onSuccess: () => toast.success(t('mail.triaged')),
      onError: (e) => toast.error(errorMessage(e)),
    })

  return (
    <>
      <PageHeader
        eyebrow={t('mail.eyebrow')}
        title={mail.subject || t('mail.noSubject')}
        back={{ to: '/l1/mails', label: t('mail.back') }}
        meta={<MailStatusChip status={mail.status} />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {mail.status === 'new' ? (
              <Button variant="secondary" icon={<CheckCheck />} loading={triage.isPending} onClick={onTriage}>
                {t('mail.markTriaged')}
              </Button>
            ) : null}
            {canIgnore ? (
              <Button variant="secondary" icon={<EyeOff />} onClick={() => setConfirmIgnore(true)}>
                {t('mail.ignore')}
              </Button>
            ) : null}
            {thread ? (
              <Button asChild variant="secondary" icon={<MessagesSquare />}>
                <Link to={`/l1/threads/${thread.id}`}>{t('mail.viewThread')}</Link>
              </Button>
            ) : null}
            <Button asChild icon={<ListPlus />}>
              <Link to={`/l1/tasks/new?mailId=${mail.id}`}>{t('mail.createTask')}</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardBody>
              <DescriptionList
                columns={2}
                items={[
                  { label: t('mail.from'), value: `${mail.fromName ? `${mail.fromName} ` : ''}<${mail.fromAddr}>` },
                  { label: t('mail.received'), value: formatDateTime(mail.receivedAt) },
                  { label: t('mail.to'), value: addrs(mail.toAddrs), full: true },
                  mail.ccAddrs.length ? { label: t('mail.cc'), value: addrs(mail.ccAddrs), full: true } : null,
                  { label: t('mail.ingested'), value: formatDateTime(mail.ingestedAt) },
                  partner ? { label: t('mail.partner'), value: partner.name } : null,
                  {
                    label: t('mail.messageId'),
                    mono: true,
                    full: true,
                    value: (
                      <span className="inline-flex max-w-full items-center gap-1.5">
                        <span className="break-all">{mail.messageId}</span>
                        <CopyButton value={mail.messageId} size="sm" />
                      </span>
                    ),
                  },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <Tabs defaultValue={mail.bodyHtml ? 'html' : 'text'}>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-4 pt-3">
                <TabsList>
                  <TabsTrigger value="html">{t('mail.tabs.html')}</TabsTrigger>
                  <TabsTrigger value="text">{t('mail.tabs.text')}</TabsTrigger>
                  <TabsTrigger value="raw">{t('mail.tabs.raw')}</TabsTrigger>
                </TabsList>
              </div>
              <CardBody>
                <TabsContent value="html">
                  {mail.bodyHtml ? (
                    <HtmlBody html={mail.bodyHtml} title={t('mail.htmlFrame')} />
                  ) : (
                    <EmptyState compact title={t('mail.noHtml')} description={t('mail.noHtmlHint')} />
                  )}
                </TabsContent>
                <TabsContent value="text">
                  <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-6 text-ink">{mail.bodyText}</pre>
                </TabsContent>
                <TabsContent value="raw">
                  <div className="mb-3 flex justify-end">
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<Download />}
                      onClick={() => downloadText(`${mail.id}.eml`, raw, 'message/rfc822')}
                    >
                      {t('mail.downloadEml')}
                    </Button>
                  </div>
                  <pre className="max-h-[480px] overflow-auto rounded-md border border-hairline bg-sunken p-3 font-mono text-xs leading-5 text-ink">{raw}</pre>
                </TabsContent>
              </CardBody>
            </Tabs>
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title={t('mail.attachments')} description={attachments.length ? t('mail.attachmentsHint') : undefined} />
            <CardBody>
              {attachments.length === 0 ? (
                <p className="text-sm text-muted">{t('mail.noAttachments')}</p>
              ) : (
                <AttachmentList attachments={attachments} className="flex-col [&>li]:w-full [&_button]:w-full" />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t('mail.linkedTasks')} />
            <CardBody>
              {linkedTasks.length === 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted">{t('mail.noLinkedTasks')}</p>
                  <Button asChild size="sm" variant="secondary" icon={<ListPlus />}>
                    <Link to={`/l1/tasks/new?mailId=${mail.id}`}>{t('mail.createTask')}</Link>
                  </Button>
                </div>
              ) : (
                <TaskLinkList tasks={linkedTasks} />
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirmIgnore}
        onOpenChange={setConfirmIgnore}
        title={t('mail.ignoreTitle')}
        description={t('mail.ignoreDescription')}
        confirmLabel={t('mail.ignore')}
        tone="danger"
        pending={ignore.isPending}
        onConfirm={onIgnore}
      />
    </>
  )
}
