/**
 * The console's plumbing: the dashboard, the site-settings singleton, the
 * per-path SEO overrides, the quiz document and the audit feed. Eleven routes,
 * three upstream modules — `accounts/dashboard_api.py`, `site_settings/api.py`,
 * `quiz/api.py` and `audit/admin_api.py` — all four of them `staff_auth`, listed
 * in `../routes.md` §9.
 *
 * They are one module because they are one screen group and because each of them
 * is too small to be worth its own file, not because they share a shape: two are
 * singletons edited whole, one is a small CRUD table, one is a read-only feed and
 * one is seven aggregates.
 *
 * ## Four things that are load-bearing
 *
 * 1. **`PATCH /admin/site-settings` is a full replace *with defaults*.** An
 *    omitted key does not keep its old value; it takes `SiteSettingsIn`'s
 *    default. `heroCtaLink` resets to `"/shop"` and `defaultRobots` to
 *    `"index,follow"` — neither of which is empty, so a caller sending a partial
 *    body gets two fields *changed* rather than blanked. `SiteSettingsPage`
 *    always sends all seventeen, which is why nobody upstream has noticed; the
 *    lib types the input `Partial<SiteSettingsInput>`, which is a lie the port
 *    must not repeat.
 *
 * 2. **The quiz 422s an item with an empty `id`.** `Field(min_length=1)`, and the
 *    editor's "Add item" button creates exactly that: a blank row. Press Add,
 *    press Save, and the real backend refuses — which surfaces as
 *    `Request failed (422)`, because a Pydantic error body is an *array* and
 *    `api.ts` reads `detail` only when it is a string. Reproduced whole,
 *    including the unhelpful message.
 *
 * 3. **`GET /admin/audit` requires both of its parameters.** `target_type: str`
 *    and `target_id: int` have no defaults, so a request missing either is a 422
 *    before the query runs. There is no global activity endpoint: the feed is
 *    always about one record, which is why `ActivityFeed` takes a target and why
 *    nothing renders a shop-wide timeline.
 *
 * 4. **No audit rows from anything in this file.** `record_action` is imported by
 *    `orders/admin_api.py` and `accounts/admin_api.py` and by nothing else, so
 *    site settings, page SEO and the quiz are edited without a trace. That is
 *    worth seeing next to the order screen, which records everything.
 */

import {
  bodyOf,
  fail,
  notFound,
  nowIso,
  readBoolean,
  readString,
  readStringArray,
  validationError,
} from '../base';
import { asInt } from '../query';
import { register } from '../router';
import type { DemoRequest } from '../router';
import {
  dashboardStats,
  serializeAuditRow,
  serializePageSeo,
  serializeQuizConfig,
  serializeSiteSettings,
} from '../serialize';
import type {
  AdminActionOut,
  DashboardStatsOut,
  PageSeoOut,
  QuizConfigOut,
  SiteSettingsOut,
} from '../serialize';
import { nextId, orderedAuditFor, orderedPageSeo, pageSeoById, store } from '../store';
import { PURPOSES } from '../types';
import type {
  AuditTargetType,
  PageSeoRow,
  Purpose,
  QuizBudgetRow,
  QuizIntentionRow,
  QuizMoodRow,
  QuizOccasionRow,
} from '../types';

// --------------------------------------------------------------------------- //
//  GET /admin/dashboard/stats
// --------------------------------------------------------------------------- //

/**
 * One call, seven aggregates, no parameters — and exactly the payload
 * `AdminDashboardPage` renders, which is a stricter contract than the schema
 * looks. The page has no react-query around it: a plain `useEffect` sets `data`
 * or leaves it `null`, and every tile then reads `—`. A missing key is not a
 * blank tile, it is `NaN` inside `formatMoneyGEL(Number(undefined))`.
 *
 * The whole computation lives in `serialize.ts::dashboardStats()` and is called
 * from here alone. It is one function on purpose: the temptation to recompute a
 * tile inline somewhere else is what makes two numbers on one screen disagree.
 *
 * Three of its counts are narrower than they read, and all three are upstream's —
 * `activeDiscountCount` ignores expiry and exhaustion, `totalRevenue` sums only
 * paid + shipped + delivered, and `ordersByStatus` always carries all five
 * buckets zero-filled in `OrderStatus` declaration order because the panel
 * renders one row per element.
 */
