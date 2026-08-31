/**
 * `/admin/discounts/*` — a port of `discounts/admin_api.py`. Six routes, all
 * `admin_auth` (`['admin']`), all in `../routes.md` §8.
 *
 * ## The role split, and why it is not tidied up here
 *
 * This router and `/admin/users/*` are the only two mounted with `admin_auth`;
 * every other `/admin/*` router in the project is `staff_auth`. The **front end**
 * disagrees: `App.tsx` gates `/admin/discounts` at `staff`, so a signed-in staff
 * persona sees Discounts in the sidebar, clicks it, and gets a destructive toast
 * reading `Failed to load discounts` / `Admin role required.`
 *
 * That is reproduced exactly, sentence included, and it is why `../router.ts`
 * treats `['admin']` and `['staff', 'admin']` as different things rather than as
 * two spellings of "privileged". Registering these six at `staff` would make the
 * demo work better than the product and delete the more interesting thing it has
 * to show.
 *
 * ## Behaviours worth knowing before editing
 *
 * - **`usesCount` is read-only.** `DiscountIn` has no such field, so neither
 *   create nor the full-replace update can touch the counter — it moves in
 *   exactly one place in the whole mock, when an order is created.
 * - **`PATCH` is a full replace, not a partial.** `update_discount` iterates the
 *   validated payload and `setattr`s every field, so an omitted `maxUses` becomes
 *   `null` and an omitted `expiresAt` clears the expiry. `DiscountEditPage`
 *   always posts all seven fields, which is what makes that safe upstream.
 * - **The `kind` filter is silently ignored** unless it is exactly `percent` or
 *   `fixed` — `if kind in ("percent", "fixed")`, with no `else`. `?kind=Percent`
 *   lists everything and reports no error.
 * - **Bulk activate/deactivate does not bump `updated_at`.** It is a
 *   `QuerySet.update()`, which bypasses `auto_now`, the same way the bulk order
 *   status route does. The single-row `PATCH` goes through `obj.save()` and does
 *   bump it.
 * - **No audit rows anywhere in this file.** `record_action` is imported by two
 *   modules upstream — orders and users — and this is not one of them. Adding a
 *   discount feed would put rows on a screen that has no `ActivityFeed` mounted.
 *
 * Deleting a code that an order already used is harmless: `Order.discount_code`
 * is a snapshot string and not a foreign key, so the historical order keeps
 * reading correctly with no `PROTECT` to trip over.
 */

import {
  bodyOf,
  fail,
  notFound,
  nowIso,
  readBoolean,
  readDecimal,
  readEnum,
  readNullableDateTime,
  readNullableInt,
  readString,
  validationError,
} from '../base';
import { applyDateRange, asBoolean, icontains, paginate } from '../query';
import type { PageEnvelope } from '../query';
import { register } from '../router';
import type { DemoRequest, RouteOptions } from '../router';
import { serializeDiscount } from '../serialize';
import type { DiscountOut } from '../serialize';
import { discountById, nextId, orderedDiscounts, store } from '../store';
import { DISCOUNT_KINDS } from '../types';
import type { DiscountRow } from '../types';

/** Every route in this module is `admin_auth`. See the module note. */
const ADMIN: RouteOptions = { auth: ['admin'] };

// --------------------------------------------------------------------------- //
//  `DiscountIn`
// --------------------------------------------------------------------------- //

/** The payload, minus the columns the API refuses to let anyone set. */
type DiscountInput = Omit<DiscountRow, 'id' | 'uses_count' | 'created_at' | 'updated_at'>;

/**
 * `discounts/schemas.py::DiscountIn`, read in declaration order so the first 422
 * matches the real server's.
 *
 * `value` is `Field(ge=Decimal("0"))` and required; the upper bound is **not**
 * validated, so a percent code worth `500` is accepted and takes five times the
 * cart off — clamped back to the subtotal by `compute_discount` at redemption, so
 * the order lands at zero rather than negative. `maxUses` is likewise unbounded
 * (`int | None`), and a negative one simply makes the code permanently
 * unredeemable, since the test is `uses_count >= max_uses`.
 *
 * `minOrderTotal` defaults to `Decimal("0")`, stored in a `DecimalField(10, 2)`
 * and therefore read back as `"0.00"` — the fallback is spelled the way the
 * column would spell it, not the way the schema does.
 */
