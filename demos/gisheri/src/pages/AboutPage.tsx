import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Seo from '@/components/Seo';
import { useTranslation } from 'react-i18next';

const AboutPage = () => {
  const { t } = useTranslation();
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const url = typeof window !== 'undefined' ? window.location.href : '';

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title={t('seo.pages.about.title')}
        description={t('seo.pages.about.description')}
        type="WebPage"
        jsonLd={url ? {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: t('seo.pages.about.title'),
          description: t('seo.pages.about.description'),
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
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center max-w-3xl mx-auto"
            >
              <h1 className="heading-hero mb-6">{t('aboutPage.heroTitle')}</h1>
              <p className="text-primary-foreground/80 text-lg">
                {t('aboutPage.heroDescription')}
              </p>
            </motion.div>
          </div>
        </section>

        {/* Mission */}
        <section className="container-main section-padding">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="heading-section mb-6">{t('aboutPage.missionTitle')}</h2>
              <p className="text-muted-foreground mb-4">
                {t('aboutPage.missionP1')}
              </p>
              <p className="text-muted-foreground">
                {t('aboutPage.missionP2')}
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="aspect-square rounded-2xl bg-gradient-section flex items-center justify-center"
            >
              <span className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl">✨</span>
            </motion.div>
          </div>
        </section>

        {/* Values */}
        <section className="bg-gradient-section section-padding">
          <div className="container-main">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="heading-section text-center mb-12"
            >
              {t('aboutPage.valuesTitle')}
            </motion.h2>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { icon: '🌍', key: 'ethical' },
                { icon: '💎', key: 'quality' },
                { icon: '🙏', key: 'intention' },
              ].map((value, index) => (
                <motion.div
                  key={value.key}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="text-center h-full p-6 transition-shadow hover:shadow-md">
                    <span className="text-4xl block mb-4">{value.icon}</span>
                    <h3 className="font-serif text-xl font-medium mb-2">{t(`aboutPage.values.${value.key}.title`)}</h3>
                    <p className="text-muted-foreground">{t(`aboutPage.values.${value.key}.description`)}</p>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default AboutPage;
