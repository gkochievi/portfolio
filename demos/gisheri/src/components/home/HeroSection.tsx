import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import heroBracelets from '@/assets/hero-bracelets.jpg';
import { useTranslation } from 'react-i18next';
import { formatMoneyGEL } from '@/lib/money';
import { pickLang, useSiteSettings } from '@/hooks/use-site-settings';

const HeroSection = () => {
  const { t, i18n } = useTranslation();
  const { data: settings } = useSiteSettings();

  // Custom overrides from admin — fall back to i18n strings when blank
  const customTitle = settings ? pickLang(settings.heroTitleEn, settings.heroTitleKa, i18n.language) : '';
  const customSubtitle = settings ? pickLang(settings.heroSubtitleEn, settings.heroSubtitleKa, i18n.language) : '';
  const customCtaLabel = settings ? pickLang(settings.heroCtaLabelEn, settings.heroCtaLabelKa, i18n.language) : '';
  const customCtaLink = settings?.heroCtaLink || '/zodiac';
  const customImage = settings?.heroImage || '';

  return (
    <section className="relative min-h-screen flex items-center bg-gradient-hero overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-pattern-dots opacity-30" />
      
      {/* Content */}
      <div className="container-main relative z-10 pt-20 pb-12 px-4 md:px-8">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Text content */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="order-2 md:order-1"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-secondary/50 rounded-full mb-6"
            >
              <span className="w-2 h-2 rounded-full bg-gold animate-pulse" />
              <span className="text-sm text-muted-foreground">{t('home.hero.badge')}</span>
            </motion.div>

            {customTitle ? (
              <h1 className="heading-hero mb-4 md:mb-6">
                <span className="text-gradient-gold">{customTitle}</span>
              </h1>
            ) : (
              <h1 className="heading-hero mb-4 md:mb-6">
                {t('home.hero.titleLine1')}{' '}
                <span className="block text-gradient-gold h-[140px] pt-2.5 pb-2.5">{t('home.hero.titleLine2')}</span>
              </h1>
            )}

            {customSubtitle ? (
              <p className="text-body text-lg mb-8 max-w-lg whitespace-pre-line">{customSubtitle}</p>
            ) : (
              <>
                <p className="text-body text-lg mb-4">{t('home.hero.subline')}</p>
                <p className="text-body mb-8 max-w-lg">{t('home.hero.description')}</p>
              </>
            )}

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <Link
                to={customCtaLink}
                className="btn-gold flex items-center justify-center gap-2 group text-sm md:text-base px-6 py-2.5 md:px-8 md:py-3"
              >
                {customCtaLabel || t('home.hero.ctaZodiac')}
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link to="/quiz" className="btn-secondary flex items-center justify-center gap-2 text-sm md:text-base px-6 py-2.5 md:px-8 md:py-3">
                {t('home.hero.ctaQuiz')}
              </Link>
            </div>

            {/* Trust badges */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="flex flex-wrap gap-2 md:gap-3 mt-6 md:mt-10"
            >
              <span className="trust-badge text-xs md:text-sm px-3 py-1.5 md:px-4 md:py-2">{t('home.hero.trustBadges.handmade')}</span>
              <span className="trust-badge text-xs md:text-sm px-3 py-1.5 md:px-4 md:py-2">{t('home.hero.trustBadges.naturalStones')}</span>
              <span className="trust-badge text-xs md:text-sm px-3 py-1.5 md:px-4 md:py-2">{t('home.hero.trustBadges.ethical')}</span>
            </motion.div>
          </motion.div>

          {/* Hero image */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="order-1 md:order-2 relative"
          >
            <div className="relative rounded-3xl overflow-hidden shadow-elevated">
              <img
                src={customImage || heroBracelets}
                alt={t('home.hero.imageAlt')}
                className="w-full h-auto object-cover"
              />
              {/* Overlay gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent" />
            </div>

            {/* Floating badge - hidden on very small screens */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 }}
              className="hidden sm:block absolute bottom-2 left-2 md:bottom-8 md:left-8 bg-card/95 backdrop-blur-sm rounded-xl md:rounded-2xl p-3 md:p-4 shadow-lg border border-border"
            >
              <p className="text-xs md:text-sm font-medium text-foreground">{t('home.hero.floating.newArrivals')}</p>
              <p className="text-[10px] md:text-xs text-muted-foreground">{t('home.hero.floating.chakraCollection')}</p>
            </motion.div>

            {/* Floating badge 2 - hidden on very small screens */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 }}
              className="hidden sm:block absolute top-2 right-2 md:top-8 md:right-8 bg-primary text-primary-foreground rounded-xl md:rounded-2xl px-3 py-1.5 md:px-4 md:py-2 shadow-lg"
            >
              <p className="text-xs md:text-sm font-medium">{t('home.hero.floating.freeShipping')}</p>
              <p className="text-[10px] md:text-xs opacity-80">{t('home.hero.floating.ordersOver', { amount: formatMoneyGEL(50) })}</p>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator - hidden on small screens */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="hidden md:block absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <div className="w-6 h-10 border-2 border-muted-foreground/30 rounded-full flex items-start justify-center p-1">
          <motion.div
            animate={{ y: [0, 12, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-1.5 h-3 bg-gold rounded-full"
          />
        </div>
      </motion.div>
    </section>
  );
};

export default HeroSection;
