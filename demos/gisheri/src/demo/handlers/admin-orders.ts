/**
 * `/admin/orders/*` — a port of `orders/admin_api.py`. Eight routes, all
 * `staff_auth` (`['staff', 'admin']`), all in `../routes.md` §6.
 *
 * ## The one thing to understand before editing this file
 *
 * **The server enforces no status transitions whatsoever.** `PATCH` accepts any
 * status from any status, and the bulk route accepts any status for any
 * selection; `delivered → pending` is a 200. Every bit of that discipline lives
 * in `admin/OrderDetailPage.tsx`, whose stepper enables only the next step and
 * the completed ones, hides "Cancel order" once an order is delivered, and puts
 * a confirmation dialog in front of each click. The bulk toolbar on the list
 * page has no guard at all and never did.
 *
 * That asymmetry is worth showing rather than fixing: it is what a real admin
 * API looks like when the workflow rules were written in the console. Adding a
 * server-side transition table here would make the mock *stricter* than the
 * product it is demonstrating, and the first thing it would break is the
 * cancelled-order revert path, which the UI deliberately allows.
 *
 * ## The rest of the quirks, each reproduced on purpose
 *
 * - **`updated_at` moves on `PATCH` and on every item mutation, and does *not*
 *   move on bulk-status.** `ActivityFeed`'s `reloadKey` is `order.updatedAt`, so
 *   the first is what makes the feed refetch after a change; the second is
 *   upstream's `QuerySet.update()`, which writes the column list it was given and
 *   bypasses `auto_now` entirely. Both halves matter, in opposite directions.
 * - **Bulk-status writes one audit row per *requested* id**, including ids that
 *   matched no order, because the loop is over `payload.ids` and not over the
 *   rows the update touched. `{updated: n}` can therefore be smaller than the
 *   number of rows the feed grew by.
 * - **`PATCH` writes `notes_update` whenever `adminNotes` was present**, even
 *   when the text is unchanged, while `status_change` fires only on a real move.
 *   One request carrying both keys writes two rows.
 * - **Adding the same product and size twice creates a second line.** Nothing
 *   merges; the admin can see and edit both.
 * - **`DELETE` on an item answers 200 with the whole order**, not 204 — the
 *   Ninja route declares `response=OrderOut` and `adminOrdersApi.removeItem`
 *   reads the order straight back into the page's state.
 * - **The last-item 400 is checked before the item is looked up**, so removing a
 *   nonexistent line from a one-line order is `last_item`, not `Not Found`.
 * - **A manual create can leave an orphan customer behind.** The stub account is
 *   written before `create_order_for_user` runs, and only that function's body is
 *   atomic upstream — so an order rejected for an unknown product or a dead
 *   discount leaves the account it just created in place.
 *
 * Validation precedes every lookup in all eight handlers, which is why each one
 * reads its body first. Ninja validates path parameters and the request model
 * before the view function is entered, so a malformed payload aimed at an order
 * that does not exist is a 422 and never a 404.
 */

import {
  bodyOf,
  fail,
  fromMinor,
  has,
  notFound,
  nowIsoOffset,
  readEnum,
  readInt,
  readString,
  toMinor,
  validationError,
} from '../base';
import { createOrderForUser, priceLines, recomputeTotals } from '../pricing';
import { applyDateRange, asInt, icontains, paginate } from '../query';
import type { PageEnvelope } from '../query';
import { register } from '../router';
import type { DemoRequest, RouteOptions } from '../router';
import { serializeAdminOrderRow, serializeOrder } from '../serialize';
import type { AdminOrderListItemOut, OrderOut } from '../serialize';
import {
  bulkStatusSummary,
  itemChangeSummary,
  itemLineSummary,
  nextId,
  orderById,
  orderItemById,
  orderItemsFor,
  orderedOrders,
  store,
  syncRoleFlags,
  touchOrder,
  transitionSummary,
  userByEmail,
  writeAudit,
} from '../store';
import { ORDER_STATUSES } from '../types';
import type { OrderRow, UserRow } from '../types';
import { readOrderCreateIn } from './orders';

