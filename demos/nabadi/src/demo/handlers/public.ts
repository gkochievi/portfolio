/**
 * The customer site's whole read API: `GET /services/` and `GET /landing/`.
 *
 * Two routes, both `AllowAny` — upstream sets `authentication_classes = []` on
 * each, so a stale session cookie is ignored rather than answered with a 401.
 * `auth: 'public'` is the same thing here: the gate never looks at the session,
 * and `request.user` may be a signed-in row or `null` without either handler
 * caring.
 *
 * Everything structurally interesting about `/services/` — the two-level
 * nesting, the `?barber_id=` narrowing, the override substitution and the
 * drop-empty-category rule — lives in `serializeCatalog` (`schema.md` §8), so
 * this module is one line for it and the rest for `/landing/`, which is not
 * tricky but is wide: twelve top-level keys drawn from the CMS singleton and
 * four separate `site_settings` rows.
 *
 * See `../routes.md` §2 for the rows this module owns.
 */

import { asId, newestFirst } from '../query';
import { register } from '../router';
import type { ReviewOut } from '../serialize';
import { mediaUrl, serializeCatalog, serializeReview } from '../serialize';
import { bookingById, getSetting, store } from '../store';

/**
 * `{categories: [{…, services: [...]}]}` — a wrapped object, neither a bare
 * array nor a DRF envelope. `useServices()` types the reply
 * `{categories: ServiceCategory[]}` and reads `category.services`; either other
 * shape renders an empty service picker with no error anywhere.
 *
 * `asId` treats a non-numeric `?barber_id=` as absent, which is `query.ts`'s
 * standing rule for a malformed relation value. Upstream calls bare `int()` in
 * the view and answers `?barber_id=abc` with a 500 (`api-public.md` §4.1) — a
 * real bug in a branch the wizard cannot reach, since the only call site
 * appends the param from a picked barber's id and omits it entirely when that
 * is falsy. Reproducing the crash would only make a hand-typed URL fail
 * mysteriously.
 */
register('GET', '/services/', (request) => serializeCatalog(asId(request.params.barber_id) ?? undefined), {
  auth: 'public',
});

/**
 * Every string in the landing payload passes through here.
 *
 * The columns are `CharField`s and the settings are free JSON, but the client
 * treats all of them as strings and calls `.trim()` unguarded — `phone`,
 * `email`, both address halves and every `social_links` value, in
 * `useBusinessInfo()`. A setting hand-edited to a number would therefore be a
 * `TypeError` in the footer rather than a missing row, so a non-string reads as
 * "unset", which is the value the whole payload already uses for absent.
 */
function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** `get_setting(key) or ""`. */
function settingString(key: string): string {
  return text(getSetting(key));
}

