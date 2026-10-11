/**
 * License mapper: put synced users on seats under the cap (move, unmap, swap, assign).
 * Owner: licensing. Consumed by partners (PartnerDetailPage ?tab=mapper) and AccountantPartnerPage.
 */
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { ArrowLeftRight, GripVertical, MoreHorizontal, UserMinus, UserPlus } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  Badge,
  Banner,
  Button,
  Card,
  Dialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  IconButton,
  Mono,
  NativeSelect,
  ProgressBar,
  SearchInput,
  Skeleton,
} from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatMoney } from '@/lib/format'
import { useStaffMe } from '@/lib/session'
import type { Currency } from '@/types'

import { useAssignUser, useMapper, useSwapUsers, useUnmapUser, type MapperCard, type PartnerUserRow } from '../api'
import { errorText } from '../lib/errors'

export interface LicenseMapperPanelProps {
  partnerId: string
  canEdit: boolean
}

const UNMAPPED = '__unmapped__'

export function LicenseMapperPanel({ partnerId, canEdit }: LicenseMapperPanelProps) {
  const { t } = useTranslation('licensing')
  const me = useStaffMe()
  const editable = canEdit && (me?.role === 'superadmin' || me?.role === 'accountant')
  const mapper = useMapper(partnerId)
  const assign = useAssignUser(partnerId)
  const unmap = useUnmapUser(partnerId)
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [swapFor, setSwapFor] = useState<PartnerUserRow | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor))

  const needle = q.trim().toLowerCase()
  const match = (u: PartnerUserRow) =>
    !needle || [u.username, u.fullName, u.email, u.role].some((v) => v.toLowerCase().includes(needle))

  const cards = mapper.data?.licenses ?? []
  const currency: Currency = mapper.data?.currency ?? 'GEL'
  const activeId = selected ?? cards[0]?.licenseId ?? null

  async function moveTo(user: PartnerUserRow, licenseId: string) {
    if (user.licenseId === licenseId) return
    const card = cards.find((c) => c.licenseId === licenseId)
    try {
      await assign.mutateAsync({ userId: user.id, licenseId })
      setSelected(licenseId)
      toast.success(t('mapper.moved', { user: user.username, license: card?.name ?? '' }))
    } catch (e) {
      toast.error(errorText(t, e))
    }
  }

  async function doUnmap(user: PartnerUserRow) {
    try {
      await unmap.mutateAsync(user.id)
      toast.success(t('mapper.unmapped', { user: user.username }))
    } catch (e) {
      toast.error(errorText(t, e))
    }
  }

  function onDragEnd(event: DragEndEvent) {
    const user = event.active.data.current?.user as PartnerUserRow | undefined
    const target = event.over?.id
    if (!user || !target) return
    if (target === UNMAPPED) {
      if (user.licenseId) void doUnmap(user)
    } else void moveTo(user, String(target))
  }

  if (mapper.isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
    )
  }
  if (mapper.error) {
    return (
      <Banner tone="danger" title={t('errors.loadFailed')} action={<Button size="sm" onClick={() => void mapper.refetch()}>{t('common:actions.retry')}</Button>}>
        {errorText(t, mapper.error)}
      </Banner>
    )
  }
  const data = mapper.data
  if (!data) return null

  const menu = (user: PartnerUserRow) =>
    editable ? (
      <UserMenu
        user={user}
        cards={cards}
        currency={currency}
        onMove={(id) => void moveTo(user, id)}
        onUnmap={() => void doUnmap(user)}
        onSwap={() => setSwapFor(user)}
      />
    ) : null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="w-full sm:w-72">
          <SearchInput value={q} onChange={setQ} placeholder={t('mapper.search')} />
        </div>
        <p className="text-sm text-muted">{editable ? t('mapper.hintEdit') : t('mapper.hintReadOnly')}</p>
      </div>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        {cards.length === 0 ? (
          <Card>
            <EmptyState compact title={t('mapper.noLicenses')} description={t('mapper.noLicensesHint')} />
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {cards.map((card) => {
              const users = card.users.filter(match)
              return (
                <DropCard key={card.licenseId} id={card.licenseId} disabled={!editable}>
                  <Card active={card.licenseId === activeId} className="h-full" onClick={() => setSelected(card.licenseId)}>
                    <div className="flex items-start justify-between gap-3 border-b border-hairline px-4 py-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className="font-display text-base font-semibold text-ink">{card.name}</h3>
                          {!card.isActive ? <Badge tone="neutral">{t('tags.inactive')}</Badge> : null}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                          <Mono>{card.code}</Mono>
                          <span className="num">{t('mapper.pricePerSeat', { price: formatMoney(card.unitPrice, currency) })}</span>
                        </div>
                      </div>
                      <div className="w-28 shrink-0 text-right">
                        <span className={cn('num text-sm font-medium', card.used >= card.seats ? 'text-warning' : 'text-ink')}>
                          {t('mapper.usedOfSeats', { used: card.used, seats: card.seats })}
                        </span>
                        <ProgressBar className="mt-1" value={card.used} max={Math.max(1, card.seats)} tone={card.used >= card.seats ? 'warning' : 'primary'} />
                      </div>
                    </div>
                    <UserList users={users} empty={needle ? t('mapper.noMatches') : t('mapper.emptyCard')} draggable={editable} menu={menu} t={t} />
                  </Card>
                </DropCard>
              )
            })}
          </div>
        )}

        <DropCard id={UNMAPPED} disabled={!editable}>
          <Card>
            <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3">
              <div>
                <h3 className="font-display text-base font-semibold text-ink">{t('mapper.unmappedTitle')}</h3>
                <p className="text-xs text-muted">{t('mapper.unmappedHint')}</p>
              </div>
              <Badge tone={data.unmapped.length > 0 ? 'warning' : 'success'}>{data.unmapped.length}</Badge>
            </div>
            <UserList
              users={data.unmapped.filter(match)}
              empty={needle ? t('mapper.noMatches') : t('mapper.allMapped')}
              draggable={editable}
              menu={menu}
              t={t}
            />
          </Card>
        </DropCard>
      </DndContext>

      {data.addons.length > 0 ? (
        <Card>
          <div className="border-b border-hairline px-4 py-3">
            <h3 className="font-display text-base font-semibold text-ink">{t('mapper.addonsTitle')}</h3>
            <p className="text-xs text-muted">{t('mapper.addonsHint')}</p>
          </div>
          <ul className="divide-y divide-hairline">
            {data.addons.map((a) => (
              <li key={a.licenseId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <span className="flex items-center gap-2">
                  <span className="text-ink">{a.name}</span>
                  <Mono>{a.code}</Mono>
                </span>
                <span className="num text-muted">
                  {t('mapper.addonSeats', { count: a.seats })} · {formatMoney(a.unitPrice, currency)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <SwapDialog partnerId={partnerId} user={swapFor} cards={cards} onClose={() => setSwapFor(null)} />
    </div>
  )
}

/* ---------------------------------------------------------------- parts */

function DropCard({ id, disabled, children }: { id: string; disabled: boolean; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled })
  return (
    <div ref={setNodeRef} className={cn('rounded-lg transition-shadow ease-rigi', isOver && 'ring-2 ring-signal ring-offset-2 ring-offset-surface')}>
      {children}
    </div>
  )
}

type T = ReturnType<typeof useTranslation<'licensing'>>['t']

function UserList({
  users,
  empty,
  draggable,
  menu,
  t,
}: {
  users: PartnerUserRow[]
  empty: string
  draggable: boolean
  menu: (u: PartnerUserRow) => ReactNode
  t: T
}) {
  if (users.length === 0) return <p className="px-4 py-6 text-center text-sm text-muted">{empty}</p>
  return (
    <ul className="max-h-[22rem] divide-y divide-hairline overflow-y-auto">
      {users.map((u) => (
        <UserRow key={u.id} user={u} draggable={draggable} menu={menu(u)} t={t} />
      ))}
    </ul>
  )
}

function UserRow({ user, draggable, menu, t }: { user: PartnerUserRow; draggable: boolean; menu: ReactNode; t: T }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: user.id, data: { user }, disabled: !draggable })
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn('flex items-center gap-2 bg-panel px-3 py-2 text-sm', isDragging && 'relative z-20 rounded-md shadow-lg ring-1 ring-hairline-strong')}
    >
      {draggable ? (
        <button
          type="button"
          className="cursor-grab touch-none text-subtle hover:text-ink active:cursor-grabbing"
          aria-label={t('mapper.dragAria', { user: user.username })}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4 stroke-[1.75]" />
        </button>
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="font-mono text-xs text-ink">{user.username}</span>
          <span className="truncate text-ink">{user.fullName}</span>
          {!user.billingEnabled ? <Badge tone="neutral" dot={false}>{t('users.notBilled')}</Badge> : null}
        </div>
        <div className="flex flex-wrap gap-x-2 text-xs text-muted">
          <span>{user.role}</span>
          <span className="truncate">{user.email}</span>
        </div>
      </div>
      {menu}
    </li>
  )
}

function UserMenu({
  user,
  cards,
  currency,
  onMove,
  onUnmap,
  onSwap,
}: {
  user: PartnerUserRow
  cards: MapperCard[]
  currency: Currency
  onMove: (licenseId: string) => void
  onUnmap: () => void
  onSwap: () => void
}) {
  const { t } = useTranslation('licensing')
  const targets = cards.filter((c) => c.licenseId !== user.licenseId)
  const canSwap = user.licenseId !== null && cards.some((c) => c.licenseId !== user.licenseId && c.users.length > 0)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton size="sm" label={t('mapper.actionsFor', { user: user.username })} icon={<MoreHorizontal />} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{user.licenseId ? t('mapper.moveTo') : t('mapper.assignTo')}</DropdownMenuLabel>
        {targets.length === 0 ? <DropdownMenuItem disabled>{t('mapper.noTargets')}</DropdownMenuItem> : null}
        {targets.map((c) => {
          const free = c.seats - c.used
          return (
            <DropdownMenuItem
              key={c.licenseId}
              icon={<UserPlus />}
              hint={free > 0 ? t('mapper.free', { count: free }) : t('mapper.full')}
              onSelect={() => onMove(c.licenseId)}
            >
              {c.name}
              <span className="sr-only"> {formatMoney(c.unitPrice, currency)}</span>
            </DropdownMenuItem>
          )
        })}
        {user.licenseId ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem icon={<ArrowLeftRight />} disabled={!canSwap} onSelect={onSwap}>
              {t('mapper.swap')}
            </DropdownMenuItem>
            <DropdownMenuItem icon={<UserMinus />} tone="danger" onSelect={onUnmap}>
              {t('mapper.unmap')}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SwapDialog({ partnerId, user, cards, onClose }: { partnerId: string; user: PartnerUserRow | null; cards: MapperCard[]; onClose: () => void }) {
  const { t } = useTranslation('licensing')
  const swap = useSwapUsers(partnerId)
  const [other, setOther] = useState('')
  const options = useMemo(
    () =>
      cards
        .filter((c) => c.licenseId !== user?.licenseId)
        .flatMap((c) => c.users.map((u) => ({ value: u.id, label: `${u.username} · ${u.fullName} (${c.name})` }))),
    [cards, user],
  )
  const current = cards.find((c) => c.licenseId === user?.licenseId)

  async function submit() {
    if (!user || !other) return
    try {
      await swap.mutateAsync({ userIdA: user.id, userIdB: other })
      toast.success(t('mapper.swapped'))
      setOther('')
      onClose()
    } catch (e) {
      toast.error(errorText(t, e))
    }
  }

  return (
    <Dialog
      open={user !== null}
      onOpenChange={(o) => {
        if (!o) {
          setOther('')
          onClose()
        }
      }}
      title={t('mapper.swapTitle')}
      description={user ? t('mapper.swapDescription', { user: user.username, license: current?.name ?? '' }) : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common:actions.cancel')}
          </Button>
          <Button variant="primary" icon={<ArrowLeftRight />} disabled={!other} loading={swap.isPending} onClick={() => void submit()}>
            {t('mapper.swap')}
          </Button>
        </>
      }
    >
      <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="swap-with">
        {t('mapper.swapWith')}
      </label>
      <NativeSelect id="swap-with" value={other} onChange={(e) => setOther(e.target.value)} placeholder={t('mapper.swapPick')} options={options} />
      <p className="mt-2 text-xs text-muted">{t('mapper.swapNote')}</p>
    </Dialog>
  )
}
