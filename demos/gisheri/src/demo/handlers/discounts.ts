/**
 * `/discounts/validate` — a port of `discounts/api.py`, and the shortest module
 * in the mock. One route, `jwt_auth`, in `../routes.md` §4.
 *
 * It quotes a cart: given a code and a subtotal, what comes off and what is left.
 * The arithmetic is `../pricing.ts`'s, not this file's, and that is the point —
 * `POST /orders` charges the cart through `computeDiscount()` too, so the number
 * the shopper is shown here and the number they are billed at checkout come out
 * of one function. A second implementation would agree with the first until the
 * day a percentage landed on half a tetri, and then the demo would contradict
 * itself in front of the visitor.
 *
 * ## Four upstream behaviours reproduced literally
 *
 * - **This route is authenticated.** `discounts/api.py` mounts its router with
 *   `auth=jwt_auth`, so an anonymous cart applying a code gets 401 `Unauthorized`
 *   rather than a discount. `CartPage` already renders `cartPage.signInRequired`
 *   above the button, and the demo banner signs you in in one click, so the gate
 *   stays.
 * - **Nothing is reserved and nothing is incremented.** `uses_count` moves only
 *   when an order is actually created. A code sitting at `max_uses - 1` therefore
 *   validates happily for every shopper looking at it and lets exactly one of
 *   them check out; the rest meet `discount_invalid` at the till. That is the
 *   real product's behaviour and the reason the create path re-validates.
 * - **All three redeemability failures collapse into one sentence.** Inactive,
 *   expired and exhausted are indistinguishable to the client, and so is a code
 *   that never existed — `lookup_redeemable()` returns `None` for all four.
 *   Telling a visitor that a code exists but is spent would be an information
 *   leak the shop does not make.
 * - **The subtotal is the client's.** Upstream never re-prices the basket here:
 *   it compares `payload.subtotal` against `min_order_total` and computes the
 *   amount off that same number. `CartPage` posts `subtotal.toFixed(2)`. A
 *   tampered subtotal buys a wrong *quote*, never a wrong charge, because the
 *   order is priced from the catalogue when it is written.
 *
 * The failure body is `{"detail": …}` at 400 — returned as a plain dict upstream
 * rather than raised as an `HttpError`, which changes nothing on the wire and is
 * why `fail()` is the right tool for it here. `CartPage` prints that `detail`
 * verbatim under the input: there is no i18n key for either message.
 */

import { CLOCK, bodyOf, fail, fromMinor, readDecimal, readString, toMinor } from '../base';
import { computeDiscount, discountProblem } from '../pricing';
import { register } from '../router';
import { discountByCode } from '../store';
import type { DiscountKind, DiscountRow, Money } from '../types';

/** `discounts/schemas.py::DiscountValidateOut`, keys in declaration order. */
interface DiscountValidateOut {
  /** Literally `true` on every 200 — a failure is a 400, never `{valid: false}`. */
  valid: true;
  /** The row's **stored** casing, not what the shopper typed: `welcome10` quotes as `WELCOME10`. */
  code: string;
  kind: DiscountKind;
  value: Money;
  discountAmount: Money;
  finalTotal: Money;
}

/**
 * `lookup_redeemable()` plus the minimum-order check, in upstream's order and
 * with upstream's two messages.
 *
 * `discountProblem()` already answers `not_redeemable` for a null row, so by the
 * time it returns `null` the discount cannot be null — but TypeScript has no way
 * to know that across a function boundary, hence the second test. It is a
 * narrowing device, not a branch: there is no request that reaches it.
 */
function redeemableOrFail(typed: string, subtotalMinor: number, now: number): DiscountRow {
  const discount = discountByCode(typed) ?? null;
  const problem = discountProblem(discount, subtotalMinor, now);
  if (problem === null && discount !== null) return discount;
  if (problem?.problem === 'below_minimum') {
    // The number is a raw `Decimal` in an f-string: two decimals, no currency
    // symbol — `This code requires a minimum order of 100.00.`
    throw fail('discount_min_order', problem.minOrderTotal ?? '0.00');
  }
  throw fail('discount_invalid');
}

// --------------------------------------------------------------------------- //
//  POST /discounts/validate
// --------------------------------------------------------------------------- //

/**
 * `code` carries no length bound upstream (`code: str`, unconstrained) and
 * `subtotal` is a plain `Decimal`, so a string and a JSON number are both
 * accepted — the cart sends the former, and `readDecimal` takes either.
 *
 * The trim lives in `discountByCode()`, matching `filter(code__iexact=code.strip())`:
 * the checkout input does not trim what it is given, and a pasted code arrives
 * with a space more often than not.
 */
register('POST', '/discounts/validate', (request): DiscountValidateOut => {
  const body = bodyOf(request);
  const code = readString(body, 'code', { required: true });
  const subtotal = readDecimal(body, 'subtotal', { required: true });

  const subtotalMinor = toMinor(subtotal);
  const discount = redeemableOrFail(code, subtotalMinor, CLOCK.now());
  const discountMinor = computeDiscount(discount, subtotalMinor);

  return {
    valid: true,
    code: discount.code,
    kind: discount.kind,
    value: discount.value,
    discountAmount: fromMinor(discountMinor),
    // `compute_discount` has already clamped the amount to the subtotal, so this
    // can never be negative here. The **order** recompute has no such clamp, which
    // is why an admin stripping items off a discounted order can drive its total
    // below zero — see `recomputeTotals` in `../pricing.ts`.
    finalTotal: fromMinor(subtotalMinor - discountMinor),
  };
});
