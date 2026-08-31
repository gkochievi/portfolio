import { useParams, Link } from 'react-router-dom';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, Heart, Star, ShieldCheck, Zap, Shield, Sparkles, Scale, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Seo from '@/components/Seo';
import ProductCard from '@/components/products/ProductCard';
import { purposeInfo, type Purpose } from '@/data/products';
import { useProduct, useProducts, useZodiacInfo } from '@/hooks/use-catalog';
import { useTranslation } from 'react-i18next';
import { tProductDescription, tProductName, tProductStonesMeaning, tPurposeName, tStone, tZodiacInfo } from '@/lib/catalog-i18n';
import { formatMoneyGEL } from '@/lib/money';
import { useCart } from '@/context/cart';
import { useToast } from '@/components/ui/use-toast';

const purposeIcons: Record<Purpose, React.ElementType> = {
  luck: Sparkles,
  protection: Shield,
  love: Heart,
  safety: Shield,
  energy: Sparkles,
  balance: Scale,
};

const purposeBadgeClass: Record<Purpose, string> = {
  luck: 'bg-purpose-luck/15 text-purpose-luck border-purpose-luck/30',
  protection: 'bg-purpose-protection/15 text-purpose-protection border-purpose-protection/30',
  love: 'bg-purpose-love/15 text-purpose-love border-purpose-love/30',
  safety: 'bg-purpose-safety/15 text-purpose-safety border-purpose-safety/30',
  energy: 'bg-purpose-energy/15 text-purpose-energy border-purpose-energy/30',
  balance: 'bg-purpose-balance/15 text-purpose-balance border-purpose-balance/30',
};

