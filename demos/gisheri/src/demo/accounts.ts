/**
 * The demo accounts, in one place, so the seed and the chrome cannot drift apart.
 *
 * Nobody can guess credentials that live in a JSON seed file, so the banner names
 * them and signs you in with one click, and the login page pre-fills them. Every
 * other user in the seed exists as data — they own orders, they appear in the
 * admin list, they are the customers the autocomplete offers — but none of them
 * is reachable, which is the same arrangement the real shop has.
 *
 * `seed/people.json` must contain exactly these three rows, with exactly these
 * emails, passwords, names and roles; `validateSeed()` asserts it rather than
 * trusting anyone to remember.
 */

import type { Role } from './types';

export const DEMO_PASSWORD = 'gisheri-demo';

export interface DemoAccount {
  email: string;
  password: string;
  role: Role;
  /** Where this account belongs. Signing in from the banner takes you there. */
  home: string;
  /** The seed row's `first_name` — repeated here so the assertion has something to compare. */
  firstName: string;
  /** The seed row's `last_name`. */
  lastName: string;
  /** The i18n key the banner and the login hint label this persona with. */
  labelKey: string;
}

/** Ana Gogoladze — has a purchase history, a saved address and a discounted order. */
export const DEMO_CUSTOMER: DemoAccount = {
  email: 'demo@gisheri.ge',
  password: DEMO_PASSWORD,
  role: 'customer',
  home: '/account',
  firstName: 'Ana',
  lastName: 'Gogoladze',
  labelKey: 'demo.roleCustomer',
};

/**
 * Levan Beridze — **seeded and functional, but not advertised.**
 *
 * The staff role is the only way to see the two places where the front-end gate
 * and the API gate disagree: the sidebar offers Discounts to a `staff` user whose
 * request is then refused with `Admin role required.`, and `/admin/orders/new`
 * hands that same user a customer autocomplete that silently swallows its own
 * 403. Both are faithfully reproduced and both are worth documenting — but a
 * banner button whose entire payoff is two error states is a poor invitation, so
 * the disagreement is written up in the README instead and the banner offers the
 * customer and the administrator only.
 *
 * Kept exported because the seed needs the row, `validateSeed()` needs the
 * assertion, and the README names the address for anyone who wants to sign in
 * through the login form by hand.
 */
export const DEMO_STAFF: DemoAccount = {
  email: 'staff@gisheri.ge',
  password: DEMO_PASSWORD,
  role: 'staff',
  home: '/admin',
  firstName: 'Levan',
  lastName: 'Beridze',
  labelKey: 'demo.roleStaff',
};

/** Nino Abashidze — full admin, and not the only admin, so the self-guards are demonstrable. */
export const DEMO_ADMIN: DemoAccount = {
  email: 'admin@gisheri.ge',
  password: DEMO_PASSWORD,
  role: 'admin',
  home: '/admin',
  firstName: 'Nino',
  lastName: 'Abashidze',
  labelKey: 'demo.roleAdmin',
};

/** What the banner offers, in the order it offers it. See the note on `DEMO_STAFF`. */
export const ADVERTISED_ACCOUNTS: readonly DemoAccount[] = [DEMO_CUSTOMER, DEMO_ADMIN];

/** Every account the seed must carry, advertised or not. `validateSeed()` walks this one. */
export const DEMO_ACCOUNTS: readonly DemoAccount[] = [DEMO_CUSTOMER, DEMO_STAFF, DEMO_ADMIN];