function readDiscountIn(request: DemoRequest): DiscountInput {
  const body = bodyOf(request);
  return {
    code: readString(body, 'code', { required: true, min: 1, max: 64 }),
    kind: readEnum(body, 'kind', DISCOUNT_KINDS, { fallback: 'percent' }),
    value: readDecimal(body, 'value', { required: true, min: 0 }),
    min_order_total: readDecimal(body, 'minOrderTotal', { fallback: '0.00' }),
    max_uses: readNullableInt(body, 'maxUses'),
    expires_at: readNullableDateTime(body, 'expiresAt'),
    is_active: readBoolean(body, 'isActive', { fallback: true }),
  };
}

/**
 * `DiscountCode.objects.filter(code__iexact=payload.code)`, optionally
 * `.exclude(pk=…)`.
 *
 * Deliberately **not** `store.ts::discountByCode()`, which trims before it
 * compares because the checkout field does not trim what a shopper pastes. The
 * admin uniqueness check has no such `.strip()` upstream, so a code authored as
 * `" SPRING24"` really would be allowed alongside `SPRING24` here — an oddity
 * nobody can reach through the console, which posts `values.code.trim()`, but one
 * worth being exact about since this is the function that decides whether a save
 * is refused.
 */
function codeTaken(code: string, exceptId?: number): boolean {
  const wanted = code.toLowerCase();
  return store.discounts.some((row) => row.code.toLowerCase() === wanted && row.id !== exceptId);
}

/** `get_object_or_404(DiscountCode, pk=discount_id)`. */
function discountOr404(request: DemoRequest): DiscountRow {
  const discount = discountById(Number(request.path.id));
  if (!discount) throw notFound();
  return discount;
}

// --------------------------------------------------------------------------- //
//  GET /admin/discounts
// --------------------------------------------------------------------------- //

/**
 * `-created_at`, filtered five ways. `q` is `code__icontains`; `is_active` is a
 * real tri-state, which is why `asBoolean` accepts only the two literal strings —
 * `buildQuery` serialises a genuine `false` as the truthy string `"false"`, and a
 * reader that tested truthiness would list everybody on the Inactive tab.
 */
register(
  'GET',
  '/admin/discounts',
  (request): PageEnvelope<DiscountOut> => {
    const { params } = request;
    let rows = orderedDiscounts();

    const q = params.q ?? '';
    if (q) rows = rows.filter((discount) => icontains(discount.code, q));

    const isActive = asBoolean(params.is_active);
    if (isActive !== null) rows = rows.filter((discount) => discount.is_active === isActive);

    // `if kind in ("percent", "fixed")` — anything else is not an error, it is
    // simply no filter at all.
    const kind = params.kind ?? '';
    if (kind === 'percent' || kind === 'fixed') {
      rows = rows.filter((discount) => discount.kind === kind);
    }

    rows = applyDateRange(rows, params, (discount) => discount.created_at);

    return paginate(rows, params, serializeDiscount);
  },
  ADMIN,
);

// --------------------------------------------------------------------------- //
//  POST /admin/discounts
// --------------------------------------------------------------------------- //

/**
 * 201. `uses_count` starts at 0 because the payload cannot carry it, and both
 * timestamps are `auto_now_add` / `auto_now` on the same instant.
 *
 * The collision is checked before anything is written and reaches
 * `DiscountEditPage` as the raw `detail` under a hardcoded English
 * `Failed to save` title — there is no i18n key for it.
 */
register(
  'POST',
  '/admin/discounts',
  (request): DiscountOut => {
    const input = readDiscountIn(request);
    if (codeTaken(input.code)) throw fail('discount_code_taken');

    const stamp = nowIso();
    const discount: DiscountRow = {
      id: nextId('discounts'),
      ...input,
      uses_count: 0,
      created_at: stamp,
      updated_at: stamp,
    };
    store.discounts.push(discount);
    return serializeDiscount(discount);
  },
  ADMIN,
);

// --------------------------------------------------------------------------- //
//  POST /admin/discounts/bulk
// --------------------------------------------------------------------------- //

/**
 * `list[int] = Field(min_length=1, max_length=200)`, the same declaration both
 * bulk routes in this API carry.
 *
 * `base.ts` has `readStringArray` but no integer equivalent, so each module
 * owning a bulk route carries its own copy — see the twin in `admin-orders.ts`.
 * It is a candidate for promotion into `base.ts` the moment a third caller wants
 * it.
 */