/** The setting's value when it is a JSON object, else `{}` — `isinstance(value, dict)`. */
function settingObject(key: string): Record<string, unknown> {
  const value = getSetting(key);
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

interface LandingBusinessOut {
  address: { ka: string; en: string };
  phone: string;
  email: string;
}

/**
 * `business` is always present with all three keys — a backend test pins the
 * shape — and the address is **rebuilt** rather than passed through, so a
 * `business_address` row carrying extra keys ships exactly `{ka, en}`.
 *
 * That is not a conflict with the console, which merges over the stored dict
 * "so any extra keys another surface may have stored survive the save": they do
 * survive, in `site_settings`. They just never reach the public payload.
 */
function business(): LandingBusinessOut {
  const address = settingObject('business_address');
  return {
    address: { ka: text(address.ka), en: text(address.en) },
    phone: settingString('business_phone'),
    email: settingString('business_email'),
  };
}

/**
 * The whole `social_links` map, not just the two networks the footer renders —
 * it is passed through untouched upstream, and a network the CMS adds later
 * should arrive without a backend change.
 */
function socialLinks(): Record<string, string> {
  const links: Record<string, string> = {};
  for (const [network, url] of Object.entries(settingObject('social_links'))) {
    links[network] = text(url);
  }
  return links;
}

/**
 * The singleton's `featured_reviews`, published only, **newest first**.
 *
 * `obj.featured_reviews.filter(is_published=True).order_by("-created_at")` —
 * the M2M is a set and the queryset imposes its own ordering, so the order the
 * CMS put the ids in does not survive the round trip. The landing page shows
 * the most recent praise first however the picker happened to be filled in, and
 * `PATCH /admin/landing/` can reorder the ids all it likes without moving a
 * card. (`routes.md` §2 used to claim the stored order was kept; the table was
 * wrong and has been corrected against `spec/api-public.md` §5.1.4.)
 *
 * The published filter is defence in depth: featuring a review and later
 * unpublishing it makes it disappear from the payload without anyone having to
 * remember to unfeature it too.
 *
 * `serializeReview` is the PII-reduced public shape — `"Davit B."`, `""` for a
 * walk-in, never `walk_in_name`. There is no server-side cap, and no longer a
 * client-side one either: the landing band that sliced this to six is gone, so
 * the field ships for the console's picker and nothing on the site reads it.
 */
function featuredReviews(): ReviewOut[] {
  const featured = store.reviews.filter(
    (row) => row.is_published && store.landing_content.featured_reviews.includes(row.id),
  );
  // `newestFirst` is `query.ts`'s `-created_at`, the same comparator
  // `GET /admin/reviews/` orders by, and `Array.prototype.sort` is stable — so
  // two reviews stamped in the same second keep the store's own (id) order
  // rather than swapping between two reads of the same payload.
  return newestFirst(featured, (row) => row.created_at).map((review) =>
    serializeReview(review, bookingById(review.booking_id)),
  );
}

/** `PublicLandingSerializer` — 12 keys, in the serializer's order. */
interface LandingOut {
  hero_heading_ka: string;
  hero_heading_en: string;
  hero_subheading_ka: string;
  hero_subheading_en: string;
  hero_image_url: string;
  about_text_ka: string;
  about_text_en: string;
  gallery_image_urls: string[];
  featured_reviews: ReviewOut[];
  business: LandingBusinessOut;
  social_links: Record<string, string>;
  map_embed_url: string;
}

/**
 * The landing singleton flattened with the three CMS-sourced blocks. No query
 * params: upstream's `LandingView` ignores every one.
 *
 * `id`, `updated_at` and `featured_review_ids` are deliberately absent — those
 * belong to the admin serializer, which `admin-ops` owns.
 *
 * The images are media keys in the store and URLs on the wire. Both front ends
 * drop `hero_image_url` and each gallery entry straight into an `<img src>`,
 * and `mediaUrl` is what turns `landing/hero.svg` into something a browser can
 * load; it passes an already-absolute value through, so a CMS edit that types a
 * full URL into the field still works. An unset image is `""`, not `null` —
 * every consumer tests `|| null` and falls back to `ImageFallback`.
 *
 * Read at call time, never hoisted: `site_settings` is editable from the
 * console in the same tab, so the settings page and this payload must agree
 * without a reload.
 */
register(
  'GET',
  '/landing/',
  (): LandingOut => {
    const content = store.landing_content;
    return {
      hero_heading_ka: content.hero_heading_ka,
      hero_heading_en: content.hero_heading_en,
      hero_subheading_ka: content.hero_subheading_ka,
      hero_subheading_en: content.hero_subheading_en,
      hero_image_url: mediaUrl(content.hero_image_url) ?? '',
      about_text_ka: content.about_text_ka,
      about_text_en: content.about_text_en,
      gallery_image_urls: content.gallery_image_urls
        .map((key) => mediaUrl(key))
        .filter((url): url is string => url !== null),
      featured_reviews: featuredReviews(),
      business: business(),
      social_links: socialLinks(),
      map_embed_url: settingString('map_embed_url'),
    };
  },
  { auth: 'public' },
);
