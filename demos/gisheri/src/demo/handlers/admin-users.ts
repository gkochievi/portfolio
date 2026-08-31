/**
 * `/admin/users` — a port of `accounts/admin_api.py`. Four routes, every one of
 * them `admin_auth`, listed in `../routes.md` §7.
 *
 * ## `admin`, not `staff`, and that matters
 *
 * This router is the stricter of the two, and the front end does not know it.
 * `OrderCreatePage` is a **staff** route and calls `adminUsers.list` for its
 * customer autocomplete, swallowing the failure with
 * `.catch(() => setSuggestions([]))` — so a signed-in staff member typing a
 * customer's email into a manual order sees an empty dropdown and no error at
 * all. That is §E.9's disagreement, and reproducing it is the reason the role
 * split is spelled out on every `register()` call rather than defaulted.
 * `['staff','admin']` and `['admin']` are not two spellings of one thing:
 * `roleFailure()` picks its sentence from the list, and the console prints that
 * sentence verbatim into a toast.
 *
 * ## Two self-guards and a silent strip
 *
 * An administrator cannot demote or deactivate themselves through the editor —
 * both are a 400 with their own sentence — and the bulk endpoint does not refuse
 * at all: it **removes the caller's own id from the list** and says so with
 * `skippedSelf`, so ticking every row and pressing Deactivate does the right
 * thing to everyone else and nothing to you. Three defences against one hazard,
 * which is what gets built after somebody locks themselves out once.
 *
 * ## The rollup that disagrees with the order page
 *
 * `serializeAdminUserDetail` excludes cancelled orders from `orderCount`,
 * `totalSpent` and `lastOrderAt`, while `OrderOut.customerOrderCount` — which
 * `admin-orders.ts` sends — counts every order including cancelled. A customer
 * with four orders, one cancelled, reads `4` on the order screen and `3` here.
 * Both numbers are upstream's, they answer different questions, and the seed puts
 * a customer on screen who shows the difference.
 *
 * `POST /admin/users` is deliberately **not registered**: `adminUsers.create`
 * exists in `lib/admin-api.ts` and `UsersListPage` has no button that reaches it.
 * See §E.11 — a route with no caller would be a lie in `../routes.md`.
 */

import {
  bodyOf,
  fail,
  has,
  notFound,
  readBoolean,
  readEnum,
  readString,
  unauthorized,
  validationError,
} from '../base';
import { applyDateRange, asBoolean, icontains, paginate } from '../query';
import type { PageEnvelope } from '../query';
import { register } from '../router';
import type { DemoRequest } from '../router';
import { serializeAdminUser, serializeAdminUserDetail } from '../serialize';
import type { AdminUserDetailOut, AdminUserOut } from '../serialize';
import {
  orderedUsers,
  store,
  syncRoleFlags,
  transitionSummary,
  userById,
  writeAudit,
} from '../store';
import { ROLES } from '../types';
import type { Role, UserRow } from '../types';

/**
 * The gate has already refused every caller who is not an administrator, so this
 * narrows a type rather than deciding anything — but it throws the gate's own 401
 * instead of asserting, so a route mis-registered `'public'` would answer
 * `Unauthorized` rather than crash on `null.id` inside a self-guard.
 */
function actingAdmin(request: DemoRequest): UserRow {
  if (!request.user) throw unauthorized();
  return request.user;
}

/**
 * `ids: list[int] = Field(min_length=1, max_length=200)`.
 *
 * A copy of the reader in `admin-catalog.ts`, because a handler module exports
 * nothing: the three bulk endpoints each carry their own. The bounds are the
 * point — an empty selection must be a 422 and not a cheerful `{"affected": 0}`.
 */
