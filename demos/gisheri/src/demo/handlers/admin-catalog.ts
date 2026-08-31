/**
 * `/admin/products`, `/admin/uploads/image`, `/admin/collections` and
 * `/admin/zodiac` — a port of `catalog/admin_api.py`. Fifteen routes, every one
 * of them `staff_auth`, listed in `../routes.md` §5.
 *
 * ## The three things that are easy to "improve" and must not be
 *
 * 1. **`PATCH` is a full replace.** The view is
 *    `for field, value in payload.model_dump(by_alias=False).items(): setattr(...)`,
 *    and `ProductIn` / `CollectionIn` / `ZodiacInfoIn` supply a default for every
 *    optional field — so a key the caller omitted arrives as its default and is
 *    written. Omitting `stones` blanks it to `[]`; omitting `nameKa` blanks it to
 *    `""`. Reading these as partial merges would be kinder and wrong: the three
 *    admin forms are built on the replace, they always send every field, and a
 *    merge would make "clear this field" impossible from the console.
 *
 * 2. **No audit rows.** `record_action` is imported in exactly two modules
 *    upstream, and neither is this one. Products, collections and zodiac
 *    mutations leave no trail at all — which is itself worth seeing, because the
 *    order and user screens do.
 *
 * 3. **`_absolute_image_url` is not reproduced.** Upstream's admin serialisers
 *    rewrite a leading `/` into `request.build_absolute_uri(value)`, i.e. into
 *    `http://localhost:8000/media/…`. There is no such origin here, and baking a
 *    dead one into every `<img src>` is the opposite of faithful.
 *    `serialize.ts::mediaUrl()` does the same job against the deploy base and is
 *    shared with the public routes, so the admin table and the shop grid show the
 *    same picture.
 *
 * ## Why `bulk` and `{id}` can share a prefix
 *
 * `/admin/products/{product_id}` is Django's `<int:…>` converter, which cannot
 * match the word `bulk` — so upstream the two routes coexist whatever order they
 * were registered in. `router.ts` reproduces that with a numeric guard on any
 * capture named `id` (or ending `Id` / `_id`), which is why the detail routes
 * below are spelled `:id` and the zodiac route is spelled `:sign`: a `:sign`
 * capture takes any single segment, an `:id` capture takes digits alone.
 */

import {
  bodyOf,
  fail,
  has,
  notFound,
  readBoolean,
  readDecimal,
  readEnum,
  readNullableDecimal,
  readString,
  readStringArray,
  validationError,
} from '../base';
import { asBoolean, countEnvelope, icontains, paginate } from '../query';
import type { CountEnvelope, PageEnvelope } from '../query';
import { register } from '../router';
import type { DemoRequest } from '../router';
import { serializeCollection, serializeProduct, serializeZodiac } from '../serialize';
import type { CollectionOut, ProductOut, ZodiacInfoOut } from '../serialize';
import {
  collectionById,
  collectionBySlug,
  nextId,
  orderedCollections,
  orderedProducts,
  orderedZodiac,
  productById,
  store,
  zodiacBySign,
} from '../store';
import { GENDERS, PURPOSES, ZODIAC_SIGNS } from '../types';
import type { CollectionRow, Gender, ProductRow, Purpose, ZodiacSign } from '../types';

// --------------------------------------------------------------------------- //
//  Readers this module needs and `base.ts` does not have
//
//  Both are shaped after a Pydantic field rather than after what the forms
//  happen to send, so a hand-typed payload fails the way the real one would.
//  They live here rather than in `base.ts` because a handler module exports
//  nothing: `admin-users.ts` and `admin-discounts.ts` carry their own `ids`
//  reader for the same reason, and three short copies are cheaper than a shared
//  helper that would have to live in a file nobody in this package owns.
// --------------------------------------------------------------------------- //

/**
 * `list[PurposeLiteral]` and friends. Pydantic reports the **offending index**,
 * so the loc carries it: a `purposes` array with a typo in its third entry names
 * `2` rather than the whole field.
 */
function readEnumArray<T extends string>(
  body: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
): T[] {
  return readStringArray(body, key).map((value, index) => {
    if (!(allowed as readonly string[]).includes(value)) {
      throw validationError(
        ['body', key, String(index)],
        `Input should be ${allowed.map((entry) => `'${entry}'`).join(' or ')}`,
        'literal_error',
      );
    }
    return value as T;
  });
}

