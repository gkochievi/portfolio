/**
 * The login page's shortcut: the seeded accounts as large cards, one click to
 * sign in as any of them. A visitor should never have to read a password.
 *
 * Unlike the demo bar this sits *inside* the product, so it is unbranded and
 * nearly unstyled: borders and tints derive from `currentColor`, and every
 * slot's class can be replaced wholesale. A supplied class *replaces* the
 * `bdk-accounts*` default rather than adding to it — the kit's CSS is
 * unlayered and would otherwise beat the demo's Tailwind utilities.
 */
import type { CSSProperties, ReactElement } from 'react'

import { accountInitial, type DemoAccount } from './session'

/** The restylable parts of `<DemoAccounts>`. */
export type DemoAccountsSlot = 'item' | 'card' | 'avatar' | 'body' | 'name' | 'role' | 'email' | 'description'

/** Props for `<DemoAccounts>`. */
export interface DemoAccountsProps<A extends DemoAccount> {
  accounts: readonly A[]
  /** Called with the clicked account — sign in with it, or prefill the form. */
  onPick: (account: A) => void
  /** Marks this account's card with `aria-current` / `data-current`. */
  currentId?: string | null | undefined
  /** Accessible name for the list. Default `'Demo accounts'`. */
  label?: string | undefined
  /** Disable every card, e.g. while a sign-in request is in flight. */
  disabled?: boolean | undefined
  /** Replaces the root `bdk-accounts` class. */
  className?: string | undefined
  /** Per-slot replacements for the `bdk-accounts__*` classes. */
  classNames?: Partial<Record<DemoAccountsSlot, string>> | undefined
}

const DEFAULT_CLASSES: Record<DemoAccountsSlot, string> = {
  item: 'bdk-accounts__item',
  card: 'bdk-accounts__card',
  avatar: 'bdk-accounts__avatar',
  body: 'bdk-accounts__body',
  name: 'bdk-accounts__name',
  role: 'bdk-accounts__role',
  email: 'bdk-accounts__email',
  description: 'bdk-accounts__description',
}

/**
 * Seeded accounts as clickable cards: avatar initial, name, role label,
 * email and description. `data-role` on each card carries the machine role
 * for role-specific styling.
 */
export function DemoAccounts<A extends DemoAccount>({
  accounts,
  onPick,
  currentId = null,
  label = 'Demo accounts',
  disabled = false,
  className,
  classNames,
}: DemoAccountsProps<A>): ReactElement {
  const cls = (slot: DemoAccountsSlot) => classNames?.[slot] ?? DEFAULT_CLASSES[slot]

  return (
    <ul className={className ?? 'bdk-accounts'} aria-label={label} role="list">
      {accounts.map((account) => {
        const isCurrent = account.id === currentId
        const tint = account.avatarColor ? ({ '--bdk-avatar': account.avatarColor } as CSSProperties) : undefined
        return (
          <li key={account.id} className={cls('item')}>
            <button
              type="button"
              className={cls('card')}
              onClick={() => onPick(account)}
              disabled={disabled}
              aria-current={isCurrent ? 'true' : undefined}
              data-current={isCurrent ? 'true' : undefined}
              data-role={account.role}
            >
              <span className={cls('avatar')} style={tint} data-tinted={tint ? 'true' : undefined} aria-hidden="true">
                {accountInitial(account.name)}
              </span>
              <span className={cls('body')}>
                <span className={cls('name')}>{account.name}</span>
                {account.roleLabel && <span className={cls('role')}>{account.roleLabel}</span>}
                <span className={cls('email')}>{account.email}</span>
                {account.description && <span className={cls('description')}>{account.description}</span>}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
