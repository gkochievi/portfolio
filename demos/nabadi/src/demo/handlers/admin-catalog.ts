/**
 * `admin-catalog` — the shop's own configuration: what it sells, who cuts hair,
 * and when. Thirty-two routes over six collections — services, service
 * categories, barbers (with their service assignments and their photo), working
 * hours, shop hours and time off — ported from `apps/admin_api/views/services.py`,
 * `views/barbers.py` and `views/working_hours.py`.
 *
 * Four things about the group are worth stating before the code, because each
 * one looks like a mistake read locally:
 *
 * - **Nothing here filters.** Not `?barber=`, not `?is_active=`, not `?search=`,
 *   not `?page_size=`. The console compensates with `fetchAllPages` plus a
 *   client-side filter — `useAdminWorkingHours` says so in a comment — and a
 *   mock that helpfully adds `?barber=` to `/admin/working-hours/` stops
 *   exercising the workaround the real console depends on.
 * - **Everything here is admin-only.** Upstream guards the two catalogue lists
 *   with a wider class and refuses every write inside them with an in-method
 *   admin check; with `admin` the only console role the two are the same gate,
 *   so all thirty-two routes register `auth: ['admin']` and no route narrows its
 *   serializer by who is asking.
 * - **Two deletes are not deletes.** A barber is deactivated, never spliced
 *   (`Booking.barber` is `PROTECT` and the row has to outlive its bookings), and
 *   `DELETE .../photo/` and `DELETE .../image/` answer 200 with the full object
 *   rather than 204 — they are `@action`s, not `destroy`.
 * - **A nested id is scoped to its parent.** A `barber_service_id` belonging to
 *   another barber is a 404, not a silent cross-barber edit.
 */

import type { DemoRequest } from '../router';
import { register } from '../router';
import { newestFirst, paginate } from '../query';
import type { DemoApiError } from '../base';
import {
  EMAIL_PATTERN,
  bodyOf,
  decimalString,
  fail,
  has,
  normalizePhone,
  nowIso,
  parseIso,
  readBoolean,
  toApiDateTime,
  TZ_SUFFIX,
  validationError,
} from '../base';
import {
  barberById,
  nextId,
  orderedBarbers,
  orderedByDisplay,
  releaseObjectUrl,
  serviceById,
  store,
  trackObjectUrl,
  userByEmail,
  userById,
  userByPhone,
  writeAudit,
} from '../store';
import {
  linkDuration,
  linkPrice,
  mediaUrl,
  serializeAdminService,
  serializeAdminTimeOff,
  specialtiesOf,
} from '../serialize';
import type {
  BarberRow,
  BarberServiceRow,
  IsoDateTime,
  Money,
  ServiceCategoryRow,
  ServiceRow,
  ShopHoursRow,
  TimeOffRow,
  TimeString,
  UserRow,
  Weekday,
  WorkingHoursRow,
} from '../types';

// --------------------------------------------------------------------------- //
//  Reading a body
//
//  None of DRF's own field messages ("This field is required.", "A valid
//  integer is required.") is a registry code, so every one of them degrades to
//  `validation_error` with the field name preserved — and only the FIRST is
//  ever reported, because the exception handler replaces the response body
//  wholesale. That is why these throw where they stand instead of collecting:
//  the caller reads its fields in serializer declaration order and the first
//  failure is the entire answer.
// --------------------------------------------------------------------------- //

type Body = Record<string, unknown>;

// `bodyOf` (the JSON body as a dict — a list, a scalar or a `FormData` reads as
// empty) and `has` (`key in validated_data`, an explicit `undefined` counting as
// absent) are `base.ts`'s. Every handler module wanted the same two.

/**
 * Three modules declare a `readText` and they are **not** the same function —
 * the three serializers behind them declare `CharField` three different ways,
 * and the differences are load-bearing. Do not merge them.
 *
 * | module | signature | `null` | a number | max length |
 * |---|---|---|---|---|
 * | `admin-bookings` | `(body, key) -> string \| undefined` | `""` | 400 | — |
 * | `admin-catalog` | `(value, field) -> string` | 400 | stringified | caller's |
 * | `admin-ops` | `(raw, field, max) -> string` | `""` | 400 | required |
 *
 */
function readText(value: unknown, field: string): string {
  if (typeof value === 'string') return value;
  // `CharField` stringifies a number and refuses everything else.
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  throw validationError(field);
}

/** `CharField(required=True)` — `allow_blank` is off, so `""` fails too. */
function requireText(body: Body, key: string, maxLength?: number): string {
  if (!has(body, key)) throw validationError(key);
  const value = readText(body[key], key);
  if (value.trim() === '') throw validationError(key);
  if (maxLength !== undefined && value.length > maxLength) throw validationError(key);
  return value;
}

/**
 * `CharField(required=False, allow_blank=True, default="")`.
 *
 * `bookings.ts` has one of these too and it is a different function: this takes
 * the default from the caller (a PATCH passes the stored value, so an absent key
 * leaves the column alone) and stringifies a number, where that one always falls
 * back to `""` and refuses a number. Same name, two serializers.
 */
function optionalText(body: Body, key: string, fallback: string, maxLength?: number): string {
  if (!has(body, key)) return fallback;
  if (body[key] === null) return '';
  const value = readText(body[key], key);
  if (maxLength !== undefined && value.length > maxLength) throw validationError(key);
  return value;
}

function readInt(value: unknown, field: string): number {
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : Number.NaN;
  if (!Number.isInteger(numeric)) throw validationError(field);
  return numeric;
}

/**
 * `PositiveIntegerField` through a `ModelSerializer` is `IntegerField(min_value=0)`,
 * so a negative `display_order` or `duration_minutes` is a 400 rather than the
 * `IntegrityError` a hand-rolled `Serializer` would let through to the database.
 */
function requireCount(body: Body, key: string): number {
  if (!has(body, key)) throw validationError(key);
  const value = readInt(body[key], key);
  if (value < 0) throw validationError(key);
  return value;
}

function optionalCount(body: Body, key: string, fallback: number): number {
  return has(body, key) ? requireCount(body, key) : fallback;
}

