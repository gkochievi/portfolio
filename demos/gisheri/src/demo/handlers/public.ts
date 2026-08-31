/**
 * The storefront's whole read API: seven `GET`s, none of them authenticated, none
 * of them paginated, none of them filtered.
 *
 * Upstream these live in three routers — `catalog/api.py`, `site_settings/api.py`
 * and `quiz/api.py` — mounted without an `auth=` kwarg, so a stale or missing
 * bearer token is ignored rather than answered with a 401. `auth: 'public'` is
 * the same thing: the gate never refuses, and `request.user` may be a signed-in
 * row or `null` without any handler here caring.
 *
 * **Three of these fire on every single route in the app.** `<Seo>` is mounted by
 * every page, and it reads `useSiteSettings()` and `useAllPageSeo()`; the shop,
 * the quiz, the product page and the zodiac page all read `useProducts()`. A 4xx
 * from any of them is not a broken page, it is a broken *site* — react-query
 * caches the rejection and the title, the meta description and the whole catalogue
 * go missing at once. So none of the four list routes has a failure path at all,
 * and the two singletons cannot have one: `SiteSettings.load()` and
 * `QuizConfig.load()` are `get_or_create(pk=1)` upstream and a non-nullable row in
 * the store here.
 *
 * Ordering is the other half of the contract, and it is load-bearing in two
 * places. `/products` is `Meta.ordering = ["id"]`, which the quiz's scoring pass
 * relies on for its tie-break — two bracelets on the same score come back in the
 * order the shop created them, and shuffling that would make the quiz's answer
 * change between reloads. `/zodiac` is `Meta.ordering = ["sign"]`, an
 * **alphabetical** sort of the sign strings and emphatically not the zodiacal
 * one, so the list opens on Aquarius rather than Aries.
 *
 * `GET /collections/{slug}` and `GET /zodiac/{sign}` exist upstream and are
 * deliberately **not** registered: both pages fetch the whole list and find their
 * row locally, so registering them would put a route in `../routes.md` that
 * nothing calls. See §E.11.
 */

import { register } from '../router';
import type {
  CollectionOut,
  PageSeoOut,
  ProductOut,
  QuizConfigOut,
  SiteSettingsOut,
  ZodiacInfoOut,
} from '../serialize';
import {
  serializeCollection,
  serializePageSeo,
  serializeProduct,
  serializeQuizConfig,
  serializeSiteSettings,
  serializeZodiac,
} from '../serialize';
import { notFound } from '../base';
import {
  orderedCollections,
  orderedPageSeo,
  orderedProducts,
  orderedZodiac,
  productById,
  store,
} from '../store';

// --------------------------------------------------------------------------- //
//  Catalogue
// --------------------------------------------------------------------------- //

/**
 * A **bare array**, not a page envelope. `catalogApi.listProducts` types the reply
 * `ApiProduct[]` and calls `.map()` on it unguarded, so an `{items, total}` here
 * would be a `TypeError` on the shop page rather than an empty grid.
 *
 * Thirty rows, unpaginated and unfiltered — the view is `Product.objects.all()`
 * with no query parameters at all. Every filter the shop offers (purpose, gender,
 * price band, search) runs client-side over this one cached array; the paginated,
 * filterable list is `/admin/products`, which is a different route with a
 * different envelope.
 */
register('GET', '/products', (): ProductOut[] => orderedProducts().map(serializeProduct), {
  auth: 'public',
});

/**
 * `get_object_or_404(Product, pk=product_id)`.
 *
 * The id arrives as the raw string `useParams()` gave the page — `'4007'` — which
 * the `<int:…>` capture accepts and `/product/not-a-number` never reaches: the
 * router 404s it before this runs, exactly as Django's URLconf would.
 */
register(
  'GET',
  '/products/:id',
  (request): ProductOut => {
    const product = productById(Number(request.path.id));
    if (!product) throw notFound();
    return serializeProduct(product);
  },
  { auth: 'public' },
);

/**
 * Six rows, one per `Purpose`, **name ascending** — `Meta.ordering = ["name"]` on
 * the English column, so the Georgian UI shows them in English alphabetical order
 * too. A bare array again, for the same reason `/products` is one.
 */
register('GET', '/collections', (): CollectionOut[] => orderedCollections().map(serializeCollection), {
  auth: 'public',
});

/**
 * Twelve rows, **alphabetical by sign**. `ZodiacInfoOut` carries no `id` at all —
 * `sign` is the public key, and it is what `/admin/zodiac/{sign}` addresses a row
 * by as well.
 */
register('GET', '/zodiac', (): ZodiacInfoOut[] => orderedZodiac().map(serializeZodiac), {
  auth: 'public',
});

// --------------------------------------------------------------------------- //
//  Site settings and SEO
// --------------------------------------------------------------------------- //

/**
 * The singleton, read fresh on every call rather than hoisted: the admin settings
 * page edits it in this same tab, and after an invalidation this payload has to
 * agree with the form without a reload.
 *
 * No `id` on the wire — `_serialize` lists eighteen fields by hand and that is not
 * one of them. `heroImage` and `defaultOgImage` are minted into URLs by
 * `mediaUrl()`; see the note on `serializeSiteSettings` for why that diverges from
 * upstream's raw passthrough.
 */
register('GET', '/site-settings', (): SiteSettingsOut => serializeSiteSettings(store.site_settings), {
  auth: 'public',
});

/**
 * Every per-path override in one array, **path ascending**, because the client
 * caches the lot and looks up by `location.pathname` locally — `Seo.tsx` does
 * `pageSeoList.find((p) => p.path === location.pathname)`.
 *
 * Those paths are stored **unprefixed** (`/shop`, not `/demos/gisheri/shop`):
 * React Router strips the basename before it publishes `useLocation().pathname`,
 * so a prefixed seed would match nothing and every override would silently do
 * nothing at all.
 */
register(
  'GET',
  '/site-settings/page-seo',
  (): PageSeoOut[] => orderedPageSeo().map(serializePageSeo),
  { auth: 'public' },
);

// --------------------------------------------------------------------------- //
//  Quiz
// --------------------------------------------------------------------------- //

/**
 * `{moods, occasions, intentions, budgets}` — four arrays and nothing else. The
 * singleton's `id` and `updatedAt` are dropped by `_serialize` upstream and by
 * `serializeQuizConfig` here, which matters because the admin editor round-trips
 * this exact document back through `PATCH /admin/quiz-config`: a key that arrives
 * and is not sent back would be lost on the first save.
 *
 * The nested elements are already camelCase in the store, because that is how
 * `seed_catalog` wrote them into the JSONB column and `CamelSchema` passes JSON
 * values through untouched. It is the one place in this API where the stored keys
 * are the wire's keys.
 */
register('GET', '/quiz-config', (): QuizConfigOut => serializeQuizConfig(store.quiz_config), {
  auth: 'public',
});