register('GET', '/admin/dashboard/stats', (): DashboardStatsOut => dashboardStats(), {
  auth: ['staff', 'admin'],
});

// --------------------------------------------------------------------------- //
//  Site settings — the singleton
// --------------------------------------------------------------------------- //

/**
 * Byte-for-byte the public `/site-settings` payload, at a different auth level.
 * Upstream that is literally the same `_serialize` called from two routers, and
 * it has to stay that way: the admin form loads from here and the storefront
 * reads from there, so a divergence would make the preview lie about the shop.
 */
register(
  'GET',
  '/admin/site-settings',
  (): SiteSettingsOut => serializeSiteSettings(store.site_settings),
  { auth: ['staff', 'admin'] },
);

/**
 * **Full replace with defaults.** See the module note — `heroCtaLink` and
 * `defaultRobots` are the two fields whose default is not the empty string, so
 * they are the two a partial body silently rewrites rather than clears.
 *
 * `updated_at` is `auto_now`, so `obj.save()` moves it. Nothing on this screen
 * reads it, but `SiteSettingsOut` ships it and a frozen timestamp on a row that
 * demonstrably just changed is the kind of detail that makes a mock feel like a
 * mock.
 *
 * The singleton is assigned **into**, never replaced: `resetStore()` does
 * `Object.assign` on this same object so that a handler holding a reference keeps
 * a live one, and swapping it for a fresh literal here would quietly detach the
 * store from itself.
 */
register(
  'PATCH',
  '/admin/site-settings',
  (request): SiteSettingsOut => {
    const body = bodyOf(request);
    const settings = store.site_settings;

    settings.hero_title_en = readString(body, 'heroTitleEn');
    settings.hero_title_ka = readString(body, 'heroTitleKa');
    settings.hero_subtitle_en = readString(body, 'heroSubtitleEn');
    settings.hero_subtitle_ka = readString(body, 'heroSubtitleKa');
    settings.hero_image = readString(body, 'heroImage');
    settings.hero_cta_label_en = readString(body, 'heroCtaLabelEn');
    settings.hero_cta_label_ka = readString(body, 'heroCtaLabelKa');
    settings.hero_cta_link = readString(body, 'heroCtaLink', { fallback: '/shop' });
    settings.banner_text_en = readString(body, 'bannerTextEn');
    settings.banner_text_ka = readString(body, 'bannerTextKa');
    settings.banner_link = readString(body, 'bannerLink');
    settings.banner_active = readBoolean(body, 'bannerActive');
    settings.featured_collection_slugs = readStringArray(body, 'featuredCollectionSlugs');
    settings.site_name = readString(body, 'siteName');
    settings.default_og_image = readString(body, 'defaultOgImage');
    settings.twitter_handle = readString(body, 'twitterHandle');
    settings.default_robots = readString(body, 'defaultRobots', { fallback: 'index,follow' });
    settings.updated_at = nowIso();

    return serializeSiteSettings(settings);
  },
  { auth: ['staff', 'admin'] },
);

// --------------------------------------------------------------------------- //
//  Page SEO
// --------------------------------------------------------------------------- //

/** `PageSeoIn` — `path` required, the other six default to `""`. */
function readPageSeoInput(request: DemoRequest): Omit<PageSeoRow, 'id' | 'created_at' | 'updated_at'> {
  const body = bodyOf(request);
  return {
    path: readString(body, 'path', { required: true }),
    title_en: readString(body, 'titleEn'),
    title_ka: readString(body, 'titleKa'),
    description_en: readString(body, 'descriptionEn'),
    description_ka: readString(body, 'descriptionKa'),
    og_image: readString(body, 'ogImage'),
    robots: readString(body, 'robots'),
  };
}

/**
 * `PageSeo.objects.filter(path=…)` — a plain `=`, **not** `__iexact`. `/Shop` and
 * `/shop` are two different overrides, and only one of them will ever match:
 * `Seo.tsx` compares `path === location.pathname`, and react-router hands back the
 * casing the route was declared with. The model's constraint is reproduced as it
 * stands rather than tightened.
 */
