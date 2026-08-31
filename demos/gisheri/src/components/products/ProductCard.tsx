import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShoppingCart, Heart, Star } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Product, Purpose } from '@/data/products';
import { purposeInfo } from '@/data/products';
import { useTranslation } from 'react-i18next';
import { tProductName, tPurposeName, tStone } from '@/lib/catalog-i18n';
import { formatMoneyGEL } from '@/lib/money';
import { useToast } from '@/components/ui/use-toast';

interface ProductCardProps {
  product: Product;
  index?: number;
}

const purposeBadgeClass: Record<Purpose, string> = {
  luck: 'bg-purpose-luck/15 text-purpose-luck border-purpose-luck/30',
  protection: 'bg-purpose-protection/15 text-purpose-protection border-purpose-protection/30',
  love: 'bg-purpose-love/15 text-purpose-love border-purpose-love/30',
  safety: 'bg-purpose-safety/15 text-purpose-safety border-purpose-safety/30',
  energy: 'bg-purpose-energy/15 text-purpose-energy border-purpose-energy/30',
  balance: 'bg-purpose-balance/15 text-purpose-balance border-purpose-balance/30',
};

const ProductCard = ({ product, index = 0 }: ProductCardProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const productName = tProductName(t, product);
  const stones = product.stones.map((s) => tStone(t, s));
  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toast({
      title: t('productPage.selectSize', { defaultValue: 'Select size' }),
      description: t('productPage.selectSizeHint', { defaultValue: 'Please choose a size before adding to cart.' }),
    });
  };

  const handleHeart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="group h-full"
    >
      <Card className="card-product overflow-hidden h-full flex flex-col p-0 transition-shadow hover:shadow-md">
        <Link to={`/product/${product.id}`} className="block relative aspect-square overflow-hidden">
          <img
            src={product.image}
            alt={productName}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />

          {/* Badges - stacked in top-left */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
            {product.isBestseller && (
              <Badge className="bg-gold text-primary-foreground border-transparent gap-1 hover:bg-gold/90">
                <Star size={10} fill="currentColor" />
                {t('productCard.bestseller')}
              </Badge>
            )}
            {product.isNew && (
              <Badge className="bg-purpose-luck text-white border-transparent hover:bg-purpose-luck/90">
                {t('productCard.new')}
              </Badge>
            )}
            {product.originalPrice && (
              <Badge variant="destructive">{t('productCard.sale')}</Badge>
            )}
          </div>

          {/* Heart - top-right, always accessible */}
          <div className="absolute top-2 right-2 z-10 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
            <button
              onClick={handleHeart}
              className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center bg-background/90 backdrop-blur-sm rounded-full text-foreground hover:text-purpose-love transition-colors"
            >
              <Heart size={18} />
            </button>
          </div>

          {/* Add to cart overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-3 md:p-4 translate-y-0 md:translate-y-full md:group-hover:translate-y-0 transition-transform duration-300 bg-gradient-to-t from-black/60 via-black/30 to-transparent md:from-transparent md:via-transparent md:bg-none z-10">
            <button
              type="button"
              onClick={handleAddToCart}
              className="w-full btn-gold flex items-center justify-center gap-2 py-2 md:py-2.5 text-sm md:text-base"
              aria-label={t('buttons.addToCart')}
            >
              <ShoppingCart size={16} />
              <span className="hidden sm:inline">{t('buttons.addToCart')}</span>
              <span className="sm:hidden">{t('buttons.add', { defaultValue: 'Add' })}</span>
            </button>
          </div>
        </Link>

        <div className="p-3 md:p-4 flex flex-col flex-1">
          {/* Purpose badges - fixed height single row with overflow hidden */}
          <div className="h-6 md:h-7 overflow-hidden mb-1.5 md:mb-2">
            <div className="flex items-center gap-1 flex-nowrap">
              {product.purposes.slice(0, 2).map((purpose) => (
                <Badge
                  key={purpose}
                  variant="outline"
                  className={cn('text-[10px] px-1.5 py-0 leading-5 shrink-0 font-normal', purposeBadgeClass[purpose])}
                >
                  {tPurposeName(t, purpose, purposeInfo[purpose].name)}
                </Badge>
              ))}
              {product.purposes.length > 2 && (
                <span className="text-[10px] text-muted-foreground shrink-0">+{product.purposes.length - 2}</span>
              )}
            </div>
          </div>

          {/* Name - fixed 2-line height */}
          <Link to={`/product/${product.id}`}>
            <h3 className="font-serif font-medium text-base md:text-xl leading-snug text-foreground group-hover:text-primary transition-colors mb-1.5 md:mb-2 line-clamp-2 min-h-[2.5rem] md:min-h-[3.25rem]">
              {productName}
            </h3>
          </Link>

          {/* Stones */}
          <p className="text-xs md:text-sm text-muted-foreground leading-relaxed mb-2 md:mb-3 line-clamp-1">{stones.join(', ')}</p>

          {/* Price - pushed to bottom */}
          <div className="flex items-center gap-2 mt-auto">
            <span className="text-base md:text-lg font-semibold text-foreground">{formatMoneyGEL(product.price)}</span>
            {product.originalPrice && (
              <span className="text-xs md:text-sm text-muted-foreground line-through">
                {formatMoneyGEL(product.originalPrice)}
              </span>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
};

export default ProductCard;
