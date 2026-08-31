import { useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Filter, LayoutGrid, List, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Seo from '@/components/Seo';
import ProductCard from '@/components/products/ProductCard';
import {
  ActiveFilter,
  Filters,
  type FacetCounts,
  type Gender,
} from '@/components/products/Filters';
import {
  purposeInfo,
  type Purpose,
  type ZodiacSign,
} from '@/data/products';
import { useProducts, useZodiacInfo } from '@/hooks/use-catalog';
import Fuse from 'fuse.js';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  tProductDescription,
  tProductName,
  tProductStonesMeaning,
  tPurposeName,
  tStone,
  tZodiacInfo,
} from '@/lib/catalog-i18n';
import { formatMoneyGEL } from '@/lib/money';

const ALL_ZODIAC_SIGNS: ReadonlySet<string> = new Set([
  'aries', 'taurus', 'gemini', 'cancer',
  'leo', 'virgo', 'libra', 'scorpio',
  'sagittarius', 'capricorn', 'aquarius', 'pisces',
]);
const PURPOSES: ReadonlySet<string> = new Set(Object.keys(purposeInfo));
const GENDERS: ReadonlySet<string> = new Set(['men', 'women', 'unisex']);

type SortKey = 'featured' | 'price-asc' | 'price-desc' | 'name' | 'newest';
const SORT_KEYS: ReadonlySet<string> = new Set(['featured', 'price-asc', 'price-desc', 'name', 'newest']);