function pageSeoByPath(path: string): PageSeoRow | undefined {
  return store.page_seo.find((row) => row.path === path);
}

/**
 * A **bare array**, path ascending — the same payload the public
 * `/site-settings/page-seo` sends. `PageSeoListPage` searches it client-side with
 * a `useMemo` over `path`, `titleEn` and `titleKa`, so there is no `q` parameter
 * here to honour and adding one would be inventing a route.
 */
register('GET', '/admin/page-seo', (): PageSeoOut[] => orderedPageSeo().map(serializePageSeo), {
  auth: ['staff', 'admin'],
});

/** 201. `created_at` is `auto_now_add` and `updated_at` is `auto_now`, so both are stamped now. */
register(
  'POST',
  '/admin/page-seo',
  (request): PageSeoOut => {
    const input = readPageSeoInput(request);
    if (pageSeoByPath(input.path)) throw fail('page_seo_path_taken');

    const stamp = nowIso();
    const page: PageSeoRow = {
      id: nextId('page_seo'),
      ...input,
      created_at: stamp,
      updated_at: stamp,
    };
    store.page_seo.push(page);
    return serializePageSeo(page);
  },
  { auth: ['staff', 'admin'] },
);

register(
  'GET',
  '/admin/page-seo/:id',
  (request): PageSeoOut => {
    const page = pageSeoById(Number(request.path.id));
    if (!page) throw notFound();
    return serializePageSeo(page);
  },
  { auth: ['staff', 'admin'] },
);

/**
 * Full replace, and — as with collections — the duplicate check fires only when
 * the path actually moves (`payload.path != obj.path and …exclude(pk=obj.pk)`),
 * so re-saving an override without touching its path never collides with itself.
 */
register(
  'PATCH',
  '/admin/page-seo/:id',
  (request): PageSeoOut => {
    // 422 before 404: Ninja validates the payload before the view runs, so a
    // malformed body on a missing id is a 422 and not a 404.
    const input = readPageSeoInput(request);

    const page = pageSeoById(Number(request.path.id));
    if (!page) throw notFound();

    if (input.path !== page.path) {
      const clash = pageSeoByPath(input.path);
      if (clash && clash.id !== page.id) throw fail('page_seo_path_taken');
    }

    Object.assign(page, input);
    page.updated_at = nowIso();
    return serializePageSeo(page);
  },
  { auth: ['staff', 'admin'] },
);

/** 204, empty body. Nothing references a `PageSeo` row — the lookup is by path, at render time. */
register(
  'DELETE',
  '/admin/page-seo/:id',
  (request): undefined => {
    const page = pageSeoById(Number(request.path.id));
    if (!page) throw notFound();
    store.page_seo.splice(store.page_seo.indexOf(page), 1);
    return undefined;
  },
  { auth: ['staff', 'admin'] },
);

// --------------------------------------------------------------------------- //
//  Quiz config — the second singleton
//
//  `QuizConfigPage` is not a react-hook-form screen: it holds one `QuizConfig`
//  object in state, edits it in place and PATCHes the whole thing. So this route
//  is a whole-document replace by construction, and every field's default matters
//  because the editor can produce a half-filled item.
// --------------------------------------------------------------------------- //

/**
 * `Decimal`, rendered the way `str(Decimal(...))` renders it — which is **not**
 * `toFixed(2)`, and is why this does not use `base.ts::readDecimal`.
 *
 * `budgets[].min` and `.max` are JSONB text that never meets a `DecimalField`, so
 * they round-trip as authored: a seeded `"0"` comes back `"0"`, and `"40.50"`
 * keeps its trailing zero. Quantising them to two places here would make every
 * budget label's underlying number change shape on the first save, and
 * `budgetRange()` runs `Number()` over them so nothing would complain.
 *
 * Canonicalisation is Decimal's own: a leading `+` and redundant leading zeros go
 * (`007` → `7`), an absent integer part becomes `0` (`.5` → `0.5`), a trailing
 * `.` is dropped (`40.` → `40`), and the fraction is preserved exactly.
 * Scientific notation is rejected rather than reproduced — an `inputMode="decimal"`
 * field cannot produce it and `str(Decimal("1E+2"))` keeps the exponent, which
 * would be a stranger thing to emit than a 422.
 */
