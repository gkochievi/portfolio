import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Seo from '@/components/Seo';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import HeroSection from '@/components/home/HeroSection';
import CollectionsSection from '@/components/home/CollectionsSection';
import BestsellersSection from '@/components/home/BestsellersSection';
import ZodiacSection from '@/components/home/ZodiacSection';
import WhyStonesSection from '@/components/home/WhyStonesSection';
import QuizCTASection from '@/components/home/QuizCTASection';

const Index = () => {
  const { t } = useTranslation();
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const siteName = t('seo.siteName', { defaultValue: 'Gisheri' });
  // The shop's own absolute root. Under the portfolio that is
  // `https://host/demos/gisheri/`, not `https://host/` — every URL in the
  // structured data below has to be built from it rather than from the origin,
  // or it describes the portfolio shell instead of this shop.
  const siteUrl = origin ? new URL(import.meta.env.BASE_URL, origin).href : '';
  const jsonLd = useMemo(() => {
    if (!origin) return undefined;
    return [
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: siteName,
        url: siteUrl,
        potentialAction: {
          '@type': 'SearchAction',
          target: `${siteUrl}shop?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: siteName,
        url: siteUrl,
        // Upstream hard-coded `${origin}/favicon.ico`, which is a dead URL as soon as
        // the app is served from a sub-path: the mark lives under the deploy base, not
        // at the host root. `BASE_URL` always ends in a slash, so resolving it against
        // the origin gives the absolute URL structured data insists on.
        logo: new URL(`${import.meta.env.BASE_URL}brand/favicon.svg`, origin).href,
      },
    ];
  }, [origin, siteUrl, siteName]);

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title={t('seo.pages.home.title')}
        description={t('seo.pages.home.description')}
        jsonLd={jsonLd}
      />
      <Header />
      <main>
        <HeroSection />
        <CollectionsSection />
        <BestsellersSection />
        <ZodiacSection />
        <WhyStonesSection />
        <QuizCTASection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