function readIdList(body: Record<string, unknown>, key: string): number[] {
  if (!has(body, key)) throw validationError(['body', key], 'Field required', 'missing');
  const raw = body[key];
  if (!Array.isArray(raw)) {
    throw validationError(['body', key], 'Input should be a valid list', 'list_type');
  }
  if (raw.length < 1) {
    throw validationError(
      ['body', key],
      `List should have at least 1 item after validation, not ${raw.length}`,
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

// --------------------------------------------------------------------------- //
//  GET /admin/users
// --------------------------------------------------------------------------- //

/**
 * `q` is a three-way **OR** — `email`, `first_name`, `last_name`, all
 * `icontains` — unlike `/admin/orders`, whose `q` is `email__icontains` alone.
 * The two search boxes look identical and behave differently, which is the sort
 * of thing only a port notices.
 *
 * `role` is matched exactly and **not validated**: `?role=owner` is a legal
 * request that returns nobody, because upstream writes `qs.filter(role=role)`
 * with no `Literal` in front of it.
 *
 * The date range is on `date_joined`, and it is compared as a **UTC** date key
 * while the console builds its Today / Last 7 days presets from the *browser's*
 * calendar. Those two disagree for a visitor far enough east, and that
 * disagreement is real upstream behaviour — see the note on `applyDateRange`.
 *
 * List rows are `AdminUserOut`: **no order rollup**. Thirty-two aggregate queries
 * to render a table nobody reads the totals from is the reason upstream split the
 * detail schema out, and paying it here would be paying it for nothing.
 */
register(
  'GET',
  '/admin/users',
  (request): PageEnvelope<AdminUserOut> => {
    // `.order_by("email")` — restated explicitly by the view even though it is
    // also `User.Meta.ordering`, so the walker is the right source for both.
    let rows = orderedUsers();

    // `if q:` — a blank string is no filter, a string of spaces is one. Python
    // tests truthiness, not emptiness, and `buildQuery` only drops the first.
    const q = request.params.q ?? '';
    if (q) {
      rows = rows.filter(
        (row) =>
          icontains(row.email, q) || icontains(row.first_name, q) || icontains(row.last_name, q),
      );
    }

    const role = request.params.role ?? '';
    if (role) rows = rows.filter((row) => row.role === role);

    const isActive = asBoolean(request.params.is_active);
    if (isActive !== null) rows = rows.filter((row) => row.is_active === isActive);

    rows = applyDateRange(rows, request.params, (row) => row.date_joined);

    return paginate(rows, request.params, serializeAdminUser);
  },
  { auth: ['admin'] },
);

// --------------------------------------------------------------------------- //
//  POST /admin/users/bulk
// --------------------------------------------------------------------------- //

/**
 * Registered before `/admin/users/:id` for readability only — `:id` is Django's
 * `<int:user_id>` and cannot match the word `bulk`, so the two coexist whatever
 * order they arrive in.
 *
 * `skippedSelf` is computed **before** the strip and reports only that the
 * caller's id was in the list, not that anything was refused: tick yourself plus
 * five colleagues and the answer is `{affected: 5, skippedSelf: true}`, with the
 * toast adding "Your own account was skipped". Tick only yourself and it is
 * `{affected: 0, skippedSelf: true}` with **no audit rows at all** — upstream
 * returns before it reaches the loop.
 *
 * One audit row per **remaining id**, including ids that matched no row: the loop
 * walks the id list, not the rows it updated, so deactivating a user somebody
 * else has already deleted still leaves a trail. `affected` meanwhile counts the
 * rows, so the two numbers can legitimately differ.
 *
 * The write is `qs.update(is_active=…)`, which bypasses `User.save()` — so
 * `is_staff` / `is_superuser` are not recomputed. They are derived from `role`
 * and no role moves here, so nothing drifts; `syncRoleFlags` would be a no-op and
 * is deliberately not called, because calling it would suggest `.update()` does.
 */
register(
  'POST',
  '/admin/users/bulk',
  (request): { affected: number; skippedSelf: boolean } => {
    const me = actingAdmin(request);
    const body = bodyOf(request);
    const ids = readIdList(body, 'ids');
    const action = readEnum(body, 'action', ['activate', 'deactivate'] as const, {
      required: true,
    });

    const skippedSelf = ids.includes(me.id);
    const targets = ids.filter((id) => id !== me.id);
    if (targets.length === 0) return { affected: 0, skippedSelf };

    const isActive = action === 'activate';
    const matched = store.users.filter((row) => targets.includes(row.id));
    for (const row of matched) row.is_active = isActive;

    const summary = isActive ? 'Bulk activated' : 'Bulk deactivated';
    for (const id of targets) writeAudit(me, 'activation_change', 'user', id, summary);

    return { affected: matched.length, skippedSelf };
  },
  { auth: ['admin'] },
);

// --------------------------------------------------------------------------- //
//  GET /admin/users/{id}
// --------------------------------------------------------------------------- //

/**
 * One response carrying **both timestamp shapes at once**: `dateJoined` and
 * `lastLogin` come back as `+00:00` with six digits of microseconds, because
 * `AdminUserOut` declares them `str` and `_serialize` calls `.isoformat()`
 * itself, while `lastOrderAt` is a real `datetime` and goes through
 * `NinjaJSONEncoder` into `…Z` with three. Normalising them would tidy away a
 * true quirk of the wire; see `serializeAdminUser`.
 */
register(
  'GET',
  '/admin/users/:id',
  (request): AdminUserDetailOut => {
    const user = userById(Number(request.path.id));
    if (!user) throw notFound();
    return serializeAdminUserDetail(user);
  },
  { auth: ['admin'] },
);

// --------------------------------------------------------------------------- //
//  PATCH /admin/users/{id}
// --------------------------------------------------------------------------- //

/**
 * Four fields, all of them written — `role` and `isActive` carry no default, so
 * an incomplete body is a 422 rather than a partial update.
 *
 * The order of the three failures is exact and observable. Pydantic validates the
 * whole model before the view runs a single query, so **422 beats 404**: a body
 * missing `role` on a user id that does not exist answers `Request failed (422)`.
 * Then `get_object_or_404`. Then, and only when editing yourself, the two guards
 * in their own order: the role guard first, so an administrator who both demotes
 * and deactivates themselves in one request is told about the demotion.
 *
 * `UserEditPage` disables the role `<Select>` and the isActive `<Switch>` when
 * `isSelf`, so the console cannot normally produce either 400 — they are reachable
 * from the seam, and reproducing them is what makes the guard real rather than
 * decorative.
 *
 * Both audit rows can fire from one request, role first. `syncRoleFlags` is
 * `User.save()`'s mirror and must run whenever `role` moves, or Django's own
 * `/admin` and every permission check would go on believing the old answer.
 */
register(
  'PATCH',
  '/admin/users/:id',
  (request): AdminUserDetailOut => {
    const me = actingAdmin(request);
    const body = bodyOf(request);

    // Read first: validation precedes the lookup upstream, so a malformed body
    // must answer 422 even when the id names nobody.
    const firstName = readString(body, 'firstName', { max: 150 });
    const lastName = readString(body, 'lastName', { max: 150 });
    const role = readEnum<Role>(body, 'role', ROLES, { required: true });
    const isActive = readBoolean(body, 'isActive', { required: true });

    const user = userById(Number(request.path.id));
    if (!user) throw notFound();

    if (user.id === me.id) {
      if (role !== 'admin') throw fail('self_role_change');
      if (!isActive) throw fail('self_deactivate');
    }

    const previousRole = user.role;
    const previousActive = user.is_active;

    user.first_name = firstName;
    user.last_name = lastName;
    user.role = role;
    user.is_active = isActive;
    // `User.save()` recomputes the two derived columns on every write.
    syncRoleFlags(user);

    if (previousRole !== user.role) {
      writeAudit(me, 'role_change', 'user', user.id, transitionSummary(previousRole, user.role));
    }
    if (previousActive !== user.is_active) {
      writeAudit(
        me,
        'activation_change',
        'user',
        user.id,
        user.is_active ? 'activated' : 'deactivated',
      );
    }

    return serializeAdminUserDetail(user);
  },
  { auth: ['admin'] },
);
