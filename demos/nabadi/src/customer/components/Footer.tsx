import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, Mail, MapPin, Phone } from 'lucide-react';
import { Logo } from './Logo';
import { Container } from './Container';
import { FacebookIcon, InstagramIcon } from './SocialIcons';
import { useBusinessInfo } from '@/features/landing/hooks';

export function Footer() {
  const { t } = useTranslation();
  const { t: tNav } = useTranslation('nav');
  const { t: tHome } = useTranslation('home');
  // Business contact + socials from the /landing/ payload; falls back to the
  // brand locale address / project facebook URL, hides phone/email/instagram
  // rows entirely when the shop hasn't provided them.
  const biz = useBusinessInfo();
  const year = new Date().getFullYear();

  return (
    <footer className="bg-ink text-bg mt-24 rounded-t-[24px]">
      <Container size="xl" className="py-16 md:py-20">
        <div className="grid md:grid-cols-12 gap-10">
          <div className="md:col-span-5 flex flex-col gap-5">
            <Logo size="lg" className="text-bg" />
            <p className="text-base text-bg/70 leading-relaxed max-w-sm">
              {tHome('footer_tagline')}
            </p>
            <Link
              to="/book"
              className="inline-flex items-center gap-2 self-start mt-2 px-5 py-3 rounded-pill bg-accent hover:bg-bg hover:text-ink text-bg font-medium transition"
            >
              {tHome('cta_book')}
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="md:col-span-3 flex flex-col gap-3">
            {/* bg/60 (~5.9:1 on ink) — bg/40 fails AA at this size. */}
            <h3 className="text-xs font-medium uppercase tracking-[0.15em] text-bg/60">
              {tNav('menu')}
            </h3>
            <Link to="/" className="text-bg/80 hover:text-bg transition">
              {tNav('home')}
            </Link>
            <Link to="/services" className="text-bg/80 hover:text-bg transition">
              {tNav('services')}
            </Link>
            <Link to="/barbers" className="text-bg/80 hover:text-bg transition">
              {tNav('barbers')}
            </Link>
            <Link to="/about" className="text-bg/80 hover:text-bg transition">
              {tNav('about')}
            </Link>
            <Link to="/contact" className="text-bg/80 hover:text-bg transition">
              {tNav('contact')}
            </Link>
            <Link to="/book" className="text-bg/80 hover:text-bg transition">
              {tNav('book')}
            </Link>
          </div>

          <div className="md:col-span-4 flex flex-col gap-3">
            <h3 className="text-xs font-medium uppercase tracking-[0.15em] text-bg/60">
              {tHome('section_visit_title')}
            </h3>
            <a
              href={biz.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-start gap-2.5 text-bg/80 hover:text-bg transition"
            >
              <MapPin className="h-4 w-4 mt-1 shrink-0 text-accent" />
              <span>{biz.address}</span>
            </a>
            {biz.phone && (
              <a
                href={`tel:${biz.phone}`}
                className="inline-flex items-center gap-2.5 text-bg/80 hover:text-bg transition"
              >
                <Phone className="h-4 w-4 shrink-0 text-accent" />
                <span>{biz.phone}</span>
              </a>
            )}
            {biz.email && (
              <a
                href={`mailto:${biz.email}`}
                className="inline-flex items-center gap-2.5 text-bg/80 hover:text-bg transition"
              >
                <Mail className="h-4 w-4 shrink-0 text-accent" />
                <span>{biz.email}</span>
              </a>
            )}
            <div className="flex gap-4 mt-2 text-xs uppercase tracking-[0.15em]">
              <a
                href={biz.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-bg/60 hover:text-accent transition"
              >
                <FacebookIcon className="h-4 w-4" />
                Facebook
              </a>
              {biz.instagram && (
                <a
                  href={biz.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-bg/60 hover:text-accent transition"
                >
                  <InstagramIcon className="h-4 w-4" />
                  Instagram
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-bg/10 mt-14 pt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-bg/60">
          <span>
            © {year} {t('brand')}. {tHome('footer_rights')}
          </span>
          <span>{tHome('section_visit_hours')}</span>
        </div>
      </Container>
    </footer>
  );
}
