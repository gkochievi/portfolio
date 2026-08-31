/**
 * The four seed documents, narrowed once into `Tables`.
 *
 * What is in here is **columns**, not payloads: foreign keys as numbers, money
 * as 2-dp strings, media as bare relative keys, timestamps as ISO strings.
 * Everything Django computed — `is_staff_role`, `item_count`, the absolute media
 * URL — is `serialize.ts`'s job, which is what keeps these files hand-writable.
 *
 * The split follows the authorship seam, the way nabadi's does, so four people
 * can write it in parallel and the cross-file references only ever point one
 * way:
 *
 * ```
 *   people.json    →  who has an account                       (needs nothing)
 *   catalog.json   →  what the shop sells and how it is set up  (needs nothing)
 *   commerce.json  →  what was bought                           (needs both)
 *   activity.json  →  what staff did about it                   (needs all three)
 * ```
 *
 * **Dates are authored as an arrangement, not as a calendar.** Every timestamp
 * in the four files is a fixed offset from one anchor — the newest
 * `orders.created_at`, `2026-08-30T13:40:00.000Z` — and `store.ts` slides the
 * whole set onto today's date at construction (§F.10). "Three weeks before the
 * anchor, at 11:00" therefore survives the rebase; "the Tuesday after the long
 * weekend" would not.
 *
 * JSON widens every enum column to `string` and every literal to `number`, so
 * each table is narrowed exactly once — here — and no read site has to carry a
 * cast. A plain `as` suffices for all twelve: the row interfaces are subtypes of
 * what `resolveJsonModule` infers, so this is a downcast the compiler accepts
 * and would reject if a column went missing.
 */

import activityRows from './activity.json';
import catalogRows from './catalog.json';
import commerceRows from './commerce.json';
import peopleRows from './people.json';
import type {
  AdminActionRow,
  CollectionRow,
  DiscountRow,
  OrderItemRow,
  OrderRow,
  PageSeoRow,
  PasswordResetTokenRow,
  ProductRow,
  QuizConfigRow,
  Seed,
  SiteSettingsRow,
  UserRow,
  ZodiacInfoRow,
} from '../types';

export const seed: Seed = {
  users: peopleRows.users as UserRow[],
  password_reset_tokens: peopleRows.password_reset_tokens as PasswordResetTokenRow[],

  collections: catalogRows.collections as CollectionRow[],
  products: catalogRows.products as ProductRow[],
  zodiac_info: catalogRows.zodiac_info as ZodiacInfoRow[],
  page_seo: catalogRows.page_seo as PageSeoRow[],

  discounts: commerceRows.discounts as DiscountRow[],
  orders: commerceRows.orders as OrderRow[],
  order_items: commerceRows.order_items as OrderItemRow[],

  admin_actions: activityRows.admin_actions as AdminActionRow[],

  // The two singletons are objects rather than one-row arrays, because both
  // models hard-assign `pk = 1` in `save()`. Each carries `"id": 1` in the JSON
  // so the literal type narrows without a second cast.
  site_settings: catalogRows.site_settings as SiteSettingsRow,
  quiz_config: catalogRows.quiz_config as QuizConfigRow,
};
