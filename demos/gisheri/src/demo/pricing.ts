/**
 * The one module where money is decided.
 *
 * `POST /discounts/validate` quotes a cart and `POST /orders` charges it, and the
 * two must agree to the tetri or the shop lies to its customers. Upstream that is
 * guaranteed by both routes calling the same `DiscountCode.compute_discount`, and
 * by `POST /api/orders` and `POST /api/admin/orders` calling the same
 * `create_order_for_user`. Both single implementations are reproduced here rather
 * than copied into the three handler modules that need them, because a second
 * copy is a second thing to keep in step and the drift never shows up until a
 * customer is charged the wrong amount.
 *
 * Three upstream behaviours this module preserves and must **not** repair:
 *
 * - All three redeemability failures — inactive, expired, exhausted — collapse
 *   into the single message `Invalid or expired discount code.` Only the
 *   minimum-order failure gets its own wording, and it is checked *after*
 *   redeemability, so a code that is both expired and under the minimum reports
 *   the former.
 * - `computeDiscount` clamps to the subtotal at creation time, but
 *   `recomputeTotals` does **not** re-clamp and does **not** re-evaluate the
 *   percentage. Removing items from a discounted order can therefore drive its
 *   total negative. The admin UI even advertises this — `admin.orders.removeItemDescription`
 *   reads "the discount on this order is preserved" — so it is a documented
 *   product decision, not a bug.
 * - `uses_count` moves **only** on order creation. Never on validate, never back
 *   on cancellation. A code sitting at `max_uses - 1` validates happily for a
 *   hundred shoppers and lets exactly one of them check out.
 *
 * Arithmetic is in **integer tetri** throughout, and rounds exactly once, at the
 * end. Floating-point lari would put a stray tenth of a tetri into a subtotal and
 * surface it three screens later as a total that will not reconcile.
 */

import { CLOCK, fail, fromMinor, nowIso, parseIso, roundHalfEven, toMinor } from './base';
import { discountByCode, nextId, productById, store, touchOrder } from './store';
import type { DiscountRow, Money, OrderItemRow, OrderRow, UserRow } from './types';

// --------------------------------------------------------------------------- //
//  Redeemability — `DiscountCode.is_expired` / `.is_redeemable`
// --------------------------------------------------------------------------- //

export type DiscountProblem = 'not_redeemable' | 'below_minimum';

/** `bool(self.expires_at and self.expires_at < timezone.now())`. A null expiry never expires. */
export function isExpired(discount: DiscountRow, now: number): boolean {
  return discount.expires_at !== null && parseIso(discount.expires_at) < now;
}

/**
 * `is_active` **and** unexpired **and** under `max_uses`, in that order.
 *
 * `min_order_total` is deliberately *not* part of this: the caller checks it
 * separately so that it can produce its own message. Folding it in here would
 * collapse a helpful error into the generic one.
 */
export function isRedeemable(discount: DiscountRow, now: number): boolean {
  if (!discount.is_active) return false;
  if (isExpired(discount, now)) return false;
  if (discount.max_uses !== null && discount.uses_count >= discount.max_uses) return false;
  return true;
}

/**
 * `compute_discount(subtotal)` in tetri.
 *
 * The percentage is computed as `(subtotalMinor × valueMinor) / 10_000` rather
 * than `subtotalMinor × Number(value) / 100`, because both factors are then exact
 * integers and the quotient is the correctly-rounded double of an exact rational.
 * The naive form multiplies by a value that is already a lossy binary fraction and
 * can land a tetri either side of the tie.
 *
 * Then `roundHalfEven` — Python's `quantize` default — and finally the clamp to
 * the subtotal, so a fixed ₾50 off a ₾38 cart takes exactly ₾38 and the total is
 * `0.00`, never negative.
 */
export function computeDiscount(discount: DiscountRow, subtotalMinor: number): number {
  const raw =
    discount.kind === 'percent'
      ? (subtotalMinor * toMinor(discount.value)) / 10_000
      : toMinor(discount.value);
  return Math.min(roundHalfEven(raw), subtotalMinor);
}

