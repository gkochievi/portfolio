import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useProducts } from '@/hooks/use-catalog';
import ProductCard from '@/components/products/ProductCard';
import { useTranslation } from 'react-i18next';

const BestsellersSection = () => {
  const { t } = useTranslation();
  const { data: products = [] } = useProducts();
  const bestsellers = products.filter((p) => p.isBestseller);

  return (
    <section className="section-padding">
      <div className="container-main">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12"
        >
          <div>
            <h2 className="heading-section mb-4">{t('home.bestsellers.title')}</h2>
            <p className="text-body max-w-xl">
              {t('home.bestsellers.description')}
            </p>
          </div>
          <Link
            to="/shop"
            className="inline-flex items-center gap-2 text-primary font-medium hover:text-gold transition-colors group"
          >
            {t('home.bestsellers.viewAll')}
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {bestsellers.map((product, index) => (
            <ProductCard key={product.id} product={product} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default BestsellersSection;
