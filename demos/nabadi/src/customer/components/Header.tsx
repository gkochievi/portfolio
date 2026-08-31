import { Link, NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Menu, UserRound } from 'lucide-react';
import { Logo } from './Logo';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Button } from './Button';
import { Sheet, SheetContent, SheetTrigger, SheetClose, SheetTitle } from './Sheet';
import { Container } from './Container';
import { useMe } from '@/auth/hooks';
import { cn } from '@/lib/cn';
import { useEffect, useState } from 'react';

const links = [
  { to: '/', key: 'home' },
  { to: '/services', key: 'services' },
  { to: '/barbers', key: 'barbers' },
  { to: '/about', key: 'about' },
  { to: '/contact', key: 'contact' },
] as const;

export function Header() {
  const { t } = useTranslation('nav');
  const me = useMe();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-40 transition-all duration-200',
        scrolled ? 'bg-bg border-b border-line' : 'bg-transparent border-b border-transparent',
      )}
    >
      <Container size="xl">
        <div className="flex items-center justify-between py-3">
          <Link to="/" className="hover:opacity-80 transition" aria-label={t('home')}>
            {/* Tighter logo on small screens so the sticky bar stays light. */}
            <Logo size="md" className="h-14 md:h-20" />
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'px-4 py-2 rounded-pill text-[15px] transition-colors',
                    isActive
                      ? 'text-ink bg-line/60'
                      : 'text-ink-muted hover:text-ink hover:bg-line/40',
                  )
                }
              >
                {t(link.key)}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2 md:gap-3">
            <LanguageSwitcher />
            <div className="hidden md:flex items-center gap-3">
              {me.data ? (
                <Link
                  to="/profile"
                  className="inline-flex items-center justify-center w-10 h-10 rounded-pill bg-line/50 text-ink hover:bg-line transition"
                  aria-label={t('profile')}
                >
                  <UserRound className="h-4 w-4" />
                </Link>
              ) : (
                <Link
                  to="/login"
                  className="text-[15px] text-ink-muted hover:text-ink transition px-3"
                >
                  {t('login')}
                </Link>
              )}
              <Button asChild size="sm" variant="accent" className="rounded-pill">
                <Link to="/book">{t('book')}</Link>
              </Button>
            </div>
            {/* Keep the primary conversion CTA visible in the mobile bar —
                not one tap deeper inside the sheet. */}
            <Button asChild size="sm" variant="accent" className="rounded-pill md:hidden">
              <Link to="/book">{t('book')}</Link>
            </Button>
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-pill bg-line/50 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                  aria-label={t('menu')}
                >
                  <Menu className="h-5 w-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-3/4 sm:w-80">
                <SheetTitle className="sr-only">{t('menu_title')}</SheetTitle>
                <div className="flex flex-col gap-6 mt-4">
                  <Logo size="md" />
                  <nav className="flex flex-col gap-1">
                    {links.map((link) => (
                      <SheetClose asChild key={link.to}>
                        <NavLink
                          to={link.to}
                          end={link.to === '/'}
                          className={({ isActive }) =>
                            cn(
                              'py-3 text-lg transition border-b border-line',
                              isActive ? 'text-ink font-medium' : 'text-ink-muted',
                            )
                          }
                        >
                          {t(link.key)}
                        </NavLink>
                      </SheetClose>
                    ))}
                    <SheetClose asChild>
                      <NavLink
                        to="/book"
                        className="py-3 text-lg text-accent font-medium border-b border-line"
                      >
                        {t('book')}
                      </NavLink>
                    </SheetClose>
                    <SheetClose asChild>
                      <NavLink
                        to={me.data ? '/profile' : '/login'}
                        className="py-3 text-lg text-ink-muted border-b border-line"
                      >
                        {me.data ? t('profile') : t('login')}
                      </NavLink>
                    </SheetClose>
                  </nav>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </Container>
    </header>
  );
}
