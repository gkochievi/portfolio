import Fuse from "fuse.js";
import i18n from "@/i18n";

import {
  type Collection,
  type Product,
  type ZodiacInfo,
  purposeInfo,
} from "@/data/products";
import {
  tCollectionDescription,
  tCollectionName,
  tProductDescription,
  tProductName,
  tProductStonesMeaning,
  tPurposeName,
  tStone,
  tZodiacInfo,
} from "@/lib/catalog-i18n";
import { formatMoneyGEL } from "@/lib/money";

export type SearchItemType = "product" | "collection" | "zodiac" | "page";

export type SearchResult = {
  id: string;
  type: SearchItemType;
  title: string;
  subtitle?: string;
  href: string;
  score: number; // lower is better
};

type SearchDoc = {
  id: string;
  type: SearchItemType;
  title: string;
  subtitle?: string;
  href: string;
  keywords: string;
};

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * `buildDocs()` lived here: a first-pass, English-only index that read three
 * module-level catalogue arrays and a SYNONYMS table. Both are gone.
 *
 * It was already dead — `searchSite` builds its own bilingual docs inline, and
 * nothing else imported it — and it was not merely unused but uncompilable,
 * referencing `products`, `collections` and `zodiacData` as free identifiers
 * left over from the static-catalogue era. It shipped only because upstream's
 * build never type-checks. This workspace does, so it goes.
 */

export interface CatalogData {
  products: Product[];
  collections: Collection[];
  zodiacData: ZodiacInfo[];
}

let fuseCache: { lang: string; signature: string; fuse: Fuse<SearchDoc>; docs: SearchDoc[] } | null = null;

const catalogSignature = (data: CatalogData) =>
  `${data.products.length}:${data.collections.length}:${data.zodiacData.length}`;

function boostScore(query: string, title: string, score: number) {
  const q = normalizeText(query);
  const t = normalizeText(title);

  // Small boost for strong signals.
  if (t === q) return Math.max(0, score - 0.2);
  if (t.startsWith(q)) return Math.max(0, score - 0.08);
  if (t.includes(` ${q}`)) return Math.max(0, score - 0.04);
  return score;
}