/** `BooleanField` — DRF's own truthy set, not JavaScript's; `base.ts` owns it. */
function optionalFlag(body: Body, key: string, fallback: boolean): boolean {
  return has(body, key) ? readBoolean(body[key], key) : fallback;
}

/**
 * `DecimalField(max_digits=10, decimal_places=2)`: at most eight digits before
 * the point and two after. DRF rejects a third decimal rather than rounding it,
 * which is the difference between a price the shop typed and a price the API
 * invented.
 */
function readMoney(value: unknown, field: string, minimum?: number): Money {
  if (typeof value !== 'number' && typeof value !== 'string') throw validationError(field);
  const text = String(value).trim();
  if (!/^-?\d{1,8}(\.\d{1,2})?$/.test(text)) throw validationError(field);
  const numeric = Number(text);
  if (minimum !== undefined && numeric < minimum) throw validationError(field);
  return decimalString(numeric);
}

/**
 * `TimeField` accepts `"10:00"`, `"10:00:00"` and `"10:00:00.000"`; the column
 * stores seconds precision and the response always reads back `"HH:MM:SS"`.
 * The Settings page and the barber hours grid both write `"HH:MM"`.
 */
function readTime(body: Body, key: string): TimeString {
  const value = body[key];
  if (typeof value !== 'string') throw validationError(key);
  const match = /^(\d{1,2}):([0-5]\d)(?::([0-5]\d))?(?:\.\d+)?$/.exec(value.trim());
  if (!match) throw validationError(key);
  const hours = Number(match[1]);
  if (hours > 23) throw validationError(key);
  return `${String(hours).padStart(2, '0')}:${match[2]}:${match[3] ?? '00'}`;
}

function requireTime(body: Body, key: string): TimeString {
  if (!has(body, key)) throw validationError(key);
  return readTime(body, key);
}

/**
 * `DateTimeField.enforce_timezone`: an aware input is converted to Asia/Tbilisi,
 * a **naive** one is interpreted as Asia/Tbilisi rather than as UTC or as the
 * reader's zone. The console posts aware instants (`new Date(...).toISOString()`),
 * but a naive string read as the visitor's local time would land the demo's time
 * off hours away from where the form put it, and only for visitors outside
 * Georgia — the worst kind of bug to see reported.
 */
function requireInstant(body: Body, key: string): IsoDateTime {
  if (!has(body, key)) throw validationError(key);
  const value = body[key];
  if (typeof value !== 'string') throw validationError(key);
  const text = value.trim();
  const aware = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(text);
  const at = parseIso(aware ? text : `${text}${TZ_SUFFIX}`);
  if (!Number.isFinite(at)) throw validationError(key);
  return toApiDateTime(at);
}

/** `choices=WEEKDAY_CHOICES`, 0 = Monday through 6 = Sunday. */
function requireWeekday(body: Body): Weekday {
  if (!has(body, 'weekday')) throw validationError('weekday');
  const value = readInt(body.weekday, 'weekday');
  if (value < 0 || value > 6) throw validationError('weekday');
  return value as Weekday;
}

/**
 * `PrimaryKeyRelatedField(many=True, queryset=Specialty.objects.all())` — every
 * id must resolve, and the whole set is replaced rather than merged.
 */