/**
 * `ids: list[int] = Field(min_length=1, max_length=200)`.
 *
 * The bounds are the reason this is not `readStringArray` with a `Number()` over
 * it: an empty selection has to be a 422 and not a cheerful `{"affected": 0}`,
 * because a bulk button that reports success on nothing teaches the operator to
 * trust a number that means nothing.
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

/**
 * Drop rows from a store table **in place**.
 *
 * `resetStore()` refills each array rather than reassigning it, so every other
 * module is holding this exact array object; a `store.products = […]` here would
 * detach the store from itself and the reset would silently stop working.
 * Walking backwards keeps the indices valid while splicing.
 */
function dropRows<T>(rows: T[], doomed: ReadonlySet<T>): number {
  let removed = 0;
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    if (doomed.has(rows[index])) {
      rows.splice(index, 1);
      removed += 1;
    }
  }
  return removed;
}

// --------------------------------------------------------------------------- //
//  Products
// --------------------------------------------------------------------------- //

/** The columns `ProductIn` writes — every one of them, on both verbs. */
type ProductInput = Omit<ProductRow, 'id'>;

/**
 * `ProductIn`, read in declaration order because Pydantic reports only the first
 * failure and a reordered reader would name a different field for the same bad
 * payload.
 *
 * `price` accepts a JSON number or a numeric string: `ProductEditPage` binds it
 * to a text `<input>` and posts the string, while a script would post the number,
 * and `Decimal` takes both. It comes back quantised to two decimals because the
 * column is `DecimalField(max_digits=10, decimal_places=2)`.
 */
function readProductInput(request: DemoRequest): ProductInput {
  const body = bodyOf(request);
  return {
    name: readString(body, 'name', { required: true }),
    name_ka: readString(body, 'nameKa'),
    price: readDecimal(body, 'price', { required: true }),
    // The form clears the struck-through "was" price by sending `null` — or an
    // empty string, which `readNullableDecimal` also folds to `null`.
    original_price: readNullableDecimal(body, 'originalPrice'),
    image: readString(body, 'image'),
    purposes: readEnumArray<Purpose>(body, 'purposes', PURPOSES),
    zodiac_signs: readEnumArray<ZodiacSign>(body, 'zodiacSigns', ZODIAC_SIGNS),
    stones: readStringArray(body, 'stones'),
    stones_meaning: readString(body, 'stonesMeaning'),
    stones_meaning_ka: readString(body, 'stonesMeaningKa'),
    description: readString(body, 'description'),
    description_ka: readString(body, 'descriptionKa'),
    gender: readEnum<Gender>(body, 'gender', GENDERS, { fallback: 'unisex' }),
    is_bestseller: readBoolean(body, 'isBestseller'),
    is_new: readBoolean(body, 'isNew'),
  };
}

/**
 * `q` searches the **English `name` only** — not `name_ka`, not the description,
 * not the id. A Georgian-speaking operator searching for "იადეს" finds nothing,
 * which is a real gap in the product and is reproduced rather than quietly
 * widened; widening it here would make the demo's search better than the thing it
 * demonstrates.
 *
 * `is_bestseller` and `is_new` are honoured even though `ProductsListPage` never
 * sends them: `adminProducts.list()` accepts both, so the seam can, so this does.
 * They are read with `asBoolean`, which takes the literal strings and nothing
 * else — `?is_bestseller=false` must mean "only the ones that are not", never
 * "no filter".
 */
register(
  'GET',
  '/admin/products',
  (request): PageEnvelope<ProductOut> => {
    // `Product.Meta.ordering = ["id"]`, imposed at the walk; filtering below
    // preserves it, so the page is stable across every combination of filters.
    let rows = orderedProducts();

    // `if q:` — an empty string is no filter, but a string of spaces is one,
    // because Python tests truthiness and not blankness. `buildQuery` drops the
    // first and keeps the second.
    const q = request.params.q ?? '';
    if (q) rows = rows.filter((row) => icontains(row.name, q));

    const gender = request.params.gender ?? '';
    if (gender) rows = rows.filter((row) => row.gender === gender);

    const isBestseller = asBoolean(request.params.is_bestseller);
    if (isBestseller !== null) rows = rows.filter((row) => row.is_bestseller === isBestseller);

    const isNew = asBoolean(request.params.is_new);
    if (isNew !== null) rows = rows.filter((row) => row.is_new === isNew);

    return paginate(rows, request.params, serializeProduct);
  },
  { auth: ['staff', 'admin'] },
);

/** 201 upstream. The seam sees a body rather than a status, so only the shape shows. */
register(
  'POST',
  '/admin/products',
  (request): ProductOut => {
    const product: ProductRow = { id: nextId('products'), ...readProductInput(request) };
    store.products.push(product);
    return serializeProduct(product);
  },
  { auth: ['staff', 'admin'] },
);