export function searchSite(
  query: string,
  catalog: CatalogData,
  limit = 12,
): SearchResult[] {
  const q = normalizeText(query);
  if (!q) return [];

  const { products, collections, zodiacData } = catalog;
  const lang = i18n.language || "en";
  const sig = catalogSignature(catalog);
  if (!fuseCache || fuseCache.lang !== lang || fuseCache.signature !== sig) {
    // Build docs with titles in the current language, but keywords containing BOTH en + ka
    // so search works even if user types in the other language.
    const tCur = i18n.getFixedT(lang);
    const tEn = i18n.getFixedT("en");
    const tKa = i18n.getFixedT("ka");

    const docs: SearchDoc[] = [];

    for (const product of products) {
      const stonesCur = product.stones.map((s) => tStone(tCur, s));
      const stonesEn = product.stones.map((s) => tStone(tEn, s));
      const stonesKa = product.stones.map((s) => tStone(tKa, s));

      const purposeKeywordsCur = product.purposes.map((p) => tPurposeName(tCur, p, purposeInfo[p]?.name ?? p)).join(" ");
      const purposeKeywordsEn = product.purposes.map((p) => tPurposeName(tEn, p, purposeInfo[p]?.name ?? p)).join(" ");
      const purposeKeywordsKa = product.purposes.map((p) => tPurposeName(tKa, p, purposeInfo[p]?.name ?? p)).join(" ");

      const nameCur = tProductName(tCur, product);
      const descCur = tProductDescription(tCur, product);
      const meaningCur = tProductStonesMeaning(tCur, product);

      const nameEn = tProductName(tEn, product);
      const descEn = tProductDescription(tEn, product);
      const meaningEn = tProductStonesMeaning(tEn, product);

      const nameKa = tProductName(tKa, product);
      const descKa = tProductDescription(tKa, product);
      const meaningKa = tProductStonesMeaning(tKa, product);

      docs.push({
        id: product.id,
        type: "product",
        title: nameCur,
        subtitle: `${formatMoneyGEL(product.price, lang)} • ${stonesCur.join(", ")}`,
        href: `/product/${product.id}`,
        keywords: normalizeText(
          [
            nameCur,
            descCur,
            meaningCur,
            stonesCur.join(" "),
            purposeKeywordsCur,
            nameEn,
            descEn,
            meaningEn,
            stonesEn.join(" "),
            purposeKeywordsEn,
            nameKa,
            descKa,
            meaningKa,
            stonesKa.join(" "),
            purposeKeywordsKa,
            product.gender,
          ].join(" "),
        ),
      });
    }

    for (const collection of collections) {
      const nameCur = tCollectionName(tCur, collection);
      const descCur = tCollectionDescription(tCur, collection);
      const nameEn = tCollectionName(tEn, collection);
      const descEn = tCollectionDescription(tEn, collection);
      const nameKa = tCollectionName(tKa, collection);
      const descKa = tCollectionDescription(tKa, collection);

      docs.push({
        id: collection.slug,
        type: "collection",
        title: nameCur,
        subtitle: descCur,
        href: `/collections/${collection.slug}`,
        keywords: normalizeText([nameCur, descCur, nameEn, descEn, nameKa, descKa, collection.slug].join(" ")),
      });
    }

    for (const zodiac of zodiacData) {
      const cur = tZodiacInfo(tCur, zodiac);
      const en = tZodiacInfo(tEn, zodiac);
      const ka = tZodiacInfo(tKa, zodiac);
      const stonesCur = zodiac.stones.map((s) => tStone(tCur, s));
      const stonesEn = zodiac.stones.map((s) => tStone(tEn, s));
      const stonesKa = zodiac.stones.map((s) => tStone(tKa, s));

      docs.push({
        id: zodiac.sign,
        type: "zodiac",
        title: cur.name,
        subtitle: `${cur.symbol} • ${cur.dates}`,
        href: `/zodiac/${zodiac.sign}`,
        keywords: normalizeText(
          [
            cur.name,
            cur.sign,
            cur.element,
            cur.description,
            stonesCur.join(" "),
            en.name,
            en.element,
            en.description,
            stonesEn.join(" "),
            ka.name,
            ka.element,
            ka.description,
            stonesKa.join(" "),
          ].join(" "),
        ),
      });
    }

    // Pages (keep simple bilingual keywords)
    docs.push(
      {
        id: "shop",
        type: "page",
        title: tCur("nav.shop"),
        subtitle: tCur("shopPage.title"),
        href: "/shop",
        keywords: normalizeText([tEn("nav.shop"), tKa("nav.shop"), "shop products bracelets all"].join(" ")),
      },
      {
        id: "quiz",
        type: "page",
        title: tCur("nav.quiz"),
        subtitle: tCur("search.placeholder"),
        href: "/quiz",
        keywords: normalizeText([tEn("nav.quiz"), tKa("nav.quiz"), "quiz find your stone recommendation"].join(" ")),
      },
      {
        id: "collections",
        type: "page",
        title: tCur("nav.collections"),
        subtitle: tCur("nav.collections"),
        href: "/collections",
        keywords: normalizeText([tEn("nav.collections"), tKa("nav.collections"), "collections intention purpose"].join(" ")),
      },
      {
        id: "zodiac",
        type: "page",
        title: tCur("nav.zodiac"),
        subtitle: tCur("nav.zodiac"),
        href: "/zodiac",
        keywords: normalizeText([tEn("nav.zodiac"), tKa("nav.zodiac"), "zodiac"].join(" ")),
      },
      {
        id: "about",
        type: "page",
        title: tCur("nav.about"),
        subtitle: tCur("aboutPage.heroTitle"),
        href: "/about",
        keywords: normalizeText([tEn("nav.about"), tKa("nav.about"), "about story brand"].join(" ")),
      },
    );

    fuseCache = {
      lang,
      signature: sig,
      docs,
      fuse: new Fuse(docs, {
        includeScore: true,
        ignoreLocation: true,
        threshold: 0.35,
        minMatchCharLength: 2,
        shouldSort: true,
        useExtendedSearch: true,
        keys: [
          { name: "title", weight: 0.45 },
          { name: "keywords", weight: 0.55 },
        ],
      }),
    };
  }

  const matches = fuseCache.fuse.search(q, { limit: Math.max(limit, 20) });

  return matches
    .map((m) => {
      const baseScore = m.score ?? 1;
      const score = boostScore(q, m.item.title, baseScore);
      return {
        id: m.item.id,
        type: m.item.type,
        title: m.item.title,
        subtitle: m.item.subtitle,
        href: m.item.href,
        score,
      } satisfies SearchResult;
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, limit);
}