function readSpecialtyIds(body: Body, key: string): number[] {
  const value = body[key];
  if (!Array.isArray(value)) throw validationError(key);
  const ids: number[] = [];
  for (const item of value) {
    const id = readInt(item, key);
    if (!store.specialties.some((row) => row.id === id)) throw validationError(key);
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

// --------------------------------------------------------------------------- //
//  Audit helpers
// --------------------------------------------------------------------------- //

type Change = { old: unknown; new: unknown };

/**
 * `AuditedModelViewSetMixin.perform_update` — **only the fields that moved**.
 * An M2M is compared and reported as a sorted id array on both sides, which is
 * what `_jsonable` does with a related manager.
 */
function changesBetween<T extends object>(before: T, after: T): Record<string, Change> {
  const changes: Record<string, Change> = {};
  const was = before as Record<string, unknown>;
  for (const [key, next] of Object.entries(after)) {
    const previous = was[key];
    if (JSON.stringify(previous ?? null) !== JSON.stringify(next ?? null)) {
      changes[key] = { old: previous ?? null, new: next };
    }
  }
  return changes;
}

/**
 * `on_delete=PROTECT` on `Booking.service` and `Service.category`, reproduced.
 *
 * Upstream catches neither `ProtectedError`, so deleting a service that has ever
 * been booked — or a category that still holds services — is an uncaught
 * exception the handler turns into a 500. It is reproduced rather than softened
 * because the alternative is worse than a blunt error: `store.validateSeed()`'s
 * first invariant is that every `*_id` resolves, and a splice that left
 * `booking.service_id` dangling would blank the service name on every screen
 * that renders that booking, in both trees, with nothing anywhere to say why.
 */
function protectedError(): DemoApiError {
  return fail('server_error');
}

// --------------------------------------------------------------------------- //
//  Services — `/admin/services/`
// --------------------------------------------------------------------------- //

/** `Service.objects.all().order_by("category", "display_order", "name")`. */
function orderedServices(): ServiceRow[] {
  return [...store.services].sort(
    (left, right) =>
      left.category_id - right.category_id ||
      left.display_order - right.display_order ||
      left.name.localeCompare(right.name, 'ka'),
  );
}

function serviceOr404(request: DemoRequest): ServiceRow {
  const row = serviceById(Number(request.path.id));
  if (!row) throw fail('not_found');
  return row;
}

/**
 * `UniqueTogetherValidator("category", "name")`. Its error lands under
 * `non_field_errors`, which the exception handler reports with **`field: null`**
 * — so the console shows the generic validation message with nothing under
 * either input. That is upstream's answer, not a lost field name.
 */
function assertServiceNameFree(categoryId: number, name: string, exceptId?: number): void {
  const clash = store.services.some(
    (row) => row.id !== exceptId && row.category_id === categoryId && row.name === name,
  );
  if (clash) throw validationError(null);
}

register(
  'GET',
  '/admin/services/',
  (request) => paginate(orderedServices(), request, serializeAdminService),
  { auth: ['admin'] },
);

register(
  'POST',
  '/admin/services/',
  (request) => {
    const body = bodyOf(request);

    // Declaration order is the reporting order: the first field that fails is
    // the only one the client is ever told about.
    const categoryId = has(body, 'category') ? readInt(body.category, 'category') : Number.NaN;
    if (!Number.isInteger(categoryId) || !store.service_categories.some((row) => row.id === categoryId)) {
      throw validationError('category');
    }
    const name = requireText(body, 'name', 120);
    const nameEn = optionalText(body, 'name_en', '', 120);
    const description = optionalText(body, 'description', '');
    const descriptionEn = optionalText(body, 'description_en', '');
    const durationMinutes = requireCount(body, 'duration_minutes');
    if (!has(body, 'price')) throw validationError('price');
    const price = readMoney(body.price, 'price');
    const iconKey = optionalText(body, 'icon_key', '', 40);
    const isActive = optionalFlag(body, 'is_active', true);
    const displayOrder = optionalCount(body, 'display_order', 0);
    assertServiceNameFree(categoryId, name);

    const row: ServiceRow = {
      id: nextId('services'),
      category_id: categoryId,
      name,
      name_en: nameEn,
      description,
      description_en: descriptionEn,
      duration_minutes: durationMinutes,
      price,
      // The catalogue image is set through the multipart action, never through
      // JSON — `ImageField` has nothing to read from a JSON body.
      image: null,
      icon_key: iconKey,
      is_active: isActive,
      display_order: displayOrder,
    };
    store.services.push(row);

    writeAudit(request, 'service.create', 'service', row.id, {
      category: categoryId,
      name,
      name_en: nameEn,
      description,
      description_en: descriptionEn,
      duration_minutes: durationMinutes,
      price,
      icon_key: iconKey,
      is_active: isActive,
      display_order: displayOrder,
    });
    return serializeAdminService(row);
  },
  { auth: ['admin'] },
);

register(
  'PATCH',
  '/admin/services/:id/',
  (request) => {
    const row = serviceOr404(request);
    const body = bodyOf(request);
    const before = serializeAdminService(row);

    const categoryId = has(body, 'category') ? readInt(body.category, 'category') : row.category_id;
    if (!store.service_categories.some((entry) => entry.id === categoryId)) {
      throw validationError('category');
    }
    const name = has(body, 'name') ? requireText(body, 'name', 120) : row.name;
    assertServiceNameFree(categoryId, name, row.id);

    row.category_id = categoryId;
    row.name = name;
    row.name_en = optionalText(body, 'name_en', row.name_en, 120);
    row.description = optionalText(body, 'description', row.description);
    row.description_en = optionalText(body, 'description_en', row.description_en);
    row.duration_minutes = optionalCount(body, 'duration_minutes', row.duration_minutes);
    if (has(body, 'price')) row.price = readMoney(body.price, 'price');
    row.icon_key = optionalText(body, 'icon_key', row.icon_key, 40);
    row.is_active = optionalFlag(body, 'is_active', row.is_active);
    row.display_order = optionalCount(body, 'display_order', row.display_order);

    const changes = changesBetween(before, serializeAdminService(row));
    writeAudit(request, 'service.update', 'service', row.id, { changes });
    return serializeAdminService(row);
  },
  { auth: ['admin'] },
);

register(
  'DELETE',
  '/admin/services/:id/',
  (request) => {
    const row = serviceOr404(request);
    if (store.bookings.some((booking) => booking.service_id === row.id)) throw protectedError();

    // The snapshot is the whole point of auditing a hard delete — `entity_id`
    // alone is useless once the row is gone — so it is taken before the splice.
    writeAudit(request, 'service.delete', 'service', row.id, { snapshot: serializeAdminService(row) });

    releaseObjectUrl(row.image);
    // `BarberService.service` cascades: the assignments go with the service, or
    // every barber tab would list a row whose catalogue half no longer exists.
    for (let index = store.barber_services.length - 1; index >= 0; index -= 1) {
      if (store.barber_services[index].service_id === row.id) store.barber_services.splice(index, 1);
    }
    store.services.splice(store.services.indexOf(row), 1);
    return undefined;
  },
  { auth: ['admin'] },
);

// --------------------------------------------------------------------------- //
//  Uploads
//
//  There is no `MEDIA_ROOT` to write to, so an uploaded file becomes an object
//  URL the row carries and `serialize.mediaUrl()` passes through untouched —
//  which is what makes the picture appear a moment after it is picked instead of
//  resolving to a path the demo could never serve. The previous value is
//  released first, standing in for the storage delete upstream does before it
//  saves the replacement; `releaseObjectUrl` is safe on a seed media key.
// --------------------------------------------------------------------------- //

/** `PHOTO_MAX_BYTES` in `views/barbers.py`. */
const PHOTO_MAX_BYTES = 8 * 1024 * 1024;

/**
 * The uploaded part.
 *
 * A JSON body to one of these routes is a 415 upstream, because the action sets
 * `parser_classes = [MultiPartParser, FormParser]`. `fail()` owns the status and
 * has no 415 to give, so the mock answers the missing-file 400 for both — the
 * same code (`validation_error`) and the same field, one status apart, on a
 * request neither seam can actually construct.
 */
function uploadedFile(request: DemoRequest, field: string): File {
  const body = request.body;
  if (!(body instanceof FormData)) throw validationError(field);
  const value = body.get(field);
  if (!(value instanceof File)) throw validationError(field);
  return value;
}

/** The magic numbers of the formats Pillow can open. SVG and HTML are not here. */
function looksLikeImage(bytes: Uint8Array): boolean {
  const starts = (...signature: number[]): boolean =>
    signature.every((byte, index) => bytes[index] === byte);
  const ascii = (offset: number, text: string): boolean =>
    [...text].every((character, index) => bytes[offset + index] === character.charCodeAt(0));

  if (starts(0xff, 0xd8, 0xff)) return true;                          // JPEG
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return true; // PNG
  if (ascii(0, 'GIF8')) return true;                                  // GIF
  if (ascii(0, 'RIFF') && ascii(8, 'WEBP')) return true;              // WebP
  if (ascii(0, 'BM')) return true;                                    // BMP
  if (starts(0x49, 0x49, 0x2a, 0x00) || starts(0x4d, 0x4d, 0x00, 0x2a)) return true; // TIFF
  return false;
}

/**
 * `serializers.ImageField()` → Pillow's `verify()`, which is a **security
 * control** rather than a nicety: it is what stops an `.html` or `.svg` script
 * payload being stored under `/media/` and served back from the site's own
 * origin, and it is pinned upstream by `test_upload_rejects_non_image_content`.
 * Bytes that are not an image fail even when the part is named `.png` and
 * declares `image/png`.
 *
 * The signature check is the portable half and runs everywhere. Where the
 * runtime has a decoder — every browser does — the file is then actually
 * decoded, which is the part that catches a truncated or hand-edited image a
 * header alone would let through.
 */
async function assertDecodableImage(file: File): Promise<void> {
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (!looksLikeImage(header)) throw validationError('photo');
  if (typeof createImageBitmap !== 'function') return;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw validationError('photo');
  }
  bitmap.close();
}

register(
  'POST',
  '/admin/services/:id/image/',
  (request) => {
    const row = serviceOr404(request);
    const file = uploadedFile(request, 'image');

    // Upstream validates NOTHING here — no size cap, no `ImageField`, no
    // Pillow verify — where the barber photo two hundred lines down validates
    // both. The asymmetry is the real product's (`views/services.py` attaches
    // the file straight off `request.FILES`), and the mock mirrors it rather
    // than inventing the rule the backend forgot: a demo that rejected an
    // upload the product accepts would be documenting a shop that does not
    // exist.
    releaseObjectUrl(row.image);
    row.image = trackObjectUrl(URL.createObjectURL(file));

    writeAudit(request, 'service.image_upload', 'service', row.id, {
      size: file.size,
      name: file.name,
    });
    // 200 with the full service, not a 204: the caller types the reply
    // `AdminService` and feeds it straight back into the list.
    return serializeAdminService(row);
  },
  { auth: ['admin'] },
);

register(
  'DELETE',
  '/admin/services/:id/image/',
  (request) => {
    const row = serviceOr404(request);
    releaseObjectUrl(row.image);
    row.image = null;
    // `audit_log(..., payload or {})` — the service route passes nothing, while
    // the barber photo route names the key it dropped. Upstream's asymmetry,
    // kept so the audit page reads the way the product's does.
    writeAudit(request, 'service.image_remove', 'service', row.id, {});
    return serializeAdminService(row);
  },
  { auth: ['admin'] },
);

// --------------------------------------------------------------------------- //
//  Service categories — `/admin/service-categories/`
// --------------------------------------------------------------------------- //

/** `ServiceCategoryAdminSerializer`, with the `Count("services")` annotation. */
function serializeAdminCategory(row: ServiceCategoryRow): Record<string, unknown> {
  return {
    id: row.id,
    name: row.name,
    name_en: row.name_en,
    display_order: row.display_order,
    service_count: store.services.filter((service) => service.category_id === row.id).length,
  };
}

function categoryOr404(request: DemoRequest): ServiceCategoryRow {
  const row = store.service_categories.find((entry) => entry.id === Number(request.path.id));
  if (!row) throw fail('not_found');
  return row;
}

register(
  'GET',
  '/admin/service-categories/',
  (request) => paginate(orderedByDisplay(store.service_categories), request, serializeAdminCategory),
  { auth: ['admin'] },
);

register(
  'POST',
  '/admin/service-categories/',
  (request) => {
    const body = bodyOf(request);
    const name = requireText(body, 'name', 80);
    // `name` is unique across categories, and DRF's `UniqueValidator` sits on
    // the field itself — so unlike the service's unique-together, this one does
    // report a field.
    if (store.service_categories.some((entry) => entry.name === name)) throw validationError('name');
    const nameEn = optionalText(body, 'name_en', '', 80);
    const displayOrder = optionalCount(body, 'display_order', 0);

    const row: ServiceCategoryRow = {
      id: nextId('service_categories'),
      name,
      name_en: nameEn,
      display_order: displayOrder,
    };
    store.service_categories.push(row);

    writeAudit(request, 'service_category.create', 'service_category', row.id, {
      name,
      name_en: nameEn,
      display_order: displayOrder,
    });
    return serializeAdminCategory(row);
  },
  { auth: ['admin'] },
);

register(
  'PATCH',
  '/admin/service-categories/:id/',
  (request) => {
    const row = categoryOr404(request);
    const body = bodyOf(request);
    const before = serializeAdminCategory(row);

    if (has(body, 'name')) {
      const name = requireText(body, 'name', 80);
      if (store.service_categories.some((entry) => entry.id !== row.id && entry.name === name)) {
        throw validationError('name');
      }
      row.name = name;
    }
    row.name_en = optionalText(body, 'name_en', row.name_en, 80);
    row.display_order = optionalCount(body, 'display_order', row.display_order);

    writeAudit(request, 'service_category.update', 'service_category', row.id, {
      changes: changesBetween(before, serializeAdminCategory(row)),
    });
    return serializeAdminCategory(row);
  },
  { auth: ['admin'] },
);

register(
  'DELETE',
  '/admin/service-categories/:id/',
  (request) => {
    const row = categoryOr404(request);
    // `Service.category` is PROTECT: a category with services cannot go.
    if (store.services.some((service) => service.category_id === row.id)) throw protectedError();

    writeAudit(request, 'service_category.delete', 'service_category', row.id, {
      snapshot: serializeAdminCategory(row),
    });
    store.service_categories.splice(store.service_categories.indexOf(row), 1);
    return undefined;
  },
  { auth: ['admin'] },
);

// --------------------------------------------------------------------------- //
//  Barbers — `/admin/barbers/`
// --------------------------------------------------------------------------- //

/**
 * `BarberAdminOutSerializer` — one shape for every barber reply on this module,
 * list and detail alike.
 *
 * Two upstream quirks are deliberately **not** reproduced, both because they are
 * artefacts rather than contract:
 *
 * - `photo` comes back relative from `retrieve` upstream and absolute from the
 *   other four responses, because only `retrieve` serializes without the
 *   request in context. `mediaUrl()` is always fully qualified here, and it has
 *   to be: `BarberDetail.tsx`'s `resolvePhotoUrl` prefixes `API_BASE` minus
 *   `/api` onto anything that does not start with `http`, which under a deploy
 *   base would prepend the base a second time and 404 every photo on that page.
 * - `service_count` is `0` on the create / patch / photo responses upstream,
 *   because only the list and retrieve querysets carry the annotation. It is
 *   counted honestly here; `AdminBarberDetail` does not declare the key, so
 *   nothing reads either answer, and one serializer that is always right beats
 *   two that disagree.
 */
function serializeAdminBarber(row: BarberRow): Record<string, unknown> {
  const user = userById(row.user_id);
  return {
    id: row.id,
    user: row.user_id,
    user_phone: user?.phone ?? '',
    user_first_name: user?.first_name ?? '',
    user_last_name: user?.last_name ?? '',
    user_email: user?.email ?? null,
    bio: row.bio,
    photo: mediaUrl(row.photo),
    specialties: specialtiesOf(row),
    display_order: row.display_order,
    is_active: row.is_active,
    service_count: store.barber_services.filter((link) => link.barber_id === row.id).length,
  };
}

function barberOr404(request: DemoRequest): BarberRow {
  const row = barberById(Number(request.path.id));
  if (!row) throw fail('not_found');
  return row;
}

register(
  'GET',
  '/admin/barbers/',
  // A bare array: `AdminBarberViewSet` is a plain `ViewSet`, so it has no
  // paginator. `fetchAllPages` wraps an array as `{next: null}` and stops after
  // one call, which is correct — do not "fix" this into an envelope.
  // Inactive barbers are included; there is no `is_active` filter anywhere here.
  () => orderedBarbers().map(serializeAdminBarber),
  { auth: ['admin'] },
);

register(
  'POST',
  '/admin/barbers/',
  (request) => {
    const body = bodyOf(request);
    // ------------------------------------------------------------------ //
    //  A deliberate divergence from upstream.
    //
    //  `BarberAdminCreateSerializer` is a plain `Serializer` and `phone` is a
    //  bare `CharField`: upstream neither normalises it nor checks it against
    //  the unique index, so a number typed without its `+995` is stored
    //  exactly as typed (`spec/api-admin-b.md` §11.1 records both facts).
    //
    //  Reproducing that faithfully puts a phone number in the users table
    //  under a string nothing else will ever match. Every other lookup in the
    //  API normalises to E.164 first, so a row stored as `555990011` is
    //  invisible to a search for `+995555990011` and invisible to a search for
    //  itself. The gap that shows is `POST /auth/register/`: it mints a second
    //  account on `+995555990011` without ever raising `phone_taken`, because
    //  the two rows collide on the person and not on the string — and the
    //  console then lists two people who are one.
    //
    //  Upstream that surfaces as a 500 from an uncaught `IntegrityError` on
    //  the well-formed duplicate, which `routes.md` already reconciles to
    //  `phone_taken` below. The demo goes one step further and normalises
    //  first, because a duplicated person is the demo-visible result and no
    //  reviewer would read it as fidelity. `phone_invalid` is the same code
    //  `POST /admin/users/` raises for the same input, so the console already
    //  localises it.
    // ------------------------------------------------------------------ //
    const rawPhone = requireText(body, 'phone', 20);
    const phone = normalizePhone(rawPhone);
    if (!phone) throw fail('phone_invalid');
    const firstName = requireText(body, 'first_name', 80);
    const lastName = requireText(body, 'last_name', 80);
    const rawEmail = has(body, 'email') && body.email !== null ? readText(body.email, 'email') : '';
    if (rawEmail !== '' && !EMAIL_PATTERN.test(rawEmail)) throw validationError('email');
    // `""` is normalised to `null`: the column is unique, and a second empty
    // string would collide with the first.
    const email = rawEmail === '' ? null : rawEmail;
    const password = requireText(body, 'password');
    const bio = optionalText(body, 'bio', '');
    const specialtyIds = has(body, 'specialties') ? readSpecialtyIds(body, 'specialties') : [];
    const displayOrder = optionalCount(body, 'display_order', 0);

    // Upstream neither normalises nor catches the `IntegrityError` these two
    // raise, so a duplicate phone is a 500 there. `routes.md` reconciles it to
    // the codes the console already localises, which is the answer the same
    // failure gets from `/admin/users/`.
    if (userByPhone(phone)) throw fail('phone_taken');
    if (email && userByEmail(email)) throw fail('email_taken');

    const user: UserRow = {
      id: nextId('users'),
      password,
      last_login: null,
      is_superuser: false,
      phone,
      email,
      first_name: firstName,
      last_name: lastName,
      role: 'barber',
      notes: '',
      is_active: true,
      // `create_user(role="barber")` leaves staff off. `barber` is a data tag
      // on the user row behind this `barbers` row — it keeps them out of the
      // customers list — and nobody signs in as one, so there is no surface for
      // a staff flag to open.
      is_staff: false,
      date_joined: nowIso(),
    };
    const barber: BarberRow = {
      id: nextId('barbers'),
      user_id: user.id,
      bio,
      photo: null,
      specialty_ids: specialtyIds,
      display_order: displayOrder,
      is_active: true,
    };
    // Both rows or neither: everything above this line only validated, so a
    // failure has left the store untouched — which is what the view's
    // `transaction.atomic()` bought upstream.
    store.users.push(user);
    store.barbers.push(barber);

    writeAudit(request, 'barber.create', 'barber', barber.id, {
      phone,
      first_name: firstName,
      last_name: lastName,
      email,
      bio,
      display_order: displayOrder,
      specialty_ids: [...specialtyIds].sort((left, right) => left - right),
    });
    return serializeAdminBarber(barber);
  },
  { auth: ['admin'] },
);

register('GET', '/admin/barbers/:id/', (request) => serializeAdminBarber(barberOr404(request)), {
  auth: ['admin'],
});

register(
  'PATCH',
  '/admin/barbers/:id/',
  (request) => {
    const barber = barberOr404(request);
    const body = bodyOf(request);
    const before = {
      bio: barber.bio,
      specialties: [...barber.specialty_ids].sort((left, right) => left - right),
      display_order: barber.display_order,
      is_active: barber.is_active,
    };

    // `phone`, `first_name`, `last_name` and `email` live on the User and are
    // edited through `/admin/users/{id}/`; they are not in this serializer, and
    // an unknown key is ignored rather than refused.
    barber.bio = optionalText(body, 'bio', barber.bio);
    if (has(body, 'specialties')) barber.specialty_ids = readSpecialtyIds(body, 'specialties');
    barber.display_order = optionalCount(body, 'display_order', barber.display_order);
    // The activate / deactivate toggle is this route with `{is_active}` alone.
    barber.is_active = optionalFlag(body, 'is_active', barber.is_active);

    writeAudit(request, 'barber.update', 'barber', barber.id, {
      changes: changesBetween(before, {
        bio: barber.bio,
        specialties: [...barber.specialty_ids].sort((left, right) => left - right),
        display_order: barber.display_order,
        is_active: barber.is_active,
      }),
    });
    return serializeAdminBarber(barber);
  },
  { auth: ['admin'] },
);

register(
  'DELETE',
  '/admin/barbers/:id/',
  (request) => {
    const barber = barberOr404(request);
    // A soft delete, and the action says so: `barber.deactivate`, never
    // `barber.delete`. `Booking.barber` is PROTECT and half the console renders
    // a barber name off a booking, so the row outlives the person's last day.
    // Deactivating an already-inactive barber still answers 204 and still
    // audits, with `{old: false, new: false}`.
    const previous = barber.is_active;
    barber.is_active = false;
    writeAudit(request, 'barber.deactivate', 'barber', barber.id, {
      is_active: { old: previous, new: false },
    });
    return undefined;
  },
  { auth: ['admin'] },
);

register(
  'POST',
  '/admin/barbers/:id/photo/',
  async (request) => {
    const barber = barberOr404(request);
    const file = uploadedFile(request, 'photo');
    if (file.size > PHOTO_MAX_BYTES) throw validationError('photo');
    await assertDecodableImage(file);

    releaseObjectUrl(barber.photo);
    barber.photo = trackObjectUrl(URL.createObjectURL(file));

    writeAudit(request, 'barber.photo_upload', 'barber', barber.id, {
      size: file.size,
      name: file.name,
    });
    return serializeAdminBarber(barber);
  },
  { auth: ['admin'] },
);

register(
  'DELETE',
  '/admin/barbers/:id/photo/',
  (request) => {
    const barber = barberOr404(request);
    // The key is captured before it is cleared: once the column is null it is
    // the only trace the removal leaves anywhere.
    const removed = barber.photo;
    releaseObjectUrl(barber.photo);
    barber.photo = null;
    writeAudit(request, 'barber.photo_remove', 'barber', barber.id, { removed });
    // 200 with the barber, not 204 — an `@action`, and the caller types it
    // `AdminBarberDetail`.
    return serializeAdminBarber(barber);
  },
  { auth: ['admin'] },
);

// --------------------------------------------------------------------------- //
//  Barber ↔ service assignments — `/admin/barbers/{id}/services/`
//
//  A `BarberService` row is what makes a barber bookable for a service at all:
//  `availability` returns nothing without one, and `effective_price` is what the
//  booking freezes into `price_at_booking`.
// --------------------------------------------------------------------------- //

/** `BarberServiceAdminOutSerializer` — catalogue values, overrides, and both resolved. */
function serializeBarberServiceLink(link: BarberServiceRow): Record<string, unknown> {
  const service = serviceById(link.service_id);
  return {
    id: link.id,
    service_id: link.service_id,
    service_name: service?.name ?? '',
    service_name_en: service?.name_en ?? '',
    // Assigning an inactive service is allowed — the flag travels so the tab
    // can mark the row rather than hide it.
    service_is_active: service?.is_active ?? false,
    base_price: decimalString(service?.price ?? 0),
    base_duration_minutes: service?.duration_minutes ?? 0,
    price_override: link.price_override,
    duration_override: link.duration_override,
    // `!= null`, never truthiness: a `"0.00"` override is a free service and a
    // `0` duration override is a real one.
    effective_price: linkPrice(link),
    effective_duration_minutes: linkDuration(link),
  };
}

/**
 * `BarberService.objects.get(barber=barber, pk=...)` — scoped to the barber in
 * the URL, so a row belonging to somebody else is a 404 and not a silent
 * cross-barber edit. Pinned upstream by `test_patch_scoped_to_url_barber`.
 */
function linkOr404(request: DemoRequest, barber: BarberRow): BarberServiceRow {
  const link = store.barber_services.find(
    (row) => row.id === Number(request.path.barberServiceId) && row.barber_id === barber.id,
  );
  if (!link) throw fail('not_found');
  return link;
}

/** `null` clears an override, an absent key leaves it alone. */
function readPriceOverride(body: Body, current: Money | null): Money | null {
  if (!has(body, 'price_override')) return current;
  if (body.price_override === null) return null;
  return readMoney(body.price_override, 'price_override', 0);
}

function readDurationOverride(body: Body, current: number | null): number | null {
  if (!has(body, 'duration_override')) return current;
  if (body.duration_override === null) return null;
  const value = readInt(body.duration_override, 'duration_override');
  if (value < 1) throw validationError('duration_override');
  return value;
}

register(
  'GET',
  '/admin/barbers/:id/services/',
  (request) => {
    const barber = barberOr404(request);
    // Ordered by the catalogue's own order, not by assignment id: the tab reads
    // as a menu. `BarberService` has no `Meta.ordering` of its own.
    return store.barber_services
      .filter((link) => link.barber_id === barber.id)
      .map((link) => ({ link, service: serviceById(link.service_id) }))
      .sort(
        (left, right) =>
          (left.service?.display_order ?? 0) - (right.service?.display_order ?? 0) ||
          (left.service?.name ?? '').localeCompare(right.service?.name ?? '', 'ka'),
      )
      .map(({ link }) => serializeBarberServiceLink(link));
  },
  { auth: ['admin'] },
);

register(
  'POST',
  '/admin/barbers/:id/services/',
  (request) => {
    const barber = barberOr404(request);
    const body = bodyOf(request);
    if (!has(body, 'service_id')) throw validationError('service_id');
    const serviceId = readInt(body.service_id, 'service_id');
    // Any service, active or not: the queryset has no filter.
    if (!serviceById(serviceId)) throw validationError('service_id');
    const priceOverride = readPriceOverride(body, null);
    const durationOverride = readDurationOverride(body, null);

    // `unique_barber_service`. Upstream lets the constraint fire inside a
    // savepoint and translates it; the code is a registry key, so the console
    // shows "This barber already offers that service." rather than the generic
    // validation message.
    if (store.barber_services.some((row) => row.barber_id === barber.id && row.service_id === serviceId)) {
      throw fail('barber_service_exists');
    }

    const link: BarberServiceRow = {
      id: nextId('barber_services'),
      barber_id: barber.id,
      service_id: serviceId,
      price_override: priceOverride,
      duration_override: durationOverride,
    };
    store.barber_services.push(link);

    writeAudit(request, 'barber_service.assign', 'barber_service', link.id, {
      barber_id: barber.id,
      service_id: serviceId,
      price_override: priceOverride,
      duration_override: durationOverride,
    });
    return serializeBarberServiceLink(link);
  },
  { auth: ['admin'] },
);

register(
  'PATCH',
  '/admin/barbers/:id/services/:barberServiceId/',
  (request) => {
    const barber = barberOr404(request);
    const link = linkOr404(request, barber);
    const body = bodyOf(request);
    const before = { price_override: link.price_override, duration_override: link.duration_override };

    // Exactly two writable keys; anything else in the body is ignored. An empty
    // body is legal and answers 200 with the row unchanged and an audit row
    // whose `changes` is `{}`.
    link.price_override = readPriceOverride(body, link.price_override);
    link.duration_override = readDurationOverride(body, link.duration_override);

    writeAudit(request, 'barber_service.update', 'barber_service', link.id, {
      barber_id: barber.id,
      changes: changesBetween(before, {
        price_override: link.price_override,
        duration_override: link.duration_override,
      }),
    });
    return serializeBarberServiceLink(link);
  },
  { auth: ['admin'] },
);

register(
  'DELETE',
  '/admin/barbers/:id/services/:barberServiceId/',
  (request) => {
    const barber = barberOr404(request);
    const link = linkOr404(request, barber);
    // Existing bookings are untouched; what goes away is the barber's ability
    // to take a new one for this service.
    writeAudit(request, 'barber_service.unassign', 'barber_service', link.id, {
      barber_id: barber.id,
      snapshot: serializeBarberServiceLink(link),
    });
    store.barber_services.splice(store.barber_services.indexOf(link), 1);
    return undefined;
  },
  { auth: ['admin'] },
);

// --------------------------------------------------------------------------- //
//  Working hours, shop hours, time off
//
//  The three of them together answer "is this barber at work at 15:00 next
//  Thursday", and the resolution order is a **fallback, never an intersection**:
//  the barber's own row for that weekday wins outright; with no row of their own
//  the shop's row governs; with neither, they are closed. A personal 08:00–22:00
//  therefore beats a 10:00–20:00 shop, and deleting a row is a real availability
//  change rather than a tidy-up — which is why every one of these mutations is
//  audited and why the seed leaves one barber without a Monday row on purpose.
//
//  A closed day is the **absence** of a row. There is no `is_closed` flag to
//  set, and the Settings page expresses "Sunday" by sending a DELETE.
// --------------------------------------------------------------------------- //

/**
 * The shared `start < end` validator, which mirrors the three `CheckConstraint`s
 * at the serializer layer. On a PATCH it reads the side the body did not supply
 * from the stored row, so moving the start past a fixed end is refused — and
 * always reported on the **end** field, whichever half the caller actually sent.
 */
function assertOrdered(startsBefore: boolean, endField: string): void {
  if (!startsBefore) throw validationError(endField);
}

function serializeWorkingHours(row: WorkingHoursRow): Record<string, unknown> {
  return {
    id: row.id,
    barber: row.barber_id,
    weekday: row.weekday,
    start_time: row.start_time,
    end_time: row.end_time,
  };
}

function serializeShopHours(row: ShopHoursRow): Record<string, unknown> {
  return { id: row.id, weekday: row.weekday, start_time: row.start_time, end_time: row.end_time };
}

// Time off is serialized by `serialize.ts::serializeAdminTimeOff`. Its `barber`
// key is nullable and `null` means a shop-wide closure, which is why the
// console's per-barber tab shows `t.barber === barberId || t.barber === null`
// rather than an equality test.

register(
  'GET',
  '/admin/working-hours/',
  (request) =>
    paginate(
      // `order_by("barber", "weekday")`. There is deliberately no `?barber=`
      // filter: the console pulls every page and filters client-side, precisely
      // because one page of 25 silently drops working days past four barbers.
      [...store.working_hours].sort(
        (left, right) => left.barber_id - right.barber_id || left.weekday - right.weekday,
      ),
      request,
      serializeWorkingHours,
    ),
  { auth: ['admin'] },
);

register(
  'POST',
  '/admin/working-hours/',
  (request) => {
    const body = bodyOf(request);
    if (!has(body, 'barber')) throw validationError('barber');
    const barberId = readInt(body.barber, 'barber');
    if (!barberById(barberId)) throw validationError('barber');
    const weekday = requireWeekday(body);
    const startTime = requireTime(body, 'start_time');
    const endTime = requireTime(body, 'end_time');
    assertOrdered(startTime < endTime, 'end_time');
    // `unique_workinghours_per_barber_weekday`. The internal
    // `duplicate_weekday_for_barber` never reaches the client — only the field
    // survives the exception handler — so this is the generic 400 on `weekday`.
    if (store.working_hours.some((row) => row.barber_id === barberId && row.weekday === weekday)) {
      throw validationError('weekday');
    }

    const row: WorkingHoursRow = {
      id: nextId('working_hours'),
      barber_id: barberId,
      weekday,
      start_time: startTime,
      end_time: endTime,
    };
    store.working_hours.push(row);

    writeAudit(request, 'working_hours.create', 'working_hours', row.id, {
      barber: barberId,
      weekday,
      start_time: startTime,
      end_time: endTime,
    });
    return serializeWorkingHours(row);
  },
  { auth: ['admin'] },
);

register(
  'PATCH',
  '/admin/working-hours/:id/',
  (request) => {
    const row = store.working_hours.find((entry) => entry.id === Number(request.path.id));
    if (!row) throw fail('not_found');
    const body = bodyOf(request);
    const before = serializeWorkingHours(row);

    const startTime = has(body, 'start_time') ? readTime(body, 'start_time') : row.start_time;
    const endTime = has(body, 'end_time') ? readTime(body, 'end_time') : row.end_time;
    assertOrdered(startTime < endTime, 'end_time');
    row.start_time = startTime;
    row.end_time = endTime;

    // One audit row per edit. The grid used to delete and re-create instead,
    // which briefly made the day look closed and produced two audit events;
    // the PATCH replaced it and one row is the contract.
    writeAudit(request, 'working_hours.update', 'working_hours', row.id, {
      changes: changesBetween(before, serializeWorkingHours(row)),
    });
    return serializeWorkingHours(row);
  },
  { auth: ['admin'] },
);

register(
  'DELETE',
  '/admin/working-hours/:id/',
  (request) => {
    const row = store.working_hours.find((entry) => entry.id === Number(request.path.id));
    if (!row) throw fail('not_found');
    // Removing the row does not close the day — it hands the barber back to the
    // shop's hours for that weekday.
    writeAudit(request, 'working_hours.delete', 'working_hours', row.id, {
      snapshot: serializeWorkingHours(row),
    });
    store.working_hours.splice(store.working_hours.indexOf(row), 1);
    return undefined;
  },
  { auth: ['admin'] },
);

register(
  'GET',
  '/admin/shop-hours/',
  (request) =>
    paginate(
      [...store.shop_hours].sort((left, right) => left.weekday - right.weekday),
      request,
      serializeShopHours,
    ),
  { auth: ['admin'] },
);

register(
  'POST',
  '/admin/shop-hours/',
  (request) => {
    const body = bodyOf(request);
    const weekday = requireWeekday(body);
    const startTime = requireTime(body, 'start_time');
    const endTime = requireTime(body, 'end_time');
    assertOrdered(startTime < endTime, 'end_time');
    // `weekday` is unique across the whole table — at most seven rows exist.
    if (store.shop_hours.some((row) => row.weekday === weekday)) throw validationError('weekday');

    const row: ShopHoursRow = {
      id: nextId('shop_hours'),
      weekday,
      start_time: startTime,
      end_time: endTime,
    };
    store.shop_hours.push(row);

    writeAudit(request, 'shop_hours.create', 'shop_hours', row.id, {
      weekday,
      start_time: startTime,
      end_time: endTime,
    });
    return serializeShopHours(row);
  },
  { auth: ['admin'] },
);

register(
  'PATCH',
  '/admin/shop-hours/:id/',
  (request) => {
    const row = store.shop_hours.find((entry) => entry.id === Number(request.path.id));
    if (!row) throw fail('not_found');
    const body = bodyOf(request);
    const before = serializeShopHours(row);

    const startTime = has(body, 'start_time') ? readTime(body, 'start_time') : row.start_time;
    const endTime = has(body, 'end_time') ? readTime(body, 'end_time') : row.end_time;
    assertOrdered(startTime < endTime, 'end_time');
    row.start_time = startTime;
    row.end_time = endTime;

    writeAudit(request, 'shop_hours.update', 'shop_hours', row.id, {
      changes: changesBetween(before, serializeShopHours(row)),
    });
    return serializeShopHours(row);
  },
  { auth: ['admin'] },
);

register(
  'DELETE',
  '/admin/shop-hours/:id/',
  (request) => {
    const row = store.shop_hours.find((entry) => entry.id === Number(request.path.id));
    if (!row) throw fail('not_found');
    // This is how the shop closes a weekday, everywhere availability is
    // computed — for every barber who has no row of their own that day.
    writeAudit(request, 'shop_hours.delete', 'shop_hours', row.id, {
      snapshot: serializeShopHours(row),
    });
    store.shop_hours.splice(store.shop_hours.indexOf(row), 1);
    return undefined;
  },
  { auth: ['admin'] },
);

register(
  'GET',
  '/admin/time-off/',
  (request) =>
    // The whole table, barber-specific rows and shop-wide closures alike,
    // newest start first. `fetchAllPages` reads it twice — the barber tab and
    // the Time-off page — and both filter client-side.
    paginate(newestFirst(store.time_off, (row) => row.start_datetime), request, serializeAdminTimeOff),
  { auth: ['admin'] },
);

register(
  'POST',
  '/admin/time-off/',
  (request) => {
    const body = bodyOf(request);
    // `barber` is `required=False, allow_null=True`: omitted or null is a
    // shop-wide closure that blocks every barber.
    let barberId: number | null = null;
    if (has(body, 'barber') && body.barber !== null) {
      barberId = readInt(body.barber, 'barber');
      if (!barberById(barberId)) throw validationError('barber');
    }
    const startDatetime = requireInstant(body, 'start_datetime');
    const endDatetime = requireInstant(body, 'end_datetime');
    assertOrdered(parseIso(startDatetime) < parseIso(endDatetime), 'end_datetime');
    const reason = optionalText(body, 'reason', '', 200);

    const row: TimeOffRow = {
      id: nextId('time_off'),
      barber_id: barberId,
      start_datetime: startDatetime,
      end_datetime: endDatetime,
      reason,
    };
    store.time_off.push(row);

    writeAudit(request, 'time_off.create', 'time_off', row.id, {
      barber: barberId,
      start_datetime: startDatetime,
      end_datetime: endDatetime,
      reason,
    });
    return serializeAdminTimeOff(row);
  },
  { auth: ['admin'] },
);

register(
  'DELETE',
  '/admin/time-off/:id/',
  (request) => {
    const row = store.time_off.find((entry) => entry.id === Number(request.path.id));
    if (!row) throw fail('not_found');
    // No past-start guard anywhere in the API, and no check against the
    // bookings the closure covers: staff may correct the record after the fact.
    writeAudit(request, 'time_off.delete', 'time_off', row.id, { snapshot: serializeAdminTimeOff(row) });
    store.time_off.splice(store.time_off.indexOf(row), 1);
    return undefined;
  },
  { auth: ['admin'] },
);
