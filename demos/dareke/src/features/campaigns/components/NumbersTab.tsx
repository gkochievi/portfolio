/** Numbers tab: lead list with filters, add/remove, duplicates report, upload and clear. */
import { Copy, Eraser, Plus, Trash2, Upload } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Alert,
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  Dialog,
  EmptyState,
  Field,
  IconButton,
  Input,
  Panel,
  SearchInput,
  Select,
  Spinner,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Toolbar,
  type Column,
} from '@/components/ui'
import { fieldErrors } from '@/lib/api'
import { formatDateTime, formatPhone } from '@/lib/format'
import { useLocalized } from '@/lib/localized'
import { toast } from '@/lib/toast'
import type { CampaignNumber, CampaignWithStats } from '@/types'

import { useAddNumber, useCampaignNumbers, useClearNumbers, useDuplicates, useRemoveNumber, type NumberFilters, type NumberGroup } from '../api'
import { ImportNumbersDialog } from './ImportNumbersDialog'
import { NumberStatusPill, useApiErrorText } from './shared'

const GROUPS: NumberGroup[] = ['all', 'pending', 'completed', 'failed', 'dnc', 'callback']
const i18 = { size: 16, strokeWidth: 1.75 } as const

export function NumbersTab({ campaign }: { campaign: CampaignWithStats }) {
  const { t } = useTranslation('campaigns')
  const { t: tc } = useTranslation()
  const l = useLocalized()
  const errText = useApiErrorText()
  const [filters, setFilters] = useState<NumberFilters>({ status: 'all', q: '' })
  const [search, setSearch] = useState('')
  const [dialog, setDialog] = useState<'upload' | 'add' | 'dupes' | 'clear' | null>(null)
  const [removing, setRemoving] = useState<CampaignNumber | null>(null)
  const query = useCampaignNumbers(campaign.id, filters, campaign.status === 'active')
  const removeNumber = useRemoveNumber(campaign.id)
  const clear = useClearNumbers(campaign.id)
  const closed = campaign.status === 'completed' || campaign.status === 'archived'
  const empty = campaign.stats.totalNumbers === 0

  useEffect(() => {
    const id = window.setTimeout(() => setFilters((f) => (f.q === search ? f : { ...f, q: search })), 250)
    return () => window.clearTimeout(id)
  }, [search])

  const columns = useMemo<Column<CampaignNumber>[]>(
    () => [
      {
        key: 'phone',
        header: t('numbers.phone'),
        sortValue: (n) => n.phoneNumber,
        cell: (n) => (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-sm">
            {formatPhone(n.phoneNumber)}
            {n.instanceNumber > 1 && (
              <Badge tone="warning" size="sm" mono>
                #{n.instanceNumber}
              </Badge>
            )}
          </span>
        ),
      },
      { key: 'customer', header: t('numbers.customer'), sortValue: (n) => l(n.customerName), cell: (n) => (n.customerName ? l(n.customerName) : <span className="text-muted">-</span>) },
      { key: 'status', header: t('numbers.status'), sortValue: (n) => n.status, cell: (n) => <NumberStatusPill status={n.status} /> },
      { key: 'attempts', header: t('numbers.attempts'), align: 'right', sortValue: (n) => n.attempts, cell: (n) => <span className="font-mono tabular">{n.attempts}/{campaign.maxAttempts}</span>, hideOnMobile: true },
      { key: 'last', header: t('numbers.lastAttempt'), sortValue: (n) => n.lastAttemptAt ?? '', cell: (n) => <span className="font-mono text-xs text-muted">{n.lastAttemptAt ? formatDateTime(n.lastAttemptAt) : '-'}</span>, hideOnMobile: true },
      { key: 'next', header: t('numbers.nextAttempt'), sortValue: (n) => n.nextAttemptAt ?? '', cell: (n) => <span className="font-mono text-xs text-muted">{n.nextAttemptAt ? formatDateTime(n.nextAttemptAt) : '-'}</span>, hideOnMobile: true },
      {
        key: 'remove',
        header: <span className="sr-only">{tc('actions.remove')}</span>,
        align: 'right',
        width: '48px',
        cell: (n) => (
          <IconButton
            size="sm"
            label={t('numbers.remove')}
            icon={<Trash2 {...i18} />}
            disabled={n.status === 'DIALING' || n.status === 'CONNECTED'}
            onClick={() => setRemoving(n)}
          />
        ),
      },
    ],
    [t, tc, l, campaign.maxAttempts],
  )

  const confirmRemove = () => {
    if (!removing) return
    removeNumber.mutate(removing.id, {
      onSuccess: () => toast.success(t('numbers.removed'), { description: formatPhone(removing.phoneNumber) }),
      onError: (error) => toast.error(t('numbers.removeFailed'), { description: errText(error) }),
      onSettled: () => setRemoving(null),
    })
  }

  const confirmClear = () =>
    clear.mutate(undefined, {
      onSuccess: (r) => toast.success(t('numbers.cleared', { count: r.deleted })),
      onError: (error) => toast.error(t('numbers.clearFailed'), { description: errText(error) }),
      onSettled: () => setDialog(null),
    })

  const rows = query.data ?? []

  return (
    <div className="space-y-4">
      <Toolbar
        end={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" icon={<Copy {...i18} />} onClick={() => setDialog('dupes')}>
              {t('numbers.duplicates')}
            </Button>
            <Button size="sm" variant="outline" icon={<Plus {...i18} />} disabled={closed} onClick={() => setDialog('add')}>
              {t('numbers.add')}
            </Button>
            <Button size="sm" variant="dial" icon={<Upload {...i18} />} disabled={closed} onClick={() => setDialog('upload')}>
              {t('numbers.upload')}
            </Button>
            <Button
              size="sm"
              variant="danger"
              icon={<Eraser {...i18} />}
              disabled={empty || campaign.status === 'active'}
              title={campaign.status === 'active' ? t('numbers.clearActiveHint') : undefined}
              onClick={() => setDialog('clear')}
            >
              {t('numbers.clear')}
            </Button>
          </div>
        }
      >
        <SearchInput value={search} onChange={setSearch} placeholder={t('numbers.search')} />
        <Select
          className="w-full sm:w-44"
          aria-label={t('numbers.status')}
          value={filters.status}
          onValueChange={(v) => setFilters((f) => ({ ...f, status: v as NumberGroup }))}
          options={GROUPS.map((g) => ({ value: g, label: t(`numbers.groups.${g}`) }))}
        />
      </Toolbar>

      {query.isError ? (
        <Alert tone="danger" title={tc('states.error')} action={<Button size="sm" onClick={() => void query.refetch()}>{tc('actions.retry')}</Button>}>
          {errText(query.error)}
        </Alert>
      ) : (
        <Panel
          title={t('numbers.title', { count: rows.length })}
          description={tc('demoDataNote')}
          padded={false}
        >
          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(n) => n.id}
            loading={query.isLoading}
            pageSize={25}
            framed={false}
            initialSort={{ key: 'status', dir: 'asc' } as never}
            empty={
              empty ? (
                <EmptyState
                  title={t('numbers.emptyTitle')}
                  description={t('numbers.emptyHint')}
                  action={
                    !closed && (
                      <Button variant="dial" icon={<Upload {...i18} />} onClick={() => setDialog('upload')}>
                        {t('numbers.upload')}
                      </Button>
                    )
                  }
                />
              ) : (
                <EmptyState title={tc('states.noResults')} description={tc('states.noResultsHint')} compact />
              )
            }
          />
        </Panel>
      )}

      <ImportNumbersDialog open={dialog === 'upload'} onOpenChange={(o) => setDialog(o ? 'upload' : null)} campaignId={campaign.id} campaignName={l(campaign.name)} />
      <AddLeadDialog open={dialog === 'add'} onOpenChange={(o) => setDialog(o ? 'add' : null)} campaignId={campaign.id} />
      <DuplicatesDialog open={dialog === 'dupes'} onOpenChange={(o) => setDialog(o ? 'dupes' : null)} campaignId={campaign.id} />
      <ConfirmDialog
        open={dialog === 'clear'}
        onOpenChange={(o) => setDialog(o ? 'clear' : null)}
        title={t('numbers.clearTitle')}
        description={t('numbers.clearBody', { count: campaign.stats.totalNumbers, name: l(campaign.name) })}
        confirmLabel={t('numbers.clear')}
        tone="danger"
        loading={clear.isPending}
        onConfirm={confirmClear}
      />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={t('numbers.removeTitle')}
        description={removing ? t('numbers.removeBody', { phone: formatPhone(removing.phoneNumber) }) : ''}
        confirmLabel={tc('actions.remove')}
        tone="danger"
        loading={removeNumber.isPending}
        onConfirm={confirmRemove}
      />
    </div>
  )
}