// --------------------------------------------------------------------------- //
//  Shared readers and guards
// --------------------------------------------------------------------------- //

/**
 * `list[int] = Field(min_length=1, max_length=200)`, which both bulk routes in
 * this API declare identically.
 *
 * `base.ts` has `readStringArray` (for `stones`, `purposes`, `zodiac_signs` and
 * `featured_collection_slugs`) but no integer equivalent, so each module owning a
 * bulk route carries this. It is a candidate for promotion into `base.ts` the
 * moment anything else needs it.
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

/** `get_object_or_404(Order, pk=order_id)` against the raw string the router captured. */
function orderOr404(request: DemoRequest, key: string): OrderRow {
  const order = orderById(Number(request.path[key]));
  if (!order) throw notFound();
  return order;
}

/**
 * `_ensure_pending` — a **409**, which is the only 409 in the whole API.
 *
 * The console mirrors it with an `isEditable` flag that hides the item controls
 * entirely, so this fires only for a hand-made request or for a second tab that
 * moved the order on while this one was still showing the editor.
 */
function ensurePending(order: OrderRow): void {
  if (order.status !== 'pending') throw fail('items_pending_only');
}

/**
 * `get_object_or_404(OrderItem, pk=item_id, order_id=order.id)` — scoped to the
 * order, so a line belonging to a *different* order is 404 rather than editable
 * from the wrong page.
 */
function orderItemOr404(request: DemoRequest, order: OrderRow) {
  const item = orderItemById(Number(request.path.itemId));
  if (!item || item.order_id !== order.id) throw notFound();
  return item;
}

/**
 * Every route in this module is `staff_auth`: staff **or** admin, never a
 * customer. The list is not interchangeable with `['admin']` — `router.ts` picks
 * the 403 sentence out of it, and the console renders that sentence verbatim.
 */
const STAFF: RouteOptions = { auth: ['staff', 'admin'] };

// --------------------------------------------------------------------------- //
//  GET /admin/orders
// --------------------------------------------------------------------------- //

/**
 * The trimmed `AdminOrderListItem` — seven columns and no items, because the
 * table shows seven columns and the detail fetch fills the rest.
 *
 * `q` is `email__icontains` and **nothing else**: not the customer name, not the
 * order id. The placeholder in the console says "Search by email…", which is
 * accurate, and widening it here would make the demo's search better than the
 * product's and hide a real limitation.
 *
 * `status` is a bare `str`, not a `Literal`, so an unrecognised value filters to
 * an empty list rather than 422-ing. `user_id` is the deep link the order detail
 * page builds for "View all N orders". `date_from` / `date_to` compare the
 * **UTC** date part of `created_at` while the console's Today / Last 7 days
 * presets are built in the browser's zone — a real mismatch for a visitor far
 * enough east or west, reproduced rather than repaired.
 */
register(
  'GET',
  '/admin/orders',
  (request): PageEnvelope<AdminOrderListItemOut> => {
    const { params } = request;
    let rows = orderedOrders();

    const q = params.q ?? '';
    if (q) rows = rows.filter((order) => icontains(order.email, q));

    const status = params.status ?? '';
    if (status) rows = rows.filter((order) => order.status === status);

    const userId = asInt(params.user_id);
    if (userId !== null) rows = rows.filter((order) => order.user_id === userId);

    rows = applyDateRange(rows, params, (order) => order.created_at);

    return paginate(rows, params, serializeAdminOrderRow);
  },
  STAFF,
);

// --------------------------------------------------------------------------- //
//  POST /admin/orders
// --------------------------------------------------------------------------- //

/**
 * `set_unusable_password()` writes a `!`-prefixed value that `check_password`
 * short-circuits on, so no supplied password can ever match it — the account
 * exists but cannot be signed into until its owner claims it through the
 * password-reset flow.
 *
 * Upstream appends 40 random characters after the `!`; there is no randomness
 * available here — the house rules forbid `Math.random()`, and determinism is the
 * point — so the sentinel is a fixed string. Somebody reading this file could
 * therefore type it, which upstream's random tail prevents; behind such an
 * account there is nothing but the phone orders the console just wrote for it,
 * and the demo banner hands out an administrator session on request anyway.
 */
