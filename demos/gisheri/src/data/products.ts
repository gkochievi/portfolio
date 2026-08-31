/**
 * Catalog types + purpose metadata.
 *
 * Live product / collection / zodiac data is fetched from the backend via
 * `useProducts()`, `useCollections()`, `useZodiacInfo()` in
 * `@/hooks/use-catalog`. This file only exposes the TypeScript types the UI
 * code is built on, plus the static metadata for the `Purpose` enum
 * (labels, descriptions, colors) — that's UI-only and doesn't change with
 * the catalog content.
 */

export type Purpose = 'luck' | 'protection' | 'love' | 'safety' | 'energy' | 'balance';
export type ZodiacSign =
  | 'aries' | 'taurus' | 'gemini' | 'cancer'
  | 'leo' | 'virgo' | 'libra' | 'scorpio'
  | 'sagittarius' | 'capricorn' | 'aquarius' | 'pisces';

export interface Product {
  id: string;
  name: string;
  nameKa?: string;
  price: number;
  originalPrice?: number;
  image: string;
  purposes: Purpose[];
  zodiacSigns: ZodiacSign[];
  stones: string[];
  stonesMeaning: string;
  stonesMeaningKa?: string;
  description: string;
  descriptionKa?: string;
  gender: 'men' | 'women' | 'unisex';
  isBestseller?: boolean;
  isNew?: boolean;
}

export interface Collection {
  id: string;
  name: string;
  nameKa?: string;
  description: string;
  descriptionKa?: string;
  image: string;
  slug: string;
}

export interface ZodiacInfo {
  sign: ZodiacSign;
  name: string;
  nameKa?: string;
  symbol: string;
  dates: string;
  datesKa?: string;
  element: string;
  elementKa?: string;
  stones: string[];
  description: string;
  descriptionKa?: string;
}

export const purposeInfo: Record<Purpose, { name: string; description: string; color: string }> = {
  luck: {
    name: 'Luck & Prosperity',
    description: 'Attract abundance, success, and good fortune into your life.',
    color: 'luck',
  },
  protection: {
    name: 'Protection',
    description: 'Shield yourself from negative energies and harmful influences.',
    color: 'protection',
  },
  love: {
    name: 'Love & Relationships',
    description: 'Open your heart to love, heal emotional wounds, and attract meaningful connections.',
    color: 'love',
  },
  safety: {
    name: 'Safety & Grounding',
    description: 'Feel secure, grounded, and protected in your daily life.',
    color: 'safety',
  },
  energy: {
    name: 'Energy & Vitality',
    description: 'Boost your energy, enhance focus, and increase your life force.',
    color: 'energy',
  },
  balance: {
    name: 'Balance & Harmony',
    description: 'Restore equilibrium, find inner peace, and harmonize your energies.',
    color: 'balance',
  },
};