const ProductDetailPage = () => {
  const { t } = useTranslation();
  const { addItem } = useCart();
  const { toast } = useToast();
  const { id } = useParams<{ id: string }>();
  const { data: product, isLoading, isError } = useProduct(id);
  const { data: products = [] } = useProducts();
  const { data: zodiacData = [] } = useZodiacInfo();
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const url = typeof window !== 'undefined' ? window.location.href : '';
  const siteName = t('seo.siteName', { defaultValue: 'Gisheri' });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-20">
          <div className="container-main section-padding">
            <p className="text-muted-foreground text-sm">Loading…</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Seo
          title={t('seo.pages.notFound.title')}
          description={t('seo.pages.notFound.description')}
          robots="noindex,nofollow"
        />
        <div className="text-center">
          <h1 className="heading-section mb-4">{t('productPage.notFoundTitle')}</h1>
          <Link to="/shop">
            <Button size="lg">{t('buttons.backToShop')}</Button>
          </Link>
        </div>
      </div>
    );
  }

  const productName = tProductName(t, product);
  const productDescription = tProductDescription(t, product);
  const productStonesMeaning = tProductStonesMeaning(t, product);
  const stones = product.stones.map((s) => tStone(t, s));
  const productImage = product.image.startsWith('http') || !origin ? product.image : `${origin}${product.image}`;
  const pageTitle = t('seo.pages.product.title', { product: productName });
  const pageDescription = t('seo.pages.product.description', { product: productName, description: productDescription });

  const handleAddToCart = () => {
    if (!selectedSize) {
      toast({
        title: t('productPage.selectSize', { defaultValue: 'Select size' }),
        description: t('productPage.selectSizeHint', { defaultValue: 'Please choose a size before adding to cart.' }),
      });
      return;
    }
    addItem(product, selectedSize, 1);
    toast({
      title: t('cartPage.addedTitle', { defaultValue: 'Added to cart' }),
      description: productName,
    });
  };

  const relatedProducts = products
    .filter((p) => p.id !== product.id && p.purposes.some((purpose) => product.purposes.includes(purpose)))
    .slice(0, 3);

  const matchingZodiacs = zodiacData.filter((z) => product.zodiacSigns.includes(z.sign)).map((z) => tZodiacInfo(t, z));

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title={pageTitle}
        description={pageDescription}
        type="product"
        image={productImage}
        jsonLd={url ? {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: productName,
          description: productDescription,
          image: productImage,
          brand: { '@type': 'Brand', name: siteName },
          offers: {
            '@type': 'Offer',
            priceCurrency: 'GEL',
            price: product.price,
            availability: 'https://schema.org/InStock',
            url,
          },
        } : undefined}
      />
      <Header />
      <main className="pt-20">
        <div className="container-main section-padding">
          {/* Breadcrumb */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-8"
          >
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild><Link to="/">{t('brand.stone')}{t('brand.soul')}</Link></BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild><Link to="/shop">{t('nav.shop')}</Link></BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{productName}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-12">
            {/* Image */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="relative rounded-3xl overflow-hidden bg-secondary/30">
                <img
                  src={product.image}
                  alt={productName}
                  className="w-full aspect-square object-cover"
                />
                {product.isBestseller && (
                  <div className="absolute top-4 left-4 z-10">
                    <Badge className="bg-gold text-primary-foreground border-transparent gap-1 hover:bg-gold/90">
                      <Star size={12} fill="currentColor" />
                      {t('productPage.bestseller')}
                    </Badge>
                  </div>
                )}
                {product.isNew && (
                  <div className="absolute top-4 right-4 z-10">
                    <Badge className="bg-purpose-luck text-white border-transparent hover:bg-purpose-luck/90">
                      {t('productPage.new')}
                    </Badge>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Details */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="flex flex-col"
            >
              {/* Purposes */}
              <div className="flex flex-wrap gap-2 mb-4">
                {product.purposes.map((purpose) => {
                  const Icon = purposeIcons[purpose];
                  return (
                    <Badge
                      key={purpose}
                      variant="outline"
                      className={cn('gap-1 text-sm font-normal', purposeBadgeClass[purpose])}
                    >
                      <Icon size={14} />
                      {tPurposeName(t, purpose, purposeInfo[purpose].name)}
                    </Badge>
                  );
                })}
              </div>

              <h1 className="heading-hero text-2xl sm:text-3xl md:text-4xl mb-4">{productName}</h1>

              {/* Price */}
              <div className="flex items-center gap-3 mb-6">
                <span className="text-3xl font-semibold">{formatMoneyGEL(product.price)}</span>
                {product.originalPrice && (
                  <span className="text-xl text-muted-foreground line-through">
                    {formatMoneyGEL(product.originalPrice)}
                  </span>
                )}
                {product.originalPrice && (
                  <Badge variant="destructive">
                    {t('productPage.save', { amount: formatMoneyGEL(product.originalPrice - product.price) })}
                  </Badge>
                )}
              </div>

              <p className="text-body text-lg mb-6">{productDescription}</p>

              {/* Zodiac compatibility */}
              <div className="mb-6">
                <h3 className="font-serif font-medium mb-3">{t('productPage.zodiacCompatibility')}</h3>
                <div className="flex flex-wrap gap-2">
                  {matchingZodiacs.map((zodiac) => (
                    <Link key={zodiac.sign} to={`/zodiac/${zodiac.sign}`}>
                      <Badge
                        variant="outline"
                        className="gap-1 py-1 px-3 text-sm cursor-pointer hover:border-gold transition-colors"
                      >
                        <span className="text-lg">{zodiac.symbol}</span>
                        {zodiac.name}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Stones */}
              <Card className="mb-6 p-4">
                <h3 className="font-serif font-medium mb-2">{t('productPage.stonesUsed', { stones: stones.join(', ') })}</h3>
                <p className="text-small">{productStonesMeaning}</p>
              </Card>

              {/* Size selector */}
              <div className="mb-6">
                <h3 className="font-serif font-medium mb-3">{t('productPage.selectSize')}</h3>
                <ToggleGroup
                  type="single"
                  value={selectedSize ?? ''}
                  onValueChange={(value) => value && setSelectedSize(value)}
                  variant="outline"
                  className="justify-start"
                >
                  {['S', 'M', 'L', 'XL'].map((size) => (
                    <ToggleGroupItem
                      key={size}
                      value={size}
                      className="min-w-[48px] data-[state=on]:bg-foreground data-[state=on]:text-background"
                    >
                      {size}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                {!selectedSize && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {t('productPage.selectSizeHint', { defaultValue: 'Please choose a size before adding to cart.' })}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-4 mt-auto">
                <Button
                  size="lg"
                  onClick={handleAddToCart}
                  disabled={!selectedSize}
                  className="flex-1 h-12"
                >
                  <ShoppingCart size={18} />
                  {t('buttons.addToCart')}
                </Button>
                <Button size="icon" variant="outline" className="w-12 h-12 rounded-full" aria-label="Save">
                  <Heart size={18} />
                </Button>
              </div>

              {/* Trust badges */}
              <Separator className="my-6" />
              <div className="flex flex-wrap gap-2 text-muted-foreground">
                <Badge variant="outline" className="gap-1 text-xs font-normal">
                  <ShieldCheck size={12} />
                  {t('productPage.trust.handmade')}
                </Badge>
                <Badge variant="outline" className="gap-1 text-xs font-normal">
                  <Zap size={12} />
                  {t('productPage.trust.naturalStones')}
                </Badge>
                <Badge variant="outline" className="gap-1 text-xs font-normal">
                  <Truck size={12} />
                  {t('productPage.trust.freeShipping')}
                </Badge>
              </div>
            </motion.div>
          </div>

          {/* Related products */}
          {relatedProducts.length > 0 && (
            <section className="mt-20">
              <h2 className="heading-section mb-8">{t('productPage.relatedTitle')}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {relatedProducts.map((relatedProduct, index) => (
                  <ProductCard key={relatedProduct.id} product={relatedProduct} index={index} />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ProductDetailPage;
