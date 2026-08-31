import { motion } from 'framer-motion';
import { Gem, Leaf, Heart, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const features = [
  {
    icon: Gem,
    key: 'genuine',
  },
  {
    icon: Leaf,
    key: 'ethical',
  },
  {
    icon: Heart,
    key: 'love',
  },
  {
    icon: Sparkles,
    key: 'cleansed',
  },
];

const WhyStonesSection = () => {
  const { t } = useTranslation();

  return (
    <section className="section-padding bg-secondary/30">
      <div className="container-main">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="heading-section mb-4">{t('home.whyStones.title')}</h2>
          <p className="text-body max-w-2xl mx-auto">
            {t('home.whyStones.description')}
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.key}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="bg-card rounded-2xl p-6 text-center hover-lift border border-border/50"
            >
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-secondary mb-4">
                <feature.icon className="w-7 h-7 text-gold" />
              </div>
              <h3 className="heading-card mb-3">{t(`home.whyStones.features.${feature.key}.title`)}</h3>
              <p className="text-small">{t(`home.whyStones.features.${feature.key}.description`)}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhyStonesSection;
