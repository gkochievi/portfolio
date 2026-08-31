import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { pickLang, useSiteSettings } from '@/hooks/use-site-settings';

/**
 * Top-of-site marketing banner. Renders only when `bannerActive` is true
 * and a localized text exists. Lives above the Header.
 */
const Banner = () => {
  const { i18n } = useTranslation();
  const { data: settings } = useSiteSettings();

  if (!settings?.bannerActive) return null;
  const text = pickLang(settings.bannerTextEn, settings.bannerTextKa, i18n.language);
  if (!text) return null;

  const content = (
    <div className="bg-foreground text-background text-center text-xs md:text-sm py-2 px-4">
      {text}
    </div>
  );

  return settings.bannerLink ? (
    <Link to={settings.bannerLink} className="block hover:opacity-90 transition-opacity">
      {content}
    </Link>
  ) : (
    content
  );
};

export default Banner;