/**
 * Registered before `/admin/products/:id` for readability only — `resolve()`
 * picks by literal count and by the capture's own guard, never by registration
 * order, and `:id` refuses the word `bulk` outright. See the module note.
 *
 * `affected` is what the `UPDATE`/`DELETE` matched, so ids that name nothing are
 * silently absent from it: selecting a row somebody else has already deleted
 * lowers the number rather than raising an error.
 */
register(
  'POST',
  '/admin/products/bulk',
  (request): { affected: number } => {
    const body = bodyOf(request);
    const ids = readIdList(body, 'ids');
    const action = readEnum(
      body,
      'action',
      ['set_bestseller', 'unset_bestseller', 'set_new', 'unset_new', 'delete'] as const,
      { required: true },
    );

    const matched = store.products.filter((row) => ids.includes(row.id));

    if (action === 'delete') {
      // §0.8's one deliberate kindness, applied to the batch as well as to the
      // single delete. `QuerySet.delete()` is one statement: if any row in it is
      // protected the whole thing raises and nothing is removed, so refusing the
      // batch — rather than deleting the deletable part of it — is the faithful
      // shape. Upstream that refusal is an uncaught `ProtectedError` and a 500.
      const referenced = matched.some((row) =>
        store.order_items.some((item) => item.product_id === row.id),
      );
      if (referenced) throw fail('product_protected');
      // Upstream's `affected` is `.delete()`'s first element, which counts
      // cascade-deleted rows too and can exceed `len(ids)` — the
      // `Product.collections` through-rows go with the product. There is no join
      // table in this store (see `types.ts`), so here it is the row count exactly.
      return { affected: dropRows(store.products, new Set(matched)) };
    }

    for (const row of matched) {
      if (action === 'set_bestseller') row.is_bestseller = true;
      else if (action === 'unset_bestseller') row.is_bestseller = false;
      else if (action === 'set_new') row.is_new = true;
      else row.is_new = false;
    }
    return { affected: matched.length };
  },
  { auth: ['staff', 'admin'] },
);

register(
  'GET',
  '/admin/products/:id',
  (request): ProductOut => {
    const product = productById(Number(request.path.id));
    if (!product) throw notFound();
    return serializeProduct(product);
  },
  { auth: ['staff', 'admin'] },
);

/**
 * **Full replace.** See the module note — this is the route the warning is about,
 * because `ProductIn` carries a default for thirteen of its fifteen fields and
 * every one of those defaults is written.
 */
register(
  'PATCH',
  '/admin/products/:id',
  (request): ProductOut => {
    // Read before the lookup: Ninja builds and validates the model *before* it
    // calls the view, so a malformed body on an id that does not exist answers
    // 422 and never 404. Looking up first would invert that on every PATCH.
    const input = readProductInput(request);

    const product = productById(Number(request.path.id));
    if (!product) throw notFound();

    Object.assign(product, input);
    return serializeProduct(product);
  },
  { auth: ['staff', 'admin'] },
);

/**
 * 204, empty body.
 *
 * `OrderItem.product` is `on_delete=PROTECT`, so deleting a product that appears
 * on any order raises `ProtectedError` upstream — which Ninja does not catch, so
 * the real server answers 500 with an HTML debug page. This is the **one** place
 * the mock is deliberately kinder: a 400 with a sentence that says what happened,
 * because a 500 in a demo reads as a broken demo rather than as a protected
 * foreign key doing its job. Named as the single divergence in the README.
 */
register(
  'DELETE',
  '/admin/products/:id',
  (request): undefined => {
    const product = productById(Number(request.path.id));
    if (!product) throw notFound();
    if (store.order_items.some((item) => item.product_id === product.id)) {
      throw fail('product_protected');
    }
    store.products.splice(store.products.indexOf(product), 1);
    return undefined;
  },
  { auth: ['staff', 'admin'] },
);

// --------------------------------------------------------------------------- //
//  The image upload
//
//  The one endpoint in the whole API that is not JSON in and JSON out, and the
//  one `lib/api.ts` does not wrap: `uploadImage` builds its own `FormData` and
//  dispatches it directly, which is why `req.body` here is a `FormData` and
//  `bodyOf()` would read it as `{}`.
// --------------------------------------------------------------------------- //

/** `sorted(ALLOWED_IMAGE_EXT)` — the order Python's `repr` printed into the 400. */
const ALLOWED_IMAGE_EXT: readonly string[] = ['.gif', '.jpeg', '.jpg', '.png', '.webp'];

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const TOKEN_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

let uploadTick = 0;

