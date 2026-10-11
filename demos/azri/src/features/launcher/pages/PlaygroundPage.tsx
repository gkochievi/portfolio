/**
 * API playground (/playground): the source's test-cases page, grown up.
 * Three request cards for the survey calls, a demo clock for time travel and
 * the list of every mock endpoint. Owner: launcher.
 */
import { FileQuestion, Info, Inbox, Send, ShieldCheck } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Button, Card, PageHeader } from '@/components/ui'
import { useLang } from '@/hooks/useLang'
import { lt } from '@/lib/utils'

import { useAllInboxes, useRecipients } from '../api'
import { ClockCard, RequestCard, RoutesCard, type TokenOption } from '../components/playground'

const ICON = { size: 20, strokeWidth: 1.75 } as const
/** Mariam's pending Nergi Bank link: the token every card starts with. */
const DEFAULT_TOKEN = '7KQ2M9'

export default function PlaygroundPage() {
  const { t } = useTranslation('launcher')
  const lang = useLang()
  const recipients = useRecipients()
  const inboxes = useAllInboxes((recipients.data ?? []).map((recipient) => recipient.id))

  const options = useMemo<TokenOption[]>(() => {
    const seen = new Set<string>()
    const list: TokenOption[] = []
    for (const message of inboxes.messages) {
      if (!message.surveyId || seen.has(message.surveyId)) continue
      seen.add(message.surveyId)
      const person = recipients.data?.find((recipient) => recipient.id === message.recipientId)
      list.push({
        token: message.surveyId,
        status: message.linkStatus,
        label: [person ? lt(person.name, lang) : null, lt(message.tenant.name, lang)].filter(Boolean).join(' · '),
      })
    }
    const order = { pending: 0, completed: 1, expired: 2, unknown: 3, missing: 4 } as const
    return list.sort((a, b) => order[a.status] - order[b.status])
  }, [inboxes.messages, recipients.data, lang])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('playground.eyebrow')}
        title={t('playground.title')}
        description={t('playground.description')}
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link to="/">
              <Inbox {...ICON} className="size-4" />
              {t('playground.backToInbox')}
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="min-w-0 space-y-5">
          <RequestCard kind="validate" options={options} defaultToken={DEFAULT_TOKEN} icon={<ShieldCheck {...ICON} />} />
          <RequestCard kind="questions" options={options} defaultToken={DEFAULT_TOKEN} icon={<FileQuestion {...ICON} />} />
          <RequestCard kind="submit" options={options} defaultToken={DEFAULT_TOKEN} icon={<Send {...ICON} />} />
        </div>

        <aside className="min-w-0 space-y-5">
          <ClockCard />
          <Card padding="md" className="bg-panel-2">
            <div className="flex gap-3">
              <Info {...ICON} className="mt-0.5 size-5 shrink-0 text-muted" />
              <div>
                <p className="text-sm font-semibold text-ink">{t('playground.legacy.title')}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-muted">{t('playground.legacy.body')}</p>
                <pre className="mt-2 overflow-x-auto rounded-lg bg-sunken px-2.5 py-1.5 font-mono text-[11.5px] text-ink">
                  {'{ "rate": 5, "question_id": 1101 }\n→ { "id": 1101, "question_rate": 5 }'}
                </pre>
              </div>
            </div>
          </Card>
          <RoutesCard />
        </aside>
      </div>
    </div>
  )
}
