/**
 * Public catalog endpoints. All open (no auth) — these are the storefront
 * read views. Admin CRUD lives in admin-api.ts.
 *
 * Wire shape: camelCase (CamelSchema with by_alias=True). Numeric strings
 * for money come back as strings (Decimal serialized) — convert at call
 * sites with Number().
 */
import { api } from '@/lib/api';
import type {
  Collection,
  Product,
  Purpose,
  ZodiacInfo,
  ZodiacSign,
} from '@/data/products';

// API responses — money as string (Decimal); ID as number.
interface ApiProduct {
  id: number;
  name: string;
  nameKa?: string;
  price: string;
  originalPrice: string | null;
  image: string;
  purposes: Purpose[];
  zodiacSigns: ZodiacSign[];
  stones: string[];
  stonesMeaning: string;
  stonesMeaningKa?: string;
  description: string;
  descriptionKa?: string;
  gender: 'men' | 'women' | 'unisex';
  isBestseller: boolean;
  isNew: boolean;
}

interface ApiCollection {
  id: number;
  slug: string;
  name: string;
  nameKa?: string;
  description: string;
  descriptionKa?: string;
  image: string;
}

interface ApiZodiacInfo {
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

/**
 * Adapt API shape to the existing TS Product interface used across the UI.
 * Money becomes number; id becomes string (existing UI expected string ids).
 */
const adaptProduct = (p: ApiProduct): Product => ({
  id: String(p.id),
  name: p.name,
  nameKa: p.nameKa || undefined,
  price: Number(p.price),
  originalPrice: p.originalPrice == null ? undefined : Number(p.originalPrice),
  image: p.image,
  purposes: p.purposes,
  zodiacSigns: p.zodiacSigns,
  stones: p.stones,
  stonesMeaning: p.stonesMeaning,
  stonesMeaningKa: p.stonesMeaningKa || undefined,
  description: p.description,
  descriptionKa: p.descriptionKa || undefined,
  gender: p.gender,
  isBestseller: p.isBestseller || undefined,
  isNew: p.isNew || undefined,
});

const adaptCollection = (c: ApiCollection): Collection => ({
  id: String(c.id),
  slug: c.slug,
  name: c.name,
  nameKa: c.nameKa || undefined,
  description: c.description,
  descriptionKa: c.descriptionKa || undefined,
  image: c.image,
});

const adaptZodiac = (z: ApiZodiacInfo): ZodiacInfo => ({
  sign: z.sign,
  name: z.name,
  nameKa: z.nameKa || undefined,
  symbol: z.symbol,
  dates: z.dates,
  datesKa: z.datesKa || undefined,
  element: z.element,
  elementKa: z.elementKa || undefined,
  stones: z.stones,
  description: z.description,
  descriptionKa: z.descriptionKa || undefined,
});

export const catalogApi = {
  listProducts: async (): Promise<Product[]> => {
    const data = await api.get<ApiProduct[]>('/products', { skipAuth: true });
    return data.map(adaptProduct);
  },
  getProduct: async (id: string | number): Promise<Product> => {
    const data = await api.get<ApiProduct>(`/products/${id}`, { skipAuth: true });
    return adaptProduct(data);
  },
  listCollections: async (): Promise<Collection[]> => {
    const data = await api.get<ApiCollection[]>('/collections', { skipAuth: true });
    return data.map(adaptCollection);
  },
  listZodiac: async (): Promise<ZodiacInfo[]> => {
    const data = await api.get<ApiZodiacInfo[]>('/zodiac', { skipAuth: true });
    return data.map(adaptZodiac);
  },
};