/**
 * `secrets.token_urlsafe(12)` — twelve bytes of base64url, which is sixteen
 * characters.
 *
 * A counter walked through xorshift32, not a random source: there is no
 * `Math.random()` anywhere in this mock, so two runs of the same clicks produce
 * the same names and a screenshot still matches the session it came from.
 */
function nextUploadToken(): string {
  uploadTick += 1;
  let state = ((uploadTick * 0x9e3779b1) >>> 0) || 1;
  let token = '';
  for (let index = 0; index < 16; index += 1) {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    token += TOKEN_ALPHABET[state % TOKEN_ALPHABET.length];
  }
  return token;
}

/**
 * `pathlib.PurePath(name).suffix`, which is narrower than "everything after the
 * last dot": CPython requires `0 < i < len(name) - 1`, so `.bashrc` has no
 * suffix and neither does `photo.`. Getting that wrong would let a dotfile
 * through the extension check on an empty string.
 */
function suffixOf(name: string): string {
  const base = name.slice(Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\')) + 1);
  const dot = base.lastIndexOf('.');
  return dot > 0 && dot < base.length - 1 ? base.slice(dot).toLowerCase() : '';
}

/** `FileReader` as a promise. `dispatch` awaits the handler, so an async one is fine. */
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsDataURL(file);
  });
}

/**
 * There is no storage behind this, so the returned `url` **is** the image: a
 * `data:` URI, which `mediaUrl()` passes through untouched and `<img src>`
 * renders directly. Two alternatives were rejected. A `blob:` URL leaks its
 * object until the tab closes and dies the moment the store is reset, and both
 * are unreachable from a second tab; a friendly 400 would leave the whole upload
 * path unexercised, which is the interesting half of the screen.
 *
 * The extension check runs **before** the size check, as upstream's does, so an
 * 80 MB `.txt` is refused for its type and not for its weight. Both messages are
 * verbatim: `ImageUpload` prints the raw response body into its error paragraph,
 * so the visitor sees the JSON — ugly upstream, reproduced here.
 *
 * A `data:` URI is about a third larger than the file it encodes, so an 8 MiB
 * upload costs ~11 MB of heap for as long as the form holds it. That is
 * acceptable exactly because nothing here is ever serialised or persisted: the
 * store lives and dies with the tab.
 */
register(
  'POST',
  '/admin/uploads/image',
  async (request): Promise<{ url: string; path: string }> => {
    const form = request.body;
    const file = form instanceof FormData ? form.get('file') : null;
    // `file: UploadedFile = File(...)` is required, so an absent or non-file part
    // is Ninja's 422 rather than a handler error.
    if (!(file instanceof File)) {
      throw validationError(['body', 'file'], 'Field required', 'missing');
    }

    const ext = suffixOf((file.name || '').trim());
    if (!ALLOWED_IMAGE_EXT.includes(ext)) throw fail('upload_type');
    if (file.size > MAX_IMAGE_BYTES) throw fail('upload_too_large');

    const path = `products/${nextUploadToken()}${ext}`;
    return { url: await readAsDataUrl(file), path };
  },
  { auth: ['staff', 'admin'] },
);

// --------------------------------------------------------------------------- //
//  Collections
// --------------------------------------------------------------------------- //

/** `CollectionIn` — `slug` and `name` required, the other four default to `""`. */
function readCollectionInput(request: DemoRequest): Omit<CollectionRow, 'id'> {
  const body = bodyOf(request);
  return {
    slug: readString(body, 'slug', { required: true }),
    name: readString(body, 'name', { required: true }),
    name_ka: readString(body, 'nameKa'),
    description: readString(body, 'description'),
    description_ka: readString(body, 'descriptionKa'),
    image: readString(body, 'image'),
  };
}

/**
 * **`{items, total}` and nothing else** — no `page`, no `pageSize`, no filters,
 * no query parameters at all. `CollectionsListPage` hands `DataTable` a fixed
 * `page={1} pageSize={100}`, so its footer reads `1 / 1` for ever.
 *
 * Reusing `paginate()` here would add two keys `CollectionListOut` does not
 * declare and, worse, would cap the list at 25 the day a seventh collection
 * exists — silently, because nothing on that screen would say so.
 */
register(
  'GET',
  '/admin/collections',
  (): CountEnvelope<CollectionOut> => countEnvelope(orderedCollections(), serializeCollection),
  { auth: ['staff', 'admin'] },
);

/**
 * The uniqueness check is `filter(slug=payload.slug)` — a plain `=`, **not**
 * `__iexact`, unlike the email and discount-code lookups elsewhere in this API.
 * So `Luck` and `luck` can coexist as two collections, and only the second is a
 * dead page: `CollectionsPage` resolves membership with
 * `products.filter(p => p.purposes.includes(slug))` and the purpose vocabulary is
 * lower-case. That is the model's own constraint, reproduced as it stands.
 */