function decimalText(raw: unknown, key: string): string {
  const text = typeof raw === 'number' ? String(raw) : typeof raw === 'string' ? raw.trim() : '';
  const match = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(text);
  const whole = match?.[2] ?? '';
  const fraction = match?.[3] ?? '';
  if (!match || (whole === '' && fraction === '')) {
    throw validationError(['body', key], 'Input should be a valid decimal', 'decimal_parsing');
  }
  const sign = match[1] === '-' ? '-' : '';
  const integer = whole.replace(/^0+(?=\d)/, '') || '0';
  return `${sign}${integer}${fraction ? `.${fraction}` : ''}`;
}

/** `min: Decimal = Decimal("0")` — absent takes the default, `''` is a 422. */
function readBudgetMin(item: Record<string, unknown>): string {
  return item.min === undefined ? '0' : decimalText(item.min, 'min');
}

/**
 * `max: Decimal | None = None`. Absent **and** an explicit `null` both mean "no
 * upper bound", which `budgetRange()` reads back as `Infinity` — the editor sends
 * the `null` (`e.target.value === '' ? null : …`) and a script would omit the key.
 */
function readBudgetMax(item: Record<string, unknown>): string | null {
  if (item.max === undefined || item.max === null) return null;
  return decimalText(item.max, 'max');
}

/**
 * `list[PurposeLiteral] = []`, with the offending index in the `loc` the way
 * Pydantic reports it. A second copy of this shape lives in `admin-catalog.ts`;
 * handler modules export nothing, so each carries the readers it needs.
 */
function readPurposes(item: Record<string, unknown>): Purpose[] {
  return readStringArray(item, 'purposes').map((value, index) => {
    if (!(PURPOSES as readonly string[]).includes(value)) {
      throw validationError(
        ['body', 'purposes', String(index)],
        `Input should be ${PURPOSES.map((entry) => `'${entry}'`).join(' or ')}`,
        'literal_error',
      );
    }
    return value as Purpose;
  });
}

/**
 * All four lists are **required** on `QuizConfigIn` — no defaults — so a body
 * carrying three of them is a 422 and not a wipe of the fourth.
 *
 * Each element is read through `bodyOf`, which answers `{}` for anything that is
 * not a plain object; the required `id` then fails, which is the same 422 a
 * non-dict element would earn from Pydantic even though the code differs.
 */
function readItems<T>(
  body: Record<string, unknown>,
  key: string,
  read: (item: Record<string, unknown>) => T,
): T[] {
  if (!(key in body) || body[key] === undefined) {
    throw validationError(['body', key], 'Field required', 'missing');
  }
  const raw = body[key];
  if (!Array.isArray(raw)) {
    throw validationError(['body', key], 'Input should be a valid list', 'list_type');
  }
  return raw.map((entry) => read(bodyOf({ body: entry })));
}

/**
 * `id` is `Field(min_length=1, max_length=64)`, and the empty string is the whole
 * point: "Add item" seeds a blank row and saving it must fail. See the module
 * note.
 */
function readQuizId(item: Record<string, unknown>): string {
  return readString(item, 'id', { required: true, min: 1, max: 64 });
}

register('GET', '/admin/quiz-config', (): QuizConfigOut => serializeQuizConfig(store.quiz_config), {
  auth: ['staff', 'admin'],
});

/**
 * The four item shapes are built key by key in **schema declaration order**,
 * because `serializeQuizConfig` spreads these objects and their insertion order
 * therefore *is* the order of the wire — a saved document must come back looking
 * like the one the seed authored.
 */