const UNUSABLE_PASSWORD = '!unusable-password';

/**
 * The phone-order form. It is the **same** `create_order_for_user` the customer
 * checkout uses — same pricing, same discount re-validation, same `uses_count`
 * increment — differing only in who may call it and that the reply is serialised
 * with `is_admin`.
 *
 * The customer is resolved by `email__iexact`, and **a missing one is created**:
 * a `customer`-role account with an unusable password, its name split on the
 * first space so `"Walk In"` becomes `Walk` / `In` and `"Nino"` becomes `Nino` /
 * `""`. Python's `split(" ", 1)` keeps the remainder whole, so `"Ana Maria
 * Beridze"` gives the last name `Maria Beridze` and a double space survives as a
 * leading one — hence the index arithmetic below rather than a `split(' ')`.
 *
 * The account is written **before** the order, and only the order's own body is
 * atomic upstream, so a create that then fails on an unknown product or a dead
 * discount leaves the stub account behind. Reproduced: it is visible in the admin
 * user list afterwards, which is exactly what the real console shows.
 *
 * This is the only order route that writes a `create` audit row. The customer's
 * own `POST /orders` writes nothing at all.
 */
register(
  'POST',
  '/admin/orders',
  (request): OrderOut => {
    const payload = readOrderCreateIn(request);

    let user = userByEmail(payload.email);
    if (!user) {
      const trimmed = payload.full_name.trim();
      const gap = trimmed.indexOf(' ');
      const created: UserRow = {
        id: nextId('users'),
        password: UNUSABLE_PASSWORD,
        email: payload.email,
        first_name: gap === -1 ? trimmed : trimmed.slice(0, gap),
        last_name: gap === -1 ? '' : trimmed.slice(gap + 1),
        // `create_user` takes no role, so the model default stands. A phone order
        // never mints staff.
        role: 'customer',
        is_active: true,
        is_staff: false,
        is_superuser: false,
        date_joined: nowIsoOffset(),
        last_login: null,
      };
      syncRoleFlags(created);
      store.users.push(created);
      user = created;
    }

    const order = createOrderForUser(user, payload);
    writeAudit(request.user, 'create', 'order', order.id, `Manual order for ${payload.email}`);
    return serializeOrder(order, { isAdmin: true });
  },
  STAFF,
);

// --------------------------------------------------------------------------- //
//  POST /admin/orders/bulk-status
// --------------------------------------------------------------------------- //

/**
 * `Order.objects.filter(id__in=ids).update(status=…)` followed by a loop over the
 * **payload's** ids.
 *
 * Two faithful oddities in six lines. `updated` counts rows, so a repeated id in
 * the request counts once — the `Map` here is what reproduces `id__in`'s implicit
 * de-duplication. The audit loop is over the raw list, so that same repeated id
 * writes two rows, and an id matching nothing writes one anyway.
 *
 * And `updated_at` is deliberately **not** touched: `QuerySet.update()` writes
 * only the columns it was handed and never fires `auto_now`. `touchOrder()` must
 * not be called from here — doing so would be a one-word change that quietly
 * makes the bulk path differ from the product.
 */
register(
  'POST',
  '/admin/orders/bulk-status',
  (request): { updated: number } => {
    const body = bodyOf(request);
    const ids = readIdList(body, 'ids');
    const status = readEnum(body, 'status', ORDER_STATUSES, { required: true });

    const matched = new Map<number, OrderRow>();
    for (const id of ids) {
      const order = orderById(id);
      if (order) matched.set(id, order);
    }
    for (const order of matched.values()) order.status = status;

    for (const id of ids) {
      writeAudit(request.user, 'status_change', 'order', id, bulkStatusSummary(status));
    }

    return { updated: matched.size };
  },
  STAFF,
);

// --------------------------------------------------------------------------- //
//  GET /admin/orders/{id}  ·  PATCH /admin/orders/{id}
// --------------------------------------------------------------------------- //