function AddLeadDialog({ open, onOpenChange, campaignId }: { open: boolean; onOpenChange: (o: boolean) => void; campaignId: string }) {
  const { t } = useTranslation('campaigns')
  const { t: tc } = useTranslation()
  const errText = useApiErrorText()
  const add = useAddNumber(campaignId)
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setPhone('')
      setName('')
      setError(null)
    }
  }, [open])

  const submit = () => {
    if (!phone.trim()) return setError(t('form.errors.required'))
    add.mutate(
      { phoneNumber: phone, customerName: name || undefined },
      {
        onSuccess: (lead) => {
          toast.success(t('numbers.added'), { description: formatPhone(lead.phoneNumber) })
          onOpenChange(false)
        },
        onError: (err) => {
          const field = fieldErrors(err).phoneNumber
          if (field) setError(errText(new Error(field)))
          else toast.error(t('numbers.addFailed'), { description: errText(err) })
        },
      },
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title={t('numbers.addTitle')}
      description={t('numbers.addHint')}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {tc('actions.cancel')}
          </Button>
          <Button variant="dial" loading={add.isPending} onClick={submit}>
            {tc('actions.add')}
          </Button>
        </div>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <Field label={t('numbers.phone')} required error={error ?? undefined} htmlFor="lead-phone">
          <Input
            id="lead-phone"
            mono
            autoFocus
            inputMode="tel"
            placeholder="+995 500 01 23 45"
            value={phone}
            invalid={!!error}
            onChange={(e) => {
              setPhone(e.target.value)
              setError(null)
            }}
          />
        </Field>
        <Field label={t('numbers.customer')} htmlFor="lead-name">
          <Input id="lead-name" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
        </Field>
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Dialog>
  )
}

function DuplicatesDialog({ open, onOpenChange, campaignId }: { open: boolean; onOpenChange: (o: boolean) => void; campaignId: string }) {
  const { t } = useTranslation('campaigns')
  const { t: tc } = useTranslation()
  const query = useDuplicates(campaignId, open)
  const rows = query.data ?? []
  return (
    <Dialog open={open} onOpenChange={onOpenChange} size="md" title={t('dupes.title')} description={t('dupes.subtitle')}>
      {query.isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner label={tc('states.loading')} />
        </div>
      ) : query.isError ? (
        <Alert tone="danger">{tc('states.error')}</Alert>
      ) : rows.length === 0 ? (
        <EmptyState title={t('dupes.none')} description={t('dupes.noneHint')} compact />
      ) : (
        <div className="max-h-[50vh] overflow-auto rounded-card border border-hairline">
          <Table>
            <THead>
              <TR>
                <TH>{t('numbers.phone')}</TH>
                <TH align="right">{t('dupes.instances')}</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.phoneNumber}>
                  <TD className="font-mono">{formatPhone(r.phoneNumber)}</TD>
                  <TD align="right" className="font-mono tabular">
                    {r.instances}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </Dialog>
  )
}
