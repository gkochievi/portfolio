import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useZodiacInfo } from '@/hooks/use-catalog';
import { useTranslation } from 'react-i18next';
import { tZodiacInfo } from '@/lib/catalog-i18n';

const ZodiacSection = () => {
  const { t } = useTranslation();
  const { data: zodiacData = [] } = useZodiacInfo();
  const localizedZodiacData = zodiacData.map((z) => tZodiacInfo(t, z));

  return (
    <section className="section-padding bg-primary text-primary-foreground overflow-hidden">
      <div className="container-main relative">
        {/* Background decorations */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gold/10 dark:bg-gold/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gold/5 dark:bg-gold/15 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-foreground/5 dark:bg-gold/5 rounded-full blur-3xl hidden dark:block" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12 relative z-10"
        >
          <h2 className="heading-section mb-4">{t('home.zodiac.title')}</h2>
          <p className="text-primary-foreground/80 max-w-2xl mx-auto">
            {t('home.zodiac.description')}
          </p>
        </motion.div>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 sm:gap-4 md:gap-5 relative z-10">
          {localizedZodiacData.map((zodiac, index) => (
            <motion.div
              key={zodiac.sign}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
            >
              <Link
                to={`/zodiac/${zodiac.sign}`}
                className="card-zodiac flex flex-col items-center text-center group px-3 py-4 sm:px-4 sm:py-5 md:px-5 md:py-7 min-h-[120px] sm:min-h-[140px] md:min-h-[180px]"
              >
                <span className="zodiac-symbol text-2xl sm:text-3xl md:text-4xl mb-1.5 sm:mb-2 group-hover:scale-110 transition-all duration-300">
                  {zodiac.symbol}
                </span>
                <div className="w-full">
                  <div className="min-h-[2rem] sm:min-h-[2.5rem] md:min-h-[2.75rem] flex items-center justify-center">
                    <span className="font-medium leading-tight text-primary-foreground break-words text-[10px] sm:text-xs md:text-sm">
                      {zodiac.name}
                    </span>
                  </div>
                  <span className="text-[10px] md:text-xs text-primary-foreground/60 mt-1 hidden sm:block">
                    {zodiac.dates.split(' - ')[0]}
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-center mt-8 md:mt-10 relative z-10"
        >
          <Link
            to="/zodiac"
            className="inline-flex items-center gap-2 px-6 py-2.5 md:px-8 md:py-3 bg-gold text-gold-foreground rounded-full font-medium text-sm md:text-base hover:opacity-90 transition-opacity"
          >
            {t('home.zodiac.exploreAll')}
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default ZodiacSection;
