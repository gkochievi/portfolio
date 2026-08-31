/**
 * `/orders` — a port of `orders/api.py`: place an order, list your own, read one
 * of your own. Three routes, all `jwt_auth`, all in `../routes.md` §3.
 *
 * The interesting half of this module is not here. `create_order_for_user` lives
 * in `../pricing.ts` because upstream puts it in `orders/api.py` and then has
 * `orders/admin_api.py` import it — one create path serving both the customer's
 * checkout and the staff's phone-order form, so the two can never price a cart
 * differently. `readOrderCreateIn` below is exported for the same reason and in
 * the same direction: `OrderCreateIn` is one schema upstream, validated
 * identically whoever posts it, and a second copy of the field list in
 * `admin-orders.ts` would be a second place for `quantity` to stop being capped
 * at 99. This is the only handler module that exports anything, and that is why.
 *
 * ## Three upstream behaviours reproduced here
 *
 * - **Another customer's order is a 404, not a 403.** `get_object_or_404(Order,
 *   pk=…, user=request.auth)` scopes the lookup rather than checking ownership
 *   after the fact, so a wrong id and someone else's id are indistinguishable.
 *   That is also why the gate in `../router.ts` cannot express this: object-level
 *   scoping has to happen inside the handler.
 * - **`GET /orders` returns full `OrderOut` rows**, items and all, not the
 *   trimmed shape the admin table gets. `AccountPage` renders line thumbnails
 *   from them.
 * - **Its page size clamps at 50, not 100.** `list_my_orders` is the one
 *   paginated route in this API that does not use the admin ceiling, so it is
 *   the one call to `paginate()` that must pass its own options. Forgetting them
 *   over-fetches by half a page and nothing complains.
 *
 * There is no stock anywhere in this domain: `Product` has no quantity column,
 * creating an order decrements nothing and cancelling one restores nothing. Do
 * not add it — every screen in the shop is built on its absence.
 */

import {
  bodyOf,
  notFound,
  readEmail,
  readInt,
  readString,
  unauthorized,
  validationError,
} from '../base';
import { createOrderForUser } from '../pricing';
import type { OrderCreateInput, OrderItemInput } from '../pricing';
import { paginate } from '../query';
import type { PageEnvelope } from '../query';
import { register } from '../router';
import type { DemoRequest } from '../router';
import { serializeOrder } from '../serialize';
import type { OrderOut } from '../serialize';
import { orderById, orderedOrders } from '../store';
import type { UserRow } from '../types';

/**
 * The gate has already refused an anonymous caller, so this narrows rather than
 * decides. It throws the gate's own 401 instead of asserting, so a route
 * registered `'public'` by mistake answers `Unauthorized` rather than crashing on
 * `null.id` and reaching the app as a 500.
 */
function signedInUser(request: DemoRequest): UserRow {
  if (!request.user) throw unauthorized();
  return request.user;
}

// --------------------------------------------------------------------------- //
//  `OrderCreateIn`
// --------------------------------------------------------------------------- //

/**
 * One line of the cart: `OrderItemIn`, which carries no price at all. What a
 * bracelet costs is decided by the catalogue at the moment the order is written,
 * never by the client — `priceLines()` in `../pricing.ts` does the snapshotting.
 *
 * `size` defaults to `""` (the shop sells several bracelets in one size only) and
 * `quantity` is `Field(ge=1, le=99)` with no default, so a missing quantity is a
 * 422 and `0` is a 422 rather than a silently dropped line.
 *
 * Pydantic's `loc` for a nested list item would read
 * `['body', 'payload', 'items', 0, 'productId']`; the readers here emit
 * `['body', 'productId']`. Nothing renders either — `api.ts` reads `detail` only
 * when it is a string, so every 422 in this app surfaces as `Request failed (422)`
 * — and inventing the index would be precision nobody can observe.
 */
function readOrderItemIn(raw: unknown, index: number): OrderItemInput {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw validationError(
      ['body', 'items', String(index)],
      'Input should be a valid dictionary or instance of OrderItemIn',
      'model_type',
    );
  }
  const line = raw as Record<string, unknown>;
  return {
    product_id: readInt(line, 'productId', { required: true }),
    size: readString(line, 'size'),
    quantity: readInt(line, 'quantity', { required: true, min: 1, max: 99 }),
  };
}

/**
 * `orders/schemas.py::OrderCreateIn`, read in **declaration order**.
 *
 * The order is not cosmetic. Pydantic validates the whole model before the view
 * runs a single query and reports only the first failure, so a payload with both
 * an empty basket and a malformed address must report the basket. Reading the
 * fields in any other sequence would answer a different 422 than the real server
 * for the same request.
 *
 * That same "validate first, then run the view" rule is why every handler below
 * calls this **before** it looks a row up: a bad payload aimed at an order that
 * does not exist is a 422 upstream, never a 404.
 *
 * `email` is an `EmailStr`, which Pydantic hands to `email-validator` and gets
 * back **normalised**: the domain lower-cased, the local part left exactly as
 * typed because RFC 5321 makes it case-sensitive and no library will guess. The
 * fold matters twice on the admin path — it decides the email stored on the
 * order, and it decides the address a newly stubbed customer account is created
 * with, which the admin user list then renders and looks up by. `auth.ts` carries
 * its own copy of this for the same reason; both are ports of one rule Pydantic
 * applies to every `EmailStr` in the project.
 */