register(
  'GET',
  '/admin/orders/:id',
  (request): OrderOut => serializeOrder(orderOr404(request, 'id'), { isAdmin: true }),
  STAFF,
);

/**
 * A **true partial**, unlike almost every other `PATCH` in this API: only the
 * non-null keys are written, and `{}` is a legal no-op that saves nothing, audits
 * nothing and still answers 200 with the order.
 *
 * `status: OrderStatusLiteral | None` means an explicit JSON `null` reads as
 * "absent" and not as "clear the column" — which is why both fields are tested
 * with `has(...) && value !== null` before they are read. Passing a `null`
 * straight to `readEnum` would 422 a request Pydantic accepts.
 *
 * Auditing is asymmetric on purpose: `status_change` only when the value really
 * moved, `notes_update` whenever `adminNotes` was present at all — so saving the
 * notes textarea unchanged still writes a row, which is what the console's own
 * dirty check tries to avoid and does not always manage.
 *
 * `updated_at` moves whenever either field was present. Without it the activity
 * feed beside the order would never refetch, because its `reloadKey` is exactly
 * this column.
 */
register(
  'PATCH',
  '/admin/orders/:id',
  (request): OrderOut => {
    const body = bodyOf(request);
    const statusGiven = has(body, 'status') && body.status !== null;
    const notesGiven = has(body, 'adminNotes') && body.adminNotes !== null;
    const status = statusGiven
      ? readEnum(body, 'status', ORDER_STATUSES, { required: true })
      : null;
    const adminNotes = notesGiven ? readString(body, 'adminNotes', { required: true }) : null;

    const order = orderOr404(request, 'id');
    const previousStatus = order.status;

    if (status !== null) order.status = status;
    if (adminNotes !== null) order.admin_notes = adminNotes;

    if (statusGiven || notesGiven) {
      // `update_fields` gains `"updated_at"`, which is what makes `auto_now` fire.
      touchOrder(order);
      if (statusGiven && previousStatus !== order.status) {
        writeAudit(
          request.user,
          'status_change',
          'order',
          order.id,
          transitionSummary(previousStatus, order.status),
        );
      }
      if (notesGiven) {
        writeAudit(request.user, 'notes_update', 'order', order.id, 'Internal notes edited');
      }
    }

    return serializeOrder(order, { isAdmin: true });
  },
  STAFF,
);

// --------------------------------------------------------------------------- //
//  The three item routes
//
//  All three end the same way: recompute `subtotal = Σ line_total` and
//  `total = subtotal − discount_amount`, **preserving the discount snapshot
//  verbatim**. The code is not re-looked-up, the percentage is not re-applied to
//  the new subtotal, and the amount is not re-clamped — so stripping items off a
//  discounted order can drive its total negative. `recomputeTotals` in
//  `../pricing.ts` owns that, and the console's own copy advertises it: "the
//  discount on this order is preserved".
// --------------------------------------------------------------------------- //

/**
 * `product.price × quantity`, snapshotting the product's name, image and price
 * onto the line.
 *
 * It goes through `priceLines()` rather than assembling the row here so that the
 * snapshot rule has exactly one implementation across checkout and the console.
 * The only difference is what a missing product means: create answers 400
 * `Unknown product id(s): [...]`, while this route's `get_object_or_404(Product,
 * pk=…)` answers a plain 404.
 *
 * A second add of the same product and size makes a **second line**. Nothing
 * merges — upstream calls `OrderItem.objects.create()` unconditionally, and the
 * console shows and edits both rows.
 */
