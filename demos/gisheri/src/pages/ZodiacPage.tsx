import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Seo from '@/components/Seo';
import ProductCard from '@/components/products/ProductCard';
import { type ZodiacSign } from '@/data/products';
import { useProducts, useZodiacInfo } from '@/hooks/use-catalog';
import { useTranslation } from 'react-i18next';
import { tStone, tZodiacInfo } from '@/lib/catalog-i18n';

const ZodiacPage = () => {
  const { t } = useTranslation();
  const { sign } = useParams<{ sign: string }>();
  const { data: zodiacData = [] } = useZodiacInfo();
  const { data: products = [] } = useProducts();
  const localizedZodiacData = zodiacData.map((z) => tZodiacInfo(t, z));
  const selectedZodiac = sign ? localizedZodiacData.find((z) => z.sign === sign) : null;
  const matchingProducts = sign
    ? products.filter((p) => p.zodiacSigns.includes(sign as ZodiacSign))
    : products;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const url = typeof window !== 'undefined' ? window.location.href : '';
  const pageTitle = selectedZodiac
    ? t('seo.pages.zodiacSign.title', { sign: selectedZodiac.name })
    : t('seo.pages.zodiac.title');
  const pageDescription = selectedZodiac
    ? t('seo.pages.zodiacSign.description', { sign: selectedZodiac.name })
    : t('seo.pages.zodiac.description');

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title={pageTitle}
        description={pageDescription}
        type="CollectionPage"
        jsonLd={url ? {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: pageTitle,
          description: pageDescription,
          url,
          isPartOf: origin ? { '@type': 'WebSite', name: t('seo.siteName', { defaultValue: 'Gisheri' }), url: origin } : undefined,
        } : undefined}
      />
      <Header />
      <main className="pt-20">
        {/* Hero */}
        <section className="bg-primary text-primary-foreground py-16 md:py-24 px-4 relative overflow-hidden">
          <div className="absolute inset-0 bg-pattern-dots opacity-10" />
          <div className="absolute top-0 right-0 w-96 h-96 bg-gold/10 rounded-full blur-3xl" />

          <div className="container-main relative z-10">
            {selectedZodiac ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center"
              >
                <Link
                  to="/zodiac"
                  className="inline-flex items-center gap-2 text-primary-foreground/70 hover:text-primary-foreground mb-4 transition-colors"
                >
                  ← {t('zodiacPage.allZodiacSigns')}
                </Link>
                <motion.span
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl block mb-4"
                >
                  {selectedZodiac.symbol}
                </motion.span>
                <h1 className="heading-hero mb-2">{selectedZodiac.name}</h1>
                <p className="text-primary-foreground/80 text-lg mb-4">{selectedZodiac.dates}</p>
                <p className="text-primary-foreground/70 mb-6">
                  {t('zodiacPage.elementSign', { element: selectedZodiac.element })}
                </p>
                <p className="text-primary-foreground/90 max-w-2xl mx-auto text-lg">
                  {selectedZodiac.description}
                </p>
                <div className="mt-8">
                  <p className="text-primary-foreground/70 mb-3">{t('zodiacPage.recommendedStones')}</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {selectedZodiac.stones.map((stone) => (
                      <Badge
                        key={stone}
                        variant="outline"
                        className="bg-primary-foreground/10 text-primary-foreground border-primary-foreground/20 text-sm"
                      >
                        {tStone(t, stone)}
                      </Badge>
                    ))}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center"
              >
                <h1 className="heading-hero mb-4">{t('zodiacPage.title')}</h1>
                <p className="text-primary-foreground/80 max-w-2xl mx-auto text-lg">
                  {t('zodiacPage.description')}
                </p>
              </motion.div>
            )}
          </div>
        </section>

        {/* Zodiac selector */}
        {!selectedZodiac && (
          <section className="container-main py-12 px-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {localizedZodiacData.map((zodiac, index) => (
                <motion.div
                  key={zodiac.sign}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Link to={`/zodiac/${zodiac.sign}`} className="group block">
                    <Card className="text-center px-3 py-5 transition-shadow hover:shadow-md cursor-pointer">
                      <span className="text-4xl mb-2 block group-hover:scale-110 transition-transform">
                        {zodiac.symbol}
                      </span>
                      <span className="font-serif font-medium block">{zodiac.name}</span>
                      <span className="text-xs text-muted-foreground mt-1 block">{zodiac.dates}</span>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* Products */}
        <section className="container-main section-padding">
          <h2 className="heading-section mb-8">
            {selectedZodiac ? t('zodiacPage.braceletsFor', { name: selectedZodiac.name }) : t('zodiacPage.featured')}
          </h2>
          {matchingProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {matchingProducts.map((product, index) => (
                <ProductCard key={product.id} product={product} index={index} />
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-12">
              {t('zodiacPage.empty')}
            </p>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default ZodiacPage;
