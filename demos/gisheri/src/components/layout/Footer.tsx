import { Link } from 'react-router-dom';
import { Instagram, Facebook, Mail, Heart } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from 'react-i18next';

const Footer = () => {
  const { t } = useTranslation();

  return (
    <footer className="bg-secondary/30 border-t border-border">
      <div className="container-main py-8 md:py-12 px-4 md:px-8">
        <div className="flex flex-col items-center text-center">
          {/* Brand */}
          <Link to="/" className="inline-block mb-3 md:mb-4">
            <span className="text-xl md:text-2xl font-serif font-medium">
              <span className="text-gradient-gold">{t('brand.stone')}</span>
              <span className="text-foreground">{t('brand.soul')}</span>
            </span>
          </Link>
          <p className="text-xs md:text-sm text-muted-foreground leading-relaxed mb-4 max-w-md">
            {t('footer.tagline')}
          </p>
          <TooltipProvider>
            <div className="flex items-center gap-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <a href="#" className="text-muted-foreground hover:text-gold transition-colors" aria-label="Instagram">
                    <Instagram size={20} />
                  </a>
                </TooltipTrigger>
                <TooltipContent>Instagram</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <a href="#" className="text-muted-foreground hover:text-gold transition-colors" aria-label="Facebook">
                    <Facebook size={20} />
                  </a>
                </TooltipTrigger>
                <TooltipContent>Facebook</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <a href="#" className="text-muted-foreground hover:text-gold transition-colors" aria-label="Email">
                    <Mail size={20} />
                  </a>
                </TooltipTrigger>
                <TooltipContent>Email</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>

        <Separator className="my-6 md:my-8" />

        <div className="flex flex-col md:flex-row items-center justify-between gap-3 md:gap-4">
          <p className="text-xs md:text-sm text-muted-foreground text-center md:text-left">
            {t('footer.copyright', { year: new Date().getFullYear() })}
          </p>
          <p className="text-xs md:text-sm text-muted-foreground flex items-center gap-1">
            {t('footer.madeWith.before')} <Heart size={14} fill="currentColor" className="text-purpose-love" /> {t('footer.madeWith.after')}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