register(
  'POST',
  '/admin/orders/:orderId/items',
  (request): OrderOut => {
    const body = bodyOf(request);
    const productId = readInt(body, 'productId', { required: true });
    const size = readString(body, 'size');
    const quantity = readInt(body, 'quantity', { required: true, min: 1, max: 99 });

    const order = orderOr404(request, 'orderId');
    ensurePending(order);

    const { lines, missing } = priceLines([{ product_id: productId, size, quantity }]);
    if (missing.length > 0) throw notFound();
    const line = lines[0];
    store.order_items.push({ id: nextId('order_items'), order_id: order.id, ...line });

    recomputeTotals(order);
    // Upstream reads `product.name` off the live row; the snapshot was taken from
    // it a moment ago, so the two are the same string at this instant.
    writeAudit(
      request.user,
      'item_add',
      'order',
      order.id,
      itemLineSummary('add', quantity, line.product_name, size),
    );

    return serializeOrder(order, { isAdmin: true });
  },
  STAFF,
);

/**
 * `unit_price` is **never** re-read from the catalogue. A quantity change
 * multiplies the price the customer was originally quoted, so editing a line on
 * an old order cannot silently reprice it at today's rates.
 *
 * A payload with neither key returns the order unchanged — no save, no
 * `updated_at`, no audit row — and that check sits *after* the 404 on the item,
 * so a bad item id is still a 404 even when there is nothing to write.
 *
 * The audit row is skipped when nothing actually moved (`quantity: 3` on a line
 * already at 3): upstream builds a `parts` list and guards it with `if parts:`,
 * which `itemChangeSummary()` reproduces by answering `''`.
 */
register(
  'PATCH',
  '/admin/orders/:orderId/items/:itemId',
  (request): OrderOut => {
    const body = bodyOf(request);
    const quantityGiven = has(body, 'quantity') && body.quantity !== null;
    const sizeGiven = has(body, 'size') && body.size !== null;
    const quantity = quantityGiven
      ? readInt(body, 'quantity', { required: true, min: 1, max: 99 })
      : null;
    const size = sizeGiven ? readString(body, 'size', { required: true }) : null;

    const order = orderOr404(request, 'orderId');
    ensurePending(order);
    const item = orderItemOr404(request, order);

    if (!quantityGiven && !sizeGiven) return serializeOrder(order, { isAdmin: true });

    const previousQuantity = item.quantity;
    const previousSize = item.size;
    if (quantity !== null) {
      item.quantity = quantity;
      item.line_total = fromMinor(toMinor(item.unit_price) * quantity);
    }
    if (size !== null) item.size = size;

    recomputeTotals(order);

    const summary = itemChangeSummary(item.product_name, {
      quantity: quantityGiven ? { from: previousQuantity, to: item.quantity } : undefined,
      size: sizeGiven ? { from: previousSize, to: item.size } : undefined,
    });
    if (summary) writeAudit(request.user, 'item_update', 'order', order.id, summary);

    return serializeOrder(order, { isAdmin: true });
  },
  STAFF,
);

/**
 * **200 with the whole order, not 204.** The Ninja route declares
 * `response=OrderOut` and `adminOrdersApi.removeItem` types its reply `Order`,
 * so a 204 here would leave the page holding `null` where it expects the
 * refreshed order and blank the item list.
 *
 * The last-item 400 is checked **before** the item is looked up, exactly as
 * upstream orders it, so removing an id that is not on a one-line order reports
 * `last_item` rather than `Not Found`. The console disables the trash button at
 * one line, so only a hand-made request sees either.
 *
 * The summary is built before the splice, because `item.product_name` and
 * `item.quantity` are gone afterwards — upstream's comment says the same thing in
 * a variable name.
 */
register(
  'DELETE',
  '/admin/orders/:orderId/items/:itemId',
  (request): OrderOut => {
    const order = orderOr404(request, 'orderId');
    ensurePending(order);
    if (orderItemsFor(order.id).length <= 1) throw fail('last_item');

    const item = orderItemOr404(request, order);
    const summary = itemLineSummary('remove', item.quantity, item.product_name, item.size);

    // `orderItemsFor()` hands back a fresh array, so the row has to come out of
    // the store's own one or the line would reappear on the next read.
    const at = store.order_items.indexOf(item);
    if (at >= 0) store.order_items.splice(at, 1);

    recomputeTotals(order);
    writeAudit(request.user, 'item_remove', 'order', order.id, summary);

    return serializeOrder(order, { isAdmin: true });
  },
  STAFF,
);
