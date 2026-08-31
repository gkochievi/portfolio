import { Filter as FilterIcon, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  type Purpose,
  type ZodiacInfo,
  type ZodiacSign,
  purposeInfo,
} from '@/data/products';
import { tPurposeName } from '@/lib/catalog-i18n';
import { formatMoneyGEL } from '@/lib/money';

export type Gender = 'men' | 'women' | 'unisex';

export interface FacetCounts {
  purposes: Record<Purpose, number>;
  zodiac: Record<ZodiacSign, number>;
  gender: Record<Gender, number>;
}

interface FilterChipProps {
  active: boolean;
  onClick: () => void;
  count?: number;
  className?: string;
  children: React.ReactNode;
}

const FilterChip = ({ active, onClick, count, className, children }: FilterChipProps) => {
  const muted = count === 0 && !active;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={muted}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1 text-xs md:text-sm rounded-full border transition-colors',
        active
          ? 'border-gold bg-gold/10 text-foreground'
          : 'border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground',
        muted && 'opacity-40 cursor-not-allowed hover:border-border hover:text-muted-foreground',
        className,
      )}
    >
      <span className="truncate">{children}</span>
      {count !== undefined && (
        <span className={cn('text-[10px] tabular-nums opacity-60 shrink-0', active && 'opacity-90')}>
          {count}
        </span>
      )}
    </button>
  );
};

interface ActiveFilterProps {
  onClose: () => void;
  children: React.ReactNode;
}

export const ActiveFilter = ({ onClose, children }: ActiveFilterProps) => (
  <Badge
    variant="outline"
    className="gap-1.5 pr-1 py-1 text-xs bg-gold/10 border-gold/30 text-foreground"
  >
    {children}
    <button
      type="button"
      onClick={onClose}
      className="rounded-full hover:bg-foreground/10 p-0.5 -mr-0.5"
      aria-label="Remove filter"
    >
      <X size={12} />
    </button>
  </Badge>
);

interface PricePreset {
  id: string;
  label: string;
  range: [number, number];
}

interface FiltersProps {
  selectedPurposes: Purpose[];
  togglePurpose: (p: Purpose) => void;
  selectedZodiac: ZodiacSign | null;
  setSelectedZodiac: (z: ZodiacSign | null) => void;
  selectedGender: Gender | null;
  setSelectedGender: (g: Gender | null) => void;
  priceRange: [number, number];
  setPriceRange: (r: [number, number]) => void;
  minPrice: number;
  maxPrice: number;
  zodiacData: ZodiacInfo[];
  facetCounts: FacetCounts;
  hasActiveFilters: boolean;
  clearFilters: () => void;
  layout?: 'sidebar' | 'sheet';
}

export const Filters = ({
  selectedPurposes,
  togglePurpose,
  selectedZodiac,
  setSelectedZodiac,
  selectedGender,
  setSelectedGender,
  priceRange,
  setPriceRange,
  minPrice,
  maxPrice,
  zodiacData,
  facetCounts,
  hasActiveFilters,
  clearFilters,
  layout = 'sidebar',
}: FiltersProps) => {
  const { t } = useTranslation();

  const presets: PricePreset[] = [
    { id: 'any', label: t('shopPage.pricePresets.any', { defaultValue: 'Any' }), range: [minPrice, maxPrice] },
    { id: 'under40', label: t('shopPage.pricePresets.under40', { defaultValue: '< ₾40' }), range: [minPrice, 40] },
    { id: '40to50', label: '₾40 – ₾50', range: [40, 50] },
    { id: 'over50', label: t('shopPage.pricePresets.over50', { defaultValue: '> ₾50' }), range: [50, maxPrice] },
  ];

  const activePreset = presets.find((p) => p.range[0] === priceRange[0] && p.range[1] === priceRange[1])?.id ?? null;
  const isPriceFiltered = priceRange[0] > minPrice || priceRange[1] < maxPrice;
  const genders: Gender[] = ['men', 'women', 'unisex'];

  return (
    <div className={cn(layout === 'sidebar' ? 'space-y-6' : 'space-y-6 pb-24')}>
      {/* Sidebar header */}
      {layout === 'sidebar' && (
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <FilterIcon size={16} className="text-muted-foreground" />
            <h3 className="font-serif font-medium text-base">{t('shopPage.filters')}</h3>
          </div>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-destructive hover:text-destructive h-auto px-2 py-1 text-xs"
            >
              {t('buttons.clearAll')}
            </Button>
          )}
        </div>
      )}

      {/* Price */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs md:text-sm font-medium text-foreground">
            {t('shopPage.priceRange', { defaultValue: 'Price Range' })}
          </h4>
          {isPriceFiltered && (
            <Badge variant="outline" className="bg-gold/10 border-gold/30 text-[10px]">1</Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {presets.map((preset) => (
            <FilterChip
              key={preset.id}
              active={activePreset === preset.id}
              onClick={() => setPriceRange(preset.range)}
            >
              {preset.label}
            </FilterChip>
          ))}
        </div>
        <div className="bg-secondary/30 rounded-xl p-3">
          <Slider
            value={priceRange}
            onValueChange={(value) => setPriceRange(value as [number, number])}
            min={minPrice}
            max={maxPrice}
            step={5}
            className="mb-3"
          />
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium tabular-nums">{formatMoneyGEL(priceRange[0])}</span>
            <span className="text-muted-foreground">—</span>
            <span className="font-medium tabular-nums">{formatMoneyGEL(priceRange[1])}</span>
          </div>
        </div>
      </div>

      <Separator />

      {/* Gender */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs md:text-sm font-medium text-foreground">{t('shopPage.gender')}</h4>
          {selectedGender && (
            <Badge variant="outline" className="bg-gold/10 border-gold/30 text-[10px]">1</Badge>
          )}
        </div>
        <div className="flex gap-2">
          {genders.map((gender) => (
            <FilterChip
              key={gender}
              active={selectedGender === gender}
              onClick={() => setSelectedGender(selectedGender === gender ? null : gender)}
              count={facetCounts.gender[gender]}
              className="flex-1 justify-center text-center"
            >
              {t(`shopPage.genders.${gender}`)}
            </FilterChip>
          ))}
        </div>
      </div>

      <Separator />

      {/* Purpose */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs md:text-sm font-medium text-foreground">{t('shopPage.purpose')}</h4>
          {selectedPurposes.length > 0 && (
            <Badge variant="outline" className="bg-gold/10 border-gold/30 text-[10px]">
              {selectedPurposes.length}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(purposeInfo) as Purpose[]).map((purpose) => (
            <FilterChip
              key={purpose}
              active={selectedPurposes.includes(purpose)}
              onClick={() => togglePurpose(purpose)}
              count={facetCounts.purposes[purpose]}
            >
              {tPurposeName(t, purpose, purposeInfo[purpose].name)}
            </FilterChip>
          ))}
        </div>
      </div>

      <Separator />

      {/* Zodiac */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs md:text-sm font-medium text-foreground">{t('shopPage.zodiacSign')}</h4>
          {selectedZodiac && (
            <Badge variant="outline" className="bg-gold/10 border-gold/30 text-[10px]">1</Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {zodiacData.map((zodiac) => (
            <FilterChip
              key={zodiac.sign}
              active={selectedZodiac === zodiac.sign}
              onClick={() => setSelectedZodiac(selectedZodiac === zodiac.sign ? null : zodiac.sign)}
              count={facetCounts.zodiac[zodiac.sign]}
            >
              <span className="mr-0.5">{zodiac.symbol}</span>
              {zodiac.name}
            </FilterChip>
          ))}
        </div>
      </div>
    </div>
  );
};