/**
 * Why this code cannot be applied to this cart, or `null` when it can.
 *
 * A missing row and an unredeemable one are the same answer on purpose: upstream's
 * `lookup_redeemable()` returns `None` for both and the caller cannot tell them
 * apart. Telling a visitor that a code exists but is exhausted would be a small
 * information leak the real shop does not make.
 */
export function discountProblem(
  discount: DiscountRow | null,
  subtotalMinor: number,
  now: number,
): { problem: DiscountProblem; minOrderTotal?: Money } | null {
  if (discount === null || !isRedeemable(discount, now)) return { problem: 'not_redeemable' };
  if (subtotalMinor < toMinor(discount.min_order_total)) {
    return { problem: 'below_minimum', minOrderTotal: discount.min_order_total };
  }
  return null;
}

/**
 * `discountProblem`, as the two write paths want it: a `DemoApiError` or nothing.
 *
 * Declared as an assertion so the caller keeps a narrowed `DiscountRow`
 * afterwards without a cast — the null case is the one that throws, and saying so
 * in the signature is better than saying it in a comment beside an `as`.
 */
function assertApplicable(
  discount: DiscountRow | null,
  subtotalMinor: number,
  now: number,
): asserts discount is DiscountRow {
  const problem = discountProblem(discount, subtotalMinor, now);
  if (problem === null) return;
  if (problem.problem === 'below_minimum') {
    throw fail('discount_min_order', problem.minOrderTotal ?? '0.00');
  }
  throw fail('discount_invalid');
}

// --------------------------------------------------------------------------- //
//  Lines and totals
// --------------------------------------------------------------------------- //

/** What the wire sends per line: a product, a size and a count. Nothing about price. */
export interface OrderItemInput {
  product_id: number;
  size: string;
  quantity: number;
}

/** A priced line, ready to become a row once the order it belongs to has an id. */
export type OrderItemDraft = Omit<OrderItemRow, 'id' | 'order_id'>;

/**
 * Price a list of requested lines against the live catalogue.
 *
 * `product_name`, `product_image` and `unit_price` are snapshotted here, which is
 * the whole reason `OrderItem` carries them: an order must still read correctly
 * after the product is renamed, re-photographed, repriced or deleted.
 *
 * `missing` preserves the payload's order and repeats a duplicated id, because
 * upstream builds it as `[pid for pid in product_ids if pid not in products]` and
 * the error string is a Python list repr of exactly that. Sorting or
 * de-duplicating would change a message the demo is trying to reproduce.
 */
export function priceLines(items: readonly OrderItemInput[]): {
  lines: OrderItemDraft[];
  subtotalMinor: number;
  missing: number[];
} {
  const lines: OrderItemDraft[] = [];
  const missing: number[] = [];
  let subtotalMinor = 0;

  for (const item of items) {
    const product = productById(item.product_id);
    if (!product) {
      missing.push(item.product_id);
      continue;
    }
    const unitMinor = toMinor(product.price);
    const lineMinor = unitMinor * item.quantity;
    subtotalMinor += lineMinor;
    lines.push({
      product_id: product.id,
      product_name: product.name,
      product_image: product.image,
      size: item.size,
      quantity: item.quantity,
      unit_price: fromMinor(unitMinor),
      line_total: fromMinor(lineMinor),
    });
  }

  return { lines, subtotalMinor, missing };
}

/**
 * The three money columns, as `OrderRow` spells them, so a caller can spread the
 * result straight into a row. `total = subtotal − discount_amount`; there is no
 * shipping and no tax anywhere in this domain, whatever the two placeholder
 * "Shipping — calculated at checkout" rows in the UI suggest.
 */
export function orderTotals(
  subtotalMinor: number,
  discountMinor: number,
): { subtotal: Money; discount_amount: Money; total: Money } {
  return {
    subtotal: fromMinor(subtotalMinor),
    discount_amount: fromMinor(discountMinor),
    total: fromMinor(subtotalMinor - discountMinor),
  };
}