register(
  'POST',
  '/admin/collections',
  (request): CollectionOut => {
    const input = readCollectionInput(request);
    if (collectionBySlug(input.slug)) throw fail('collection_slug_taken');

    const collection: CollectionRow = { id: nextId('collections'), ...input };
    store.collections.push(collection);
    return serializeCollection(collection);
  },
  { auth: ['staff', 'admin'] },
);

register(
  'GET',
  '/admin/collections/:id',
  (request): CollectionOut => {
    const collection = collectionById(Number(request.path.id));
    if (!collection) throw notFound();
    return serializeCollection(collection);
  },
  { auth: ['staff', 'admin'] },
);

/**
 * Full replace, and the duplicate check fires only when the slug actually moves:
 * `payload.slug != obj.slug and …exclude(pk=obj.pk).exists()`. Saving a
 * collection without touching its slug therefore never trips over itself, which
 * a naive `exists()` would.
 */
register(
  'PATCH',
  '/admin/collections/:id',
  (request): CollectionOut => {
    // 422 before 404 — see the note on `PATCH /admin/products/:id`.
    const input = readCollectionInput(request);

    const collection = collectionById(Number(request.path.id));
    if (!collection) throw notFound();

    if (input.slug !== collection.slug) {
      const clash = collectionBySlug(input.slug);
      if (clash && clash.id !== collection.id) throw fail('collection_slug_taken');
    }

    Object.assign(collection, input);
    return serializeCollection(collection);
  },
  { auth: ['staff', 'admin'] },
);

/**
 * 204. Nothing protects a collection: the `Product.collections` M2M is not
 * modelled here (no schema reads it, no screen renders it — see `types.ts`), and
 * upstream it would cascade its through-rows away anyway.
 */
register(
  'DELETE',
  '/admin/collections/:id',
  (request): undefined => {
    const collection = collectionById(Number(request.path.id));
    if (!collection) throw notFound();
    store.collections.splice(store.collections.indexOf(collection), 1);
    return undefined;
  },
  { auth: ['staff', 'admin'] },
);

// --------------------------------------------------------------------------- //
//  Zodiac — edit-only, keyed by sign
//
//  There is no create and no delete: the twelve signs are a fixed vocabulary, so
//  `ZodiacInfoIn` omits `sign`, `symbol` and `stones` as "effectively constants"
//  and the console renders `stones` as read-only badges. A `POST` or a `DELETE`
//  here is a 405 from the router, which is what the Ninja URLconf gives.
// --------------------------------------------------------------------------- //

/**
 * Keyed by `sign`, the slug — `get_object_or_404(ZodiacInfo, sign=sign)` — which
 * is why the capture is `:sign` and not `:id`: `ZodiacInfoOut` carries no `id`
 * key at all, so the row's primary key is invisible to every caller and the
 * numeric guard would reject the only value anyone can send.
 */
register(
  'GET',
  '/admin/zodiac',
  (): ZodiacInfoOut[] => orderedZodiac().map(serializeZodiac),
  { auth: ['staff', 'admin'] },
);

register(
  'GET',
  '/admin/zodiac/:sign',
  (request): ZodiacInfoOut => {
    const zodiac = zodiacBySign(request.path.sign);
    if (!zodiac) throw notFound();
    return serializeZodiac(zodiac);
  },
  { auth: ['staff', 'admin'] },
);

/**
 * Eight editable fields, full replace over those eight alone. `sign`, `symbol`
 * and `stones` are untouched because the schema never declared them, so a body
 * that carries a new `symbol` gets a 200 and the old glyph back — Pydantic drops
 * what it was not asked about rather than complaining.
 */
register(
  'PATCH',
  '/admin/zodiac/:sign',
  (request): ZodiacInfoOut => {
    // 422 before 404 — see the note on `PATCH /admin/products/:id`.
    const body = bodyOf(request);
    const input = {
      name: readString(body, 'name', { required: true }),
      name_ka: readString(body, 'nameKa'),
      dates: readString(body, 'dates', { required: true }),
      dates_ka: readString(body, 'datesKa'),
      element: readString(body, 'element', { required: true }),
      element_ka: readString(body, 'elementKa'),
      description: readString(body, 'description'),
      description_ka: readString(body, 'descriptionKa'),
    };

    const zodiac = zodiacBySign(request.path.sign);
    if (!zodiac) throw notFound();

    Object.assign(zodiac, input);
    return serializeZodiac(zodiac);
  },
  { auth: ['staff', 'admin'] },
);