function readIdList(body: Record<string, unknown>, key: string): number[] {
  const raw = body[key];
  if (!Array.isArray(raw)) {
    throw validationError(['body', key], 'Input should be a valid list', 'list_type');
  }
  if (raw.length < 1) {
    throw validationError(
      ['body', key],
      'List should have at least 1 item after validation, not 0',
      'too_short',
    );
  }
  if (raw.length > 200) {
    throw validationError(
      ['body', key],
      `List should have at most 200 items after validation, not ${raw.length}`,
      'too_long',
    );
  }
  return raw.map((entry, index) => {
    if (typeof entry === 'number' && Number.isInteger(entry)) return entry;
    if (typeof entry === 'string' && /^[+-]?\d+$/.test(entry.trim())) return Number(entry.trim());
    throw validationError(
      ['body', key, String(index)],
      'Input should be a valid integer',
      'int_type',
    );
  });
}

/**
 * `{ids, action}` → `{affected}`. `activate` and `deactivate` are one
 * `QuerySet.update()` each and `delete` is `qs.delete()`, whose first return
 * value is the total number of objects removed — equal to the row count for a
 * model with no cascades hanging off it.
 *
 * All three count **matched rows**, so a repeated id counts once; the `Map` is
 * what reproduces `id__in`'s implicit de-duplication. Neither activate nor
 * deactivate moves `updated_at`, for the same reason the bulk order status route
 * does not: `.update()` never fires `auto_now`.
 */
register(
  'POST',
  '/admin/discounts/bulk',
  (request): { affected: number } => {
    const body = bodyOf(request);
    const ids = readIdList(body, 'ids');
    const action = readEnum(body, 'action', ['activate', 'deactivate', 'delete'] as const, {
      required: true,
    });

    const matched = new Map<number, DiscountRow>();
    for (const id of ids) {
      const discount = discountById(id);
      if (discount) matched.set(id, discount);
    }

    if (action === 'delete') {
      for (const discount of matched.values()) {
        const at = store.discounts.indexOf(discount);
        if (at >= 0) store.discounts.splice(at, 1);
      }
    } else {
      const isActive = action === 'activate';
      for (const discount of matched.values()) discount.is_active = isActive;
    }

    return { affected: matched.size };
  },
  ADMIN,
);

// --------------------------------------------------------------------------- //
//  GET /admin/discounts/{id}  ·  PATCH  ·  DELETE
// --------------------------------------------------------------------------- //

register(
  'GET',
  '/admin/discounts/:id',
  (request): DiscountOut => serializeDiscount(discountOr404(request)),
  ADMIN,
);

/**
 * A **full replace** wearing a `PATCH` verb, and the mismatch is upstream's:
 * `update_discount` takes a complete `DiscountIn` and `setattr`s every field it
 * holds, so an omitted key takes the schema's default rather than keeping the
 * stored value. The console always sends all seven.
 *
 * `usesCount` survives only because `DiscountIn` never declares it. That is worth
 * stating out loud: the counter is preserved by an absence, not by a guard, and
 * adding the field to the reader above would silently make it writable.
 *
 * The collision check is skipped when the code has not changed case-insensitively
 * — otherwise every save of an unmodified code would collide with itself — and
 * excludes its own row when it does run.
 */
register(
  'PATCH',
  '/admin/discounts/:id',
  (request): DiscountOut => {
    const input = readDiscountIn(request);
    const discount = discountOr404(request);

    if (input.code.toLowerCase() !== discount.code.toLowerCase() && codeTaken(input.code, discount.id)) {
      throw fail('discount_code_taken');
    }

    Object.assign(discount, input);
    // `obj.save()` with no `update_fields`, so `auto_now` fires.
    discount.updated_at = nowIso();
    return serializeDiscount(discount);
  },
  ADMIN,
);

/**
 * 204 with an empty body — `response={204: None}` — which `dispatch` produces
 * from a handler that returns nothing, and which `adminDiscounts.remove` reads
 * back as `api.delete<void>()`.
 *
 * The one `DELETE` in this API that is **not** a 204 is the order-item route in
 * `admin-orders.ts`, which answers 200 with the whole order.
 */
register(
  'DELETE',
  '/admin/discounts/:id',
  (request): void => {
    const discount = discountOr404(request);
    store.discounts.splice(store.discounts.indexOf(discount), 1);
  },
  ADMIN,
);
