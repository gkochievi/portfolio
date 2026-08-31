import type { TFunction } from "i18next";

import i18n from "@/i18n";
import type { Collection, Product, Purpose, ZodiacInfo, ZodiacSign } from "@/data/products";

const STONE_KEY_BY_NAME: Record<string, string> = {
  Amethyst: "amethyst",
  "Rose Quartz": "roseQuartz",
  "Tiger's Eye": "tigersEye",
  "Black Obsidian": "blackObsidian",
  Jade: "jade",
  "Lapis Lazuli": "lapisLazuli",
  Carnelian: "carnelian",
  Bloodstone: "bloodstone",
  Diamond: "diamond",
  Amazonite: "amazonite",
  Sapphire: "sapphire",
  Emerald: "emerald",
  Aquamarine: "aquamarine",
  Labradorite: "labradorite",
  Citrine: "citrine",
  Agate: "agate",
  Moonstone: "moonstone",
  Pearl: "pearl",
  Sunstone: "sunstone",
  Peridot: "peridot",
  Opal: "opal",
  Malachite: "malachite",
  Topaz: "topaz",
  Turquoise: "turquoise",
  Garnet: "garnet",
};

export function tStone(t: TFunction, stoneName: string) {
  const key = STONE_KEY_BY_NAME[stoneName];
  if (!key) return stoneName;
  return t(`catalog.stones.${key}`, { defaultValue: stoneName });
}

export function tPurposeName(t: TFunction, purpose: Purpose, fallback: string) {
  return t(`catalog.purposes.${purpose}.name`, { defaultValue: fallback });
}

export function tPurposeDescription(t: TFunction, purpose: Purpose, fallback: string) {
  return t(`catalog.purposes.${purpose}.description`, { defaultValue: fallback });
}

/**
 * Resolution order for product strings:
 *   1. The DB-stored *_ka field on the Product, when current language is `ka`.
 *      Admin-created products store their translations here.
 *   2. The matching `catalog.products.<id>.*` i18next key (legacy seed data).
 *   3. The canonical English field on the Product as a final fallback.
 */
function currentLang(t: TFunction): string {
  // A fixed t from useTranslation() carries no readable language (its .lng is
  // null unless the caller pinned one), so ask the shared instance — the same
  // source lib/money.ts reads. The old `.options?.lng` probe matched nothing
  // and silently pinned every catalogue string to Georgian.
  const fromT = (t as { lng?: string | null }).lng;
  return fromT || i18n.language || "ka";
}

export function tProductName(t: TFunction, product: Product) {
  if (currentLang(t) === "ka" && product.nameKa) return product.nameKa;
  return t(`catalog.products.${product.id}.name`, { defaultValue: product.name });
}

export function tProductDescription(t: TFunction, product: Product) {
  if (currentLang(t) === "ka" && product.descriptionKa) return product.descriptionKa;
  return t(`catalog.products.${product.id}.description`, { defaultValue: product.description });
}

export function tProductStonesMeaning(t: TFunction, product: Product) {
  if (currentLang(t) === "ka" && product.stonesMeaningKa) return product.stonesMeaningKa;
  return t(`catalog.products.${product.id}.stonesMeaning`, { defaultValue: product.stonesMeaning });
}

export function tCollectionName(t: TFunction, collection: Collection) {
  if (currentLang(t) === "ka" && collection.nameKa) return collection.nameKa;
  return t(`catalog.collections.${collection.slug}.name`, { defaultValue: collection.name });
}

export function tCollectionDescription(t: TFunction, collection: Collection) {
  if (currentLang(t) === "ka" && collection.descriptionKa) return collection.descriptionKa;
  return t(`catalog.collections.${collection.slug}.description`, { defaultValue: collection.description });
}

export function tZodiacName(t: TFunction, sign: ZodiacSign, fallback: string) {
  return t(`catalog.zodiac.${sign}.name`, { defaultValue: fallback });
}

export function tZodiacDates(t: TFunction, sign: ZodiacSign, fallback: string) {
  return t(`catalog.zodiac.${sign}.dates`, { defaultValue: fallback });
}

export function tZodiacElement(t: TFunction, sign: ZodiacSign, fallback: string) {
  return t(`catalog.zodiac.${sign}.element`, { defaultValue: fallback });
}

export function tZodiacDescription(t: TFunction, sign: ZodiacSign, fallback: string) {
  return t(`catalog.zodiac.${sign}.description`, { defaultValue: fallback });
}

export function tZodiacInfo(t: TFunction, zodiac: ZodiacInfo): ZodiacInfo {
  const isKa = currentLang(t) === "ka";
  return {
    ...zodiac,
    name: (isKa && zodiac.nameKa) || tZodiacName(t, zodiac.sign, zodiac.name),
    dates: (isKa && zodiac.datesKa) || tZodiacDates(t, zodiac.sign, zodiac.dates),
    element: (isKa && zodiac.elementKa) || tZodiacElement(t, zodiac.sign, zodiac.element),
    description: (isKa && zodiac.descriptionKa) || tZodiacDescription(t, zodiac.sign, zodiac.description),
  };
}