const ShopPage = () => {
  const { t } = useTranslation();
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const url = typeof window !== 'undefined' ? window.location.href : '';
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: products = [], isLoading: productsLoading } = useProducts();
  const { data: zodiacData = [] } = useZodiacInfo();

  // Min/max derived from products. Fall back while loading so filters don't crash.
  const { minPrice, maxPrice } = useMemo(() => {
    if (products.length === 0) return { minPrice: 0, maxPrice: 100 };
    const prices = products.map((p) => p.price);
    return { minPrice: Math.min(...prices), maxPrice: Math.max(...prices) };
  }, [products]);

  // Derive filter state from URL
  const query = searchParams.get('q') ?? '';
  const selectedPurposes = useMemo<Purpose[]>(() => {
    const raw = searchParams.get('purposes');
    if (!raw) return [];
    return raw.split(',').filter((p) => PURPOSES.has(p)) as Purpose[];
  }, [searchParams]);

  const zodiacParam = searchParams.get('zodiac');
  const selectedZodiac: ZodiacSign | null =
    zodiacParam && ALL_ZODIAC_SIGNS.has(zodiacParam) ? (zodiacParam as ZodiacSign) : null;

  const genderParam = searchParams.get('gender');
  const selectedGender: Gender | null =
    genderParam && GENDERS.has(genderParam) ? (genderParam as Gender) : null;

  const minParam = Number(searchParams.get('min'));
  const maxParam = Number(searchParams.get('max'));
  const priceRange: [number, number] = [
    Number.isFinite(minParam) && minParam > 0 ? Math.max(minPrice, minParam) : minPrice,
    Number.isFinite(maxParam) && maxParam > 0 ? Math.min(maxPrice, maxParam) : maxPrice,
  ];
  const isPriceFiltered = priceRange[0] > minPrice || priceRange[1] < maxPrice;

  const sortParam = searchParams.get('sort');
  const sort: SortKey = sortParam && SORT_KEYS.has(sortParam) ? (sortParam as SortKey) : 'featured';
  const gridParam = searchParams.get('grid');
  const gridSize: 'large' | 'small' = gridParam === 'small' ? 'small' : 'large';

  // URL writers — replace history so back button doesn't fill with filter steps
  const writeParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          mutate(next);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const togglePurpose = (purpose: Purpose) => {
    const next = selectedPurposes.includes(purpose)
      ? selectedPurposes.filter((p) => p !== purpose)
      : [...selectedPurposes, purpose];
    writeParams((params) => {
      if (next.length === 0) params.delete('purposes');
      else params.set('purposes', next.join(','));
    });
  };

  const setSelectedZodiac = (zodiac: ZodiacSign | null) => {
    writeParams((params) => {
      if (zodiac) params.set('zodiac', zodiac);
      else params.delete('zodiac');
    });
  };

  const setSelectedGender = (gender: Gender | null) => {
    writeParams((params) => {
      if (gender) params.set('gender', gender);
      else params.delete('gender');
    });
  };

  const setPriceRange = (range: [number, number]) => {
    writeParams((params) => {
      if (range[0] > minPrice) params.set('min', String(range[0]));
      else params.delete('min');
      if (range[1] < maxPrice) params.set('max', String(range[1]));
      else params.delete('max');
    });
  };

  const setSort = (value: SortKey) => {
    writeParams((params) => {
      if (value === 'featured') params.delete('sort');
      else params.set('sort', value);
    });
  };

  const setGridSize = (value: 'large' | 'small') => {
    writeParams((params) => {
      if (value === 'small') params.set('grid', 'small');
      else params.delete('grid');
    });
  };

  const clearFilters = () => {
    writeParams((params) => {
      params.delete('purposes');
      params.delete('zodiac');
      params.delete('gender');
      params.delete('min');
      params.delete('max');
      params.delete('q');
    });
  };

  const localizedZodiacData = useMemo(
    () => zodiacData.map((z) => tZodiacInfo(t, z)),
    [t, zodiacData],
  );

  // Filter helpers — match a product against a subset of dimensions
  const matches = useCallback(
    (
      product: typeof products[number],
      opts: { skipPurposes?: boolean; skipZodiac?: boolean; skipGender?: boolean; skipPrice?: boolean } = {},
    ) => {
      const purposeMatch =
        opts.skipPurposes ||
        selectedPurposes.length === 0 ||
        selectedPurposes.some((p) => product.purposes.includes(p));
      const zodiacMatch = opts.skipZodiac || !selectedZodiac || product.zodiacSigns.includes(selectedZodiac);
      const genderMatch =
        opts.skipGender ||
        !selectedGender ||
        product.gender === selectedGender ||
        product.gender === 'unisex';
      const priceMatch = opts.skipPrice || (product.price >= priceRange[0] && product.price <= priceRange[1]);
      return purposeMatch && zodiacMatch && genderMatch && priceMatch;
    },
    [selectedPurposes, selectedZodiac, selectedGender, priceRange],
  );

  // Facet counts: count products that would match if THIS option were applied
  // (with all OTHER active filters), so users see "if I added this, how many products"
  const facetCounts = useMemo<FacetCounts>(() => {
    const purposeCounts = {} as Record<Purpose, number>;
    (Object.keys(purposeInfo) as Purpose[]).forEach((p) => {
      purposeCounts[p] = products.filter(
        (prod) => matches(prod, { skipPurposes: true }) && prod.purposes.includes(p),
      ).length;
    });

    const zodiacCounts = {} as Record<ZodiacSign, number>;
    zodiacData.forEach((z) => {
      zodiacCounts[z.sign] = products.filter(
        (prod) => matches(prod, { skipZodiac: true }) && prod.zodiacSigns.includes(z.sign),
      ).length;
    });

    const genderCounts = {} as Record<Gender, number>;
    (['men', 'women', 'unisex'] as Gender[]).forEach((g) => {
      genderCounts[g] = products.filter(
        (prod) => matches(prod, { skipGender: true }) && (prod.gender === g || prod.gender === 'unisex'),
      ).length;
    });

    return { purposes: purposeCounts, zodiac: zodiacCounts, gender: genderCounts };
  }, [matches, products, zodiacData]);

  // Apply all filters
  const baseFilteredProducts = useMemo(
    () => products.filter((p) => matches(p)),
    [matches, products],
  );

  // Apply search on top
  const searchedProducts = useMemo(() => {
    const q = query.trim();
    if (!q) return baseFilteredProducts;

    const searchable = baseFilteredProducts.map((product) => ({
      product,
      name: tProductName(t, product),
      stones: product.stones.map((s) => tStone(t, s)),
      purposes: product.purposes.map((p) => tPurposeName(t, p, purposeInfo[p].name)),
      description: tProductDescription(t, product),
      stonesMeaning: tProductStonesMeaning(t, product),
    }));

    const fuse = new Fuse(searchable, {
      includeScore: true,
      threshold: 0.35,
      ignoreLocation: true,
      minMatchCharLength: 2,
      keys: [
        { name: 'name', weight: 0.5 },
        { name: 'stones', weight: 0.2 },
        { name: 'purposes', weight: 0.15 },
        { name: 'description', weight: 0.1 },
        { name: 'stonesMeaning', weight: 0.05 },
      ],
    });

    return fuse.search(q).map((r) => r.item.product);
  }, [baseFilteredProducts, query, t]);

  // Apply sort
  const filteredProducts = useMemo(() => {
    const list = [...searchedProducts];
    switch (sort) {
      case 'price-asc':
        list.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        list.sort((a, b) => b.price - a.price);
        break;
      case 'name':
        list.sort((a, b) => tProductName(t, a).localeCompare(tProductName(t, b)));
        break;
      case 'newest':
        list.sort((a, b) => Number(b.isNew ?? false) - Number(a.isNew ?? false));
        break;
      case 'featured':
      default:
        list.sort((a, b) => Number(b.isBestseller ?? false) - Number(a.isBestseller ?? false));
        break;
    }
    return list;
  }, [searchedProducts, sort, t]);

  const hasActiveFilters =
    selectedPurposes.length > 0 ||
    !!selectedZodiac ||
    !!selectedGender ||
    isPriceFiltered ||
    query.trim().length > 0;
  const activeFilterCount =
    selectedPurposes.length +
    (selectedZodiac ? 1 : 0) +
    (selectedGender ? 1 : 0) +
    (isPriceFiltered ? 1 : 0) +
    (query.trim() ? 1 : 0);

  const filtersProps = {
    selectedPurposes,
    togglePurpose,
    selectedZodiac,
    setSelectedZodiac,
    selectedGender,
    setSelectedGender,
    priceRange,
    setPriceRange,
    minPrice: minPrice,
    maxPrice: maxPrice,
    zodiacData: localizedZodiacData,
    facetCounts,
    hasActiveFilters,
    clearFilters,
  };

  const sortLabels: Record<SortKey, string> = {
    featured: t('shopPage.sort.featured', { defaultValue: 'Featured' }),
    'price-asc': t('shopPage.sort.priceAsc', { defaultValue: 'Price: low to high' }),
    'price-desc': t('shopPage.sort.priceDesc', { defaultValue: 'Price: high to low' }),
    name: t('shopPage.sort.name', { defaultValue: 'Name (A–Z)' }),
    newest: t('shopPage.sort.newest', { defaultValue: 'Newest' }),
  };

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title={t('seo.pages.shop.title')}
        description={t('seo.pages.shop.description')}
        type="CollectionPage"
        jsonLd={
          url
            ? {
                '@context': 'https://schema.org',
                '@type': 'CollectionPage',
                name: t('seo.pages.shop.title'),
                description: t('seo.pages.shop.description'),
                url,
                isPartOf: origin
                  ? { '@type': 'WebSite', name: t('seo.siteName', { defaultValue: 'Gisheri' }), url: origin }
                  : undefined,
              }
            : undefined
        }
      />
      <Header />
      <main className="pt-20">
        {/* Hero */}
        <section className="bg-gradient-section py-12 md:py-20 px-4">
          <div className="container-main text-center">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="heading-hero mb-4"
            >
              {t('shopPage.title')}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-body text-lg max-w-2xl mx-auto"
            >
              {t('shopPage.subtitle')}
            </motion.p>
          </div>
        </section>

        <section className="container-main section-padding">
          <div className="lg:grid lg:grid-cols-[260px_1fr] lg:gap-8">
            {/* Desktop sidebar */}
            <aside className="hidden lg:block lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto pr-2">
              <Filters {...filtersProps} layout="sidebar" />
            </aside>

            <div className="min-w-0">
              {/* Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-2">
                  {/* Mobile filter sheet trigger */}
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button variant={hasActiveFilters ? 'default' : 'outline'} className="lg:hidden">
                        <Filter size={16} />
                        <span className="hidden sm:inline">{t('shopPage.filters')}</span>
                        {hasActiveFilters && (
                          <span className="ml-1 inline-flex items-center justify-center w-5 h-5 text-xs rounded-full bg-white/20">
                            {activeFilterCount}
                          </span>
                        )}
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto p-0">
                      <SheetHeader className="px-6 pt-6 pb-4 border-b">
                        <SheetTitle className="flex items-center gap-2">
                          <Filter size={18} />
                          {t('shopPage.filters')}
                        </SheetTitle>
                      </SheetHeader>
                      <div className="px-6 py-4">
                        <Filters {...filtersProps} layout="sheet" />
                      </div>
                      <SheetFooter className="sticky bottom-0 left-0 right-0 bg-background border-t px-6 py-4 flex-row gap-2">
                        {hasActiveFilters && (
                          <Button variant="outline" onClick={clearFilters} className="flex-1">
                            {t('buttons.clearAll')}
                          </Button>
                        )}
                      </SheetFooter>
                    </SheetContent>
                  </Sheet>

                  {hasActiveFilters && (
                    <Button variant="ghost" onClick={clearFilters} className="text-muted-foreground">
                      <X size={16} />
                      <span className="hidden sm:inline">{t('buttons.clearAll')}</span>
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="hidden sm:inline text-xs md:text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{filteredProducts.length}</span>{' '}
                    {t('shopPage.products', { defaultValue: 'products' })}
                  </span>
                  <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                    <SelectTrigger className="h-9 w-[160px] sm:w-[180px] text-xs sm:text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(sortLabels) as SortKey[]).map((k) => (
                        <SelectItem key={k} value={k}>
                          {sortLabels[k]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <ToggleGroup
                    type="single"
                    value={gridSize}
                    onValueChange={(val) => val && setGridSize(val as 'large' | 'small')}
                    variant="outline"
                    size="sm"
                    className="hidden sm:flex"
                  >
                    <ToggleGroupItem value="large" aria-label="Large grid">
                      <LayoutGrid size={16} />
                    </ToggleGroupItem>
                    <ToggleGroupItem value="small" aria-label="Compact grid">
                      <List size={16} />
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </div>

              {/* Active filter chips */}
              {hasActiveFilters && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-wrap items-center gap-2 mb-6"
                >
                  {query.trim() && (
                    <ActiveFilter
                      onClose={() =>
                        writeParams((p) => {
                          p.delete('q');
                        })
                      }
                    >
                      {t('shopPage.searchChip', { query })}
                    </ActiveFilter>
                  )}
                  {selectedPurposes.map((purpose) => (
                    <ActiveFilter key={purpose} onClose={() => togglePurpose(purpose)}>
                      {tPurposeName(t, purpose, purposeInfo[purpose].name)}
                    </ActiveFilter>
                  ))}
                  {selectedZodiac && (
                    <ActiveFilter onClose={() => setSelectedZodiac(null)}>
                      {localizedZodiacData.find((z) => z.sign === selectedZodiac)?.symbol}{' '}
                      {localizedZodiacData.find((z) => z.sign === selectedZodiac)?.name}
                    </ActiveFilter>
                  )}
                  {selectedGender && (
                    <ActiveFilter onClose={() => setSelectedGender(null)}>
                      {t(`shopPage.genders.${selectedGender}`)}
                    </ActiveFilter>
                  )}
                  {isPriceFiltered && (
                    <ActiveFilter onClose={() => setPriceRange([minPrice, maxPrice])}>
                      {formatMoneyGEL(priceRange[0])} – {formatMoneyGEL(priceRange[1])}
                    </ActiveFilter>
                  )}
                </motion.div>
              )}

              {/* Products grid */}
              {productsLoading ? (
                <div
                  className={`grid gap-4 sm:gap-6 ${
                    gridSize === 'large'
                      ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'
                      : 'grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4'
                  }`}
                >
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="rounded-lg border bg-card animate-pulse"
                    >
                      <div className="aspect-square bg-muted" />
                      <div className="p-4 space-y-2">
                        <div className="h-3 w-1/3 bg-muted rounded" />
                        <div className="h-4 w-3/4 bg-muted rounded" />
                        <div className="h-3 w-1/2 bg-muted rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredProducts.length > 0 ? (
                <motion.div
                  layout
                  className={`grid gap-4 sm:gap-6 ${
                    gridSize === 'large'
                      ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'
                      : 'grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4'
                  }`}
                >
                  {filteredProducts.map((product, index) => (
                    <ProductCard key={product.id} product={product} index={index} />
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="py-16 md:py-24 text-center"
                >
                  <div className="text-5xl mb-4 opacity-40">🔍</div>
                  <h3 className="text-xl font-serif font-medium mb-2">
                    {t('shopPage.noMatchTitle', { defaultValue: 'No products found' })}
                  </h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">{t('shopPage.noMatch')}</p>
                  <Button onClick={clearFilters}>{t('buttons.clearAll')}</Button>
                </motion.div>
              )}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default ShopPage;
