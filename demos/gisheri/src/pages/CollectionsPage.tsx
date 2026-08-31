import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Seo from '@/components/Seo';
import ProductCard from '@/components/products/ProductCard';
import { type Purpose } from '@/data/products';
import { useCollections, useProducts } from '@/hooks/use-catalog';
import { useTranslation } from 'react-i18next';
import { tCollectionDescription, tCollectionName } from '@/lib/catalog-i18n';

const CollectionsPage = () => {
  const { t } = useTranslation();
  const { slug } = useParams<{ slug: string }>();
  const { data: collections = [] } = useCollections();
  const { data: products = [] } = useProducts();
  const selectedCollection = slug ? collections.find((c) => c.slug === slug) : null;
  const matchingProducts = slug
    ? products.filter((p) => p.purposes.includes(slug as Purpose))
    : products;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const url = typeof window !== 'undefined' ? window.location.href : '';
  const collectionName = selectedCollection ? tCollectionName(t, selectedCollection) : null;
  const collectionDescription = selectedCollection ? tCollectionDescription(t, selectedCollection) : null;
  const pageTitle = collectionName
    ? t('seo.pages.collection.title', { name: collectionName })
    : t('seo.pages.collections.title');
  const pageDescription = collectionDescription ?? t('seo.pages.collections.description');

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
        <section className="bg-gradient-section py-16 md:py-24 px-4 relative overflow-hidden">
          <div className="absolute inset-0 bg-pattern-dots opacity-10" />

          <div className="container-main relative z-10">
            {selectedCollection ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center"
              >
                <Link
                  to="/collections"
                  className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors"
                >
                  ← {t('collectionsPage.allCollections')}
                </Link>
                <h1 className="heading-hero mb-4">{tCollectionName(t, selectedCollection)}</h1>
                <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
                  {tCollectionDescription(t, selectedCollection)}
                </p>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center"
              >
                <h1 className="heading-hero mb-4">{t('collectionsPage.title')}</h1>
                <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
                  {t('collectionsPage.description')}
                </p>
              </motion.div>
            )}
          </div>
        </section>

        {/* Collection Grid */}
        {!selectedCollection && (
          <section className="container-main py-12 px-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 md:gap-6">
              {collections.map((collection, index) => (
                <motion.div
                  key={collection.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Link
                    to={`/collections/${collection.slug}`}
                    className="group block relative rounded-2xl overflow-hidden aspect-[4/5] hover-lift"
                  >
                    <img
                      src={collection.image}
                      alt={tCollectionName(t, collection)}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                      <h3 className="font-serif font-medium text-lg mb-1 group-hover:text-gold-light transition-colors drop-shadow-md">
                        {tCollectionName(t, collection)}
                      </h3>
                      <p className="text-sm text-white/90 drop-shadow-sm">{tCollectionDescription(t, collection)}</p>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* Products */}
        <section className="container-main section-padding">
          <h2 className="heading-section mb-8">
            {selectedCollection
              ? t('collectionsPage.braceletsForCollection', { name: tCollectionName(t, selectedCollection) })
              : t('collectionsPage.featuredPieces')}
          </h2>
          {matchingProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {matchingProducts.map((product, index) => (
                <ProductCard key={product.id} product={product} index={index} />
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-12">
              {t('collectionsPage.empty')}
            </p>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default CollectionsPage;
