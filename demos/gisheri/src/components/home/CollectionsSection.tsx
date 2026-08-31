import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useCollections } from '@/hooks/use-catalog';
import { useTranslation } from 'react-i18next';
import { tCollectionDescription, tCollectionName } from '@/lib/catalog-i18n';

const CollectionsSection = () => {
  const { t } = useTranslation();
  const { data: collections = [] } = useCollections();

  return (
    <section className="section-padding bg-gradient-section">
      <div className="container-main">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="heading-section mb-4">{t('home.collections.title')}</h2>
          <p className="text-body max-w-2xl mx-auto">
            {t('home.collections.description')}
          </p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4 lg:gap-6">
          {collections.map((collection, index) => (
            <motion.div
              key={collection.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Link
                to={`/collections/${collection.slug}`}
                className="group block relative rounded-xl md:rounded-2xl overflow-hidden aspect-[4/5] hover-lift"
              >
                <img
                  src={collection.image}
                  alt={tCollectionName(t, collection)}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                {/* Overlay - always dark for text readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                
                {/* Content */}
                <div className="absolute bottom-0 left-0 right-0 p-3 md:p-4 text-white">
                  <h3 className="font-serif font-medium text-sm sm:text-base md:text-lg mb-0.5 md:mb-1 group-hover:text-gold-light transition-colors drop-shadow-md line-clamp-1">
                    {tCollectionName(t, collection)}
                  </h3>
                  <p className="text-xs md:text-sm text-white/90 drop-shadow-sm line-clamp-2 hidden sm:block">{tCollectionDescription(t, collection)}</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CollectionsSection;