register(
  'PATCH',
  '/admin/quiz-config',
  (request): QuizConfigOut => {
    const body = bodyOf(request);
    const config = store.quiz_config;

    const moods = readItems<QuizMoodRow>(body, 'moods', (item) => ({
      id: readQuizId(item),
      icon: readString(item, 'icon', { max: 8 }),
      labelEn: readString(item, 'labelEn', { max: 128 }),
      labelKa: readString(item, 'labelKa', { max: 128 }),
      purposes: readPurposes(item),
    }));
    const occasions = readItems<QuizOccasionRow>(body, 'occasions', (item) => ({
      id: readQuizId(item),
      icon: readString(item, 'icon', { max: 8 }),
      labelEn: readString(item, 'labelEn', { max: 128 }),
      labelKa: readString(item, 'labelKa', { max: 128 }),
      hintEn: readString(item, 'hintEn', { max: 255 }),
      hintKa: readString(item, 'hintKa', { max: 255 }),
    }));
    const intentions = readItems<QuizIntentionRow>(body, 'intentions', (item) => ({
      id: readQuizId(item),
      icon: readString(item, 'icon', { max: 8 }),
      labelEn: readString(item, 'labelEn', { max: 128 }),
      labelKa: readString(item, 'labelKa', { max: 128 }),
      hintEn: readString(item, 'hintEn', { max: 255 }),
      hintKa: readString(item, 'hintKa', { max: 255 }),
      purposes: readPurposes(item),
    }));
    const budgets = readItems<QuizBudgetRow>(body, 'budgets', (item) => ({
      id: readQuizId(item),
      icon: readString(item, 'icon', { max: 8 }),
      labelEn: readString(item, 'labelEn', { max: 128 }),
      labelKa: readString(item, 'labelKa', { max: 128 }),
      min: readBudgetMin(item),
      max: readBudgetMax(item),
    }));

    // All four are assigned only after all four have validated, so a 422 on
    // `budgets` cannot leave `moods` half-written. Upstream gets that for free
    // from Pydantic validating the whole model before the view runs.
    config.moods = moods;
    config.occasions = occasions;
    config.intentions = intentions;
    config.budgets = budgets;
    config.updated_at = nowIso();

    return serializeQuizConfig(config);
  },
  { auth: ['staff', 'admin'] },
);

// --------------------------------------------------------------------------- //
//  GET /admin/audit
// --------------------------------------------------------------------------- //

/**
 * `audit-api.ts` types `targetType` as four values; `record()` only ever writes
 * two. A `product` or `discount` query is therefore a perfectly legal request
 * that answers `[]` — upstream's parameter is a bare `str` with no `Literal` in
 * front of it, so it filters on a value no row holds rather than refusing.
 */
const AUDIT_TARGET_TYPES: readonly AuditTargetType[] = ['order', 'user'];

/**
 * Both parameters are **required** — `target_type: str, target_id: int`, neither
 * with a default — so a missing one is Ninja's 422, which the app renders as the
 * uninformative `Request failed (422)`. `ActivityFeed` swallows every failure
 * with `.catch(() => setItems([]))`, so getting this wrong shows up as a feed
 * that is permanently empty and never as an error.
 *
 * `limit` is different: it has a default, and a malformed value here falls back
 * to it rather than 422-ing. That is `query.ts`'s stated divergence — Ninja would
 * answer 422 to `?limit=abc`, nothing in the app can produce one, and a
 * hand-typed URL that quietly uses the default is friendlier than one that
 * errors. The clamp is upstream's: `max(1, min(200, limit))`, and the console
 * sends 30.
 *
 * Newest first, `-id` breaking ties — a bulk click writes several rows inside one
 * millisecond, and without the tiebreak the feed would reshuffle itself on every
 * refetch.
 */
register(
  'GET',
  '/admin/audit',
  (request): AdminActionOut[] => {
    const targetType = request.params.target_type;
    if (targetType === undefined) {
      throw validationError(['query', 'target_type'], 'Field required', 'missing');
    }

    const rawTargetId = request.params.target_id;
    if (rawTargetId === undefined) {
      throw validationError(['query', 'target_id'], 'Field required', 'missing');
    }
    if (!/^-?\d+$/.test(rawTargetId.trim())) {
      throw validationError(
        ['query', 'target_id'],
        'Input should be a valid integer, unable to parse string as an integer',
        'int_parsing',
      );
    }
    const targetId = Number(rawTargetId.trim());

    const limit = Math.max(1, Math.min(200, asInt(request.params.limit) ?? 50));

    if (!AUDIT_TARGET_TYPES.includes(targetType as AuditTargetType)) return [];
    return orderedAuditFor(targetType as AuditTargetType, targetId)
      .slice(0, limit)
      .map(serializeAuditRow);
  },
  { auth: ['staff', 'admin'] },
);