export function readOrderCreateIn(request: DemoRequest): OrderCreateInput {
  const body = bodyOf(request);

  const rawItems = body.items;
  if (!Array.isArray(rawItems)) {
    throw validationError(['body', 'items'], 'Input should be a valid list', 'list_type');
  }
  if (rawItems.length < 1) {
    throw validationError(
      ['body', 'items'],
      'List should have at least 1 item after validation, not 0',
      'too_short',
    );
  }

  const email = readEmail(body, 'email', { required: true });
  const at = email.lastIndexOf('@');

  return {
    items: rawItems.map(readOrderItemIn),
    full_name: readString(body, 'fullName', { required: true, min: 1, max: 200 }),
    // `EMAIL_PATTERN` has already insisted on an `@`, so the guard is unreachable
    // — but a bare `slice(at + 1)` on a -1 would mangle the address rather than
    // fail, and a mangled address becomes a customer account nobody can sign into.
    email: at < 0 ? email : `${email.slice(0, at)}@${email.slice(at + 1).toLowerCase()}`,
    phone: readString(body, 'phone', { required: true, min: 1, max: 50 }),
    city: readString(body, 'city', { required: true, min: 1, max: 100 }),
    address: readString(body, 'address', { required: true, min: 1, max: 255 }),
    notes: readString(body, 'notes'),
    discount_code: readString(body, 'discountCode'),
  };
}

// --------------------------------------------------------------------------- //
//  POST /orders
// --------------------------------------------------------------------------- //

/**
 * Checkout. 201 upstream, and invisible as such: the seam hands the app a body
 * rather than a status, so the difference from a 200 never crosses the wire.
 *
 * Everything that can fail here fails inside `createOrderForUser`, with the three
 * 400s the cart is written to display verbatim — `unknown_products`,
 * `discount_invalid` and `discount_min_order` all reach `CartPage` as the raw
 * English `detail` under a `cartPage.checkoutFailed` toast, because the app has no
 * i18n key for any of them.
 *
 * The discount is **re-validated** here even though the cart already validated it
 * through `/discounts/validate`, and that second check is the one that matters: a
 * code can have expired, been deactivated or been spent by another shopper in the
 * minutes between quoting a cart and paying for it. Upstream takes a
 * `SELECT FOR UPDATE` on the row so two concurrent checkouts serialise on it;
 * this tab is single-threaded and has no concurrency to defend against, so there
 * is no lock to reproduce — only the re-validation, which is kept in full.
 *
 * `uses_count` moves exactly here and nowhere else in the whole mock: not on
 * validate, and not back when an order is cancelled.
 *
 * The customer view blanks `adminNotes` to `""` and nulls `customerOrderCount`.
 * Both are `serialize_order`'s doing, not this route's.
 */
register('POST', '/orders', (request): OrderOut => {
  const user = signedInUser(request);
  const order = createOrderForUser(user, readOrderCreateIn(request));
  return serializeOrder(order, { isAdmin: false });
});

// --------------------------------------------------------------------------- //
//  GET /orders
// --------------------------------------------------------------------------- //

/**
 * The caller's own orders, newest first, in the `{items, total, page, pageSize}`
 * envelope. `AccountPage` asks for `(1, 5)` and shows the five most recent.
 *
 * `{defaultPageSize: 20, maxPageSize: 50}` is the whole reason `paginate()` takes
 * options: `list_my_orders` clamps at 50 where every admin list clamps at 100.
 *
 * `orderedOrders()` imposes `Meta.ordering = ["-created_at"]` before the filter,
 * and filtering preserves order, so the page is `-created_at` without this route
 * ever naming a sort. There is no ordering parameter in this API at all.
 */
register('GET', '/orders', (request): PageEnvelope<OrderOut> => {
  const user = signedInUser(request);
  return paginate(
    orderedOrders().filter((order) => order.user_id === user.id),
    request.params,
    (order) => serializeOrder(order, { isAdmin: false }),
    { defaultPageSize: 20, maxPageSize: 50 },
  );
});

// --------------------------------------------------------------------------- //
//  GET /orders/{id}
// --------------------------------------------------------------------------- //

/**
 * `get_object_or_404(Order, pk=order_id, user=request.auth)` — the ownership test
 * is part of the **lookup**, so somebody else's order answers 404 `Not Found` and
 * not 403. Reproducing the 403 would leak which order ids exist, and would put a
 * sentence on screen the customer confirmation page has no branch for: it renders
 * one hardcoded English `Order not found` card for every failure.
 */
register('GET', '/orders/:id', (request): OrderOut => {
  const user = signedInUser(request);
  const order = orderById(Number(request.path.id));
  if (!order || order.user_id !== user.id) throw notFound();
  return serializeOrder(order, { isAdmin: false });
});
