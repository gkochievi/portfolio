import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Badge, Button, Card, CardBody, CardHeader, DescriptionList, Money, Mono } from '@/components/ui'
import { formatDate, formatMoney } from '@/lib/format'

import type { PartnerDetail } from '../api'

export function OverviewTab({ partner }: { partner: PartnerDetail }) {
  const { t } = useTranslation('partners')
  const none = <span className="text-subtle">{t('overview.notSet')}</span>
  const text = (v: string) => (v ? v : none)
  const term =
    partner.contractStartOn || partner.contractEndOn
      ? `${partner.contractStartOn ? formatDate(partner.contractStartOn) : '...'} - ${partner.contractEndOn ? formatDate(partner.contractEndOn) : '...'}`
      : none
  const sum = partner.licenseSummary
  const billed = sum.rows.filter((r) => r.seats > 0)
  const usersBy = sum.rows.filter((r) => r.license.kind === 'per_user' && (r.taggedUsers > 0 || r.seats > 0))

  return (
    <div className="grid gap-5 lg:grid-cols-2 [&>*]:min-w-0">
      <Card>
        <CardHeader title={t('overview.account')} />
        <CardBody>
          <DescriptionList
            columns={1}
            items={[
              { label: t('overview.companyId'), value: text(partner.companyId), mono: true },
              { label: t('common:fields.currency'), value: partner.currency, mono: true },
              { label: t('overview.rate'), value: <Money amount={partner.ratePerPoint} currency={partner.currency} /> },
              { label: t('overview.allowance'), value: <span className="num">{t('list.allowanceValue', { count: partner.freeMonthlyAllowance })}</span> },
              { label: t('overview.onboarded'), value: formatDate(partner.onboardedAt) },
              { label: t('overview.contract'), value: term },
              { label: t('overview.invoiceDay'), value: t('overview.invoiceDayValue', { day: partner.invoiceGenerationDay }) },
              { label: t('overview.contactEmail'), value: text(partner.contactEmail) },
              {
                label: t('overview.billingEmails'),
                value:
                  partner.billingEmails.length > 0 ? (
                    <span className="flex flex-wrap gap-1.5">
                      {partner.billingEmails.map((e) => (
                        <Mono key={e}>{e}</Mono>
                      ))}
                    </span>
                  ) : (
                    none
                  ),
              },
            ]}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t('overview.technical')} />
        <CardBody>
          <DescriptionList
            columns={1}
            items={[
              { label: t('overview.pbx'), value: text(partner.pbxServerIp), mono: true },
              { label: t('overview.web'), value: text(partner.webServerIp), mono: true },
              { label: t('overview.domain'), value: text(partner.webServerDomain), mono: true },
              { label: t('overview.architecture'), value: <Badge tone="neutral">{t(`common:architecture.${partner.architecture}`)}</Badge> },
              { label: t('overview.vpn'), value: text(partner.vpnType) },
              {
                label: t('overview.phones'),
                value:
                  partner.phoneNumbers.length > 0 ? (
                    <span className="flex flex-wrap gap-1.5">
                      {partner.phoneNumbers.map((p) => (
                        <Mono key={p}>{p}</Mono>
                      ))}
                    </span>
                  ) : (
                    none
                  ),
              },
            ]}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t('overview.contacts')} />
        <CardBody className="space-y-4">
          {partner.contacts.map((c) => {
            const empty = !c.name && !c.phone && !c.email
            return (
              <div key={c.role} className="border-b border-hairline pb-3 last:border-0 last:pb-0">
                <p className="eyebrow">{t(`common:contactRole.${c.role}`)}</p>
                {empty ? (
                  <p className="mt-1 text-[13px] text-subtle">{t('overview.noContact')}</p>
                ) : (
                  <div className="mt-1 text-[13px]">
                    <p className="font-medium">{c.name || none}</p>
                    <p className="num text-muted">{c.phone || '-'}</p>
                    <p className="break-all text-muted">{c.email || '-'}</p>
                  </div>
                )}
              </div>
            )
          })}
        </CardBody>
      </Card>

      <div className="min-w-0 space-y-5">
        <Card>
          <CardHeader
            title={t('overview.license')}
            actions={
              <span className="flex gap-1.5">
                <Button asChild size="sm" variant="secondary">
                  <Link to="?tab=licenses">{t('overview.manageSeats')}</Link>
                </Button>
                <Button asChild size="sm" variant="ghost">
                  <Link to="?tab=mapper">{t('overview.openMapper')}</Link>
                </Button>
              </span>
            }
          />
          <CardBody className="space-y-4">
            <div>
              <p className="eyebrow">{t('overview.seatPool')}</p>
              <p className="mt-1 font-display text-2xl font-semibold">
                <Money amount={sum.totals.monthlyCost} currency={partner.currency} />
              </p>
              <p className="num mt-0.5 text-[13px] text-muted">{t('overview.activeUsers', { active: sum.activeUsers, billed: sum.billedUsers })}</p>
            </div>
            <div>
              <p className="eyebrow mb-1.5">{t('overview.billedSeats')}</p>
              {billed.length === 0 ? (
                <p className="text-[13px] text-subtle">{t('overview.noSeats')}</p>
              ) : (
                <ul className="divide-y divide-hairline text-[13px]">
                  {billed.map((r) => (
                    <li key={r.license.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-1.5">
                      <span className="font-medium">{r.license.name}</span>
                      <Mono>{r.license.code}</Mono>
                      {r.isOverride ? <Badge tone="accent" dot={false}>{t('overview.override')}</Badge> : null}
                      <span className="num ml-auto text-muted">
                        {t('overview.seatLine', { seats: r.seats, price: formatMoney(r.unitPrice, partner.currency) })} ={' '}
                        <Money amount={r.monthlyCost} currency={partner.currency} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="eyebrow mb-1.5">{t('overview.usersByLicense')}</p>
              <ul className="divide-y divide-hairline text-[13px]">
                {usersBy.map((r) => (
                  <li key={r.license.id} className="flex items-baseline justify-between gap-2 py-1.5">
                    <span>{r.license.name}</span>
                    <span className="num text-muted">{t('overview.usersOfSeats', { users: r.taggedUsers, seats: r.seats })}</span>
                  </li>
                ))}
                <li className="flex items-baseline justify-between gap-2 py-1.5">
                  <span>{t('overview.unassigned')}</span>
                  <span className="num font-medium">{sum.unassignedCount}</span>
                </li>
              </ul>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('overview.notes')} />
          <CardBody>
            {partner.notes ? <p className="whitespace-pre-wrap text-[13px]">{partner.notes}</p> : <p className="text-[13px] text-subtle">{t('overview.noNotes')}</p>}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