/**
 * `orders/admin_api.py::_recompute_totals`, after an admin adds, edits or removes
 * a line.
 *
 * The discount snapshot is preserved **verbatim**: the code is not re-looked-up,
 * the percentage is not re-applied to the new subtotal, and the amount is not
 * re-clamped. Strip a ₾90 order with ₾30 off down to one ₾20 bracelet and the
 * total is `-10.00`, which is upstream's answer and the one the admin copy warns
 * about. Re-clamping here would be the single most tempting "fix" in the mock and
 * it would quietly diverge from the product.
 */
export function recomputeTotals(order: OrderRow): void {
  const subtotalMinor = store.order_items
    .filter((item) => item.order_id === order.id)
    .reduce((sum, item) => sum + toMinor(item.line_total), 0);

  order.subtotal = fromMinor(subtotalMinor);
  order.total = fromMinor(subtotalMinor - toMinor(order.discount_amount));
  touchOrder(order);
}

// --------------------------------------------------------------------------- //
//  Creating an order
// --------------------------------------------------------------------------- //

/** `OrderCreateIn`, after `base.ts`'s readers have coerced it. Snake_case, as the row is. */
export interface OrderCreateInput {
  items: OrderItemInput[];
  full_name: string;
  email: string;
  phone: string;
  city: string;
  address: string;
  notes: string;
  discount_code: string;
}

/**
 * `orders/api.py::create_order_for_user` — shared verbatim by the customer's
 * `POST /orders` and the staff's `POST /admin/orders`, exactly as upstream shares
 * it. The only difference between the two routes is who is allowed to call them
 * and whether the response is serialised with `is_admin`.
 *
 * The upstream body runs under `transaction.atomic()` with a `SELECT FOR UPDATE`
 * on the discount row, so two concurrent checkouts serialise and the second one
 * sees the exhausted `max_uses`. A single-threaded browser has no concurrency to
 * defend against — but **the re-validation itself still matters**, and is kept: a
 * code the cart validated five minutes ago can have expired, been deactivated or
 * been spent since, and the visitor must meet the same 400 here that the real
 * shop would have given them. Dropping the second check because "the cart already
 * checked" is how a demo ends up honouring a dead code.
 */
export function createOrderForUser(user: UserRow, input: OrderCreateInput): OrderRow {
  const { lines, subtotalMinor, missing } = priceLines(input.items);
  if (missing.length > 0) throw fail('unknown_products', missing);

  const now = CLOCK.now();
  const typed = input.discount_code.trim();
  let discountCode = '';
  let discountMinor = 0;

  if (typed) {
    // `code__iexact`: the shopper types `welcome10`, the order records `WELCOME10`.
    const discount: DiscountRow | null = discountByCode(typed) ?? null;
    assertApplicable(discount, subtotalMinor, now);
    discountMinor = computeDiscount(discount, subtotalMinor);
    // The row's own casing, not what the shopper typed — upstream stores `discount.code`.
    discountCode = discount.code;
    // The only place in the whole mock that moves `uses_count`.
    discount.uses_count += 1;
    discount.updated_at = nowIso();
  }

  const stamp = nowIso();
  const order: OrderRow = {
    id: nextId('orders'),
    user_id: user.id,
    status: 'pending',
    full_name: input.full_name,
    email: input.email,
    phone: input.phone,
    city: input.city,
    address: input.address,
    notes: input.notes,
    // `Order.admin_notes` has no place in a create payload; staff add it later.
    admin_notes: '',
    ...orderTotals(subtotalMinor, discountMinor),
    discount_code: discountCode,
    created_at: stamp,
    updated_at: stamp,
  };
  store.orders.push(order);

  for (const line of lines) {
    store.order_items.push({ id: nextId('order_items'), order_id: order.id, ...line });
  }

  return order;
}
