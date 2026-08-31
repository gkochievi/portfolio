import { Link } from 'react-router-dom';
import { Menu, ShoppingBag, Search, Sun, Moon, User, LogOut, LayoutDashboard, UserCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import SearchDialog from '@/components/SearchDialog';
import Banner from '@/components/layout/Banner';
import { useTranslation } from 'react-i18next';
import { useThemeTransition } from '@/hooks/use-theme-transition';
import { useCart } from '@/context/cart';
import { useAuth } from '@/context/auth';

const navLinks = [
  { key: 'nav.shop', href: '/shop' },
  { key: 'nav.zodiac', href: '/zodiac' },
  { key: 'nav.collections', href: '/collections' },
  { key: 'nav.quiz', href: '/quiz' },
  { key: 'nav.about', href: '/about' },
];

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { t, i18n } = useTranslation();
  const { resolvedTheme, toggleTheme } = useThemeTransition();
  const { totalItems } = useCart();
  const { user, isAuthenticated, logout } = useAuth();

  useEffect(() => {
    setMounted(true);
    const onKeyDown = (e: KeyboardEvent) => {
      const isK = e.key.toLowerCase() === 'k';
      if ((e.metaKey || e.ctrlKey) && isK) {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleLanguageChange = (val: string) => {
    if (val) i18n.changeLanguage(val);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
      <Banner />
      <nav className="container-main">
        <div className="flex items-center justify-between h-16 md:h-20 px-4 md:px-8">
          {/* Mobile menu button */}
          <button
            onClick={() => setIsMenuOpen(true)}
            className="md:hidden p-2.5 -ml-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-foreground hover:text-primary transition-colors"
            aria-label="Toggle menu"
          >
            <Menu size={24} />
          </button>

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <span className="text-xl md:text-2xl font-serif font-medium tracking-tight">
              <span className="text-gradient-gold">{t('brand.stone')}</span>
              <span className="text-foreground">{t('brand.soul')}</span>
            </span>
          </Link>

          {/* Desktop navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.key}
                to={link.href}
                className="nav-link text-sm uppercase tracking-wider"
              >
                {t(link.key)}
              </Link>
            ))}
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-1 sm:gap-2 md:gap-4">
            <div className="hidden md:block">
              <ToggleGroup
                type="single"
                value={i18n.language}
                onValueChange={handleLanguageChange}
                size="sm"
                variant="outline"
              >
                <ToggleGroupItem value="en" aria-label="English">
                  {t('language.en')}
                </ToggleGroupItem>
                <ToggleGroupItem value="ka" aria-label="Georgian">
                  {t('language.ka')}
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            <button
              className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center text-foreground/80 hover:text-foreground transition-colors"
              onClick={() => setIsSearchOpen(true)}
              aria-label={t('actions.openSearch')}
            >
              <Search size={20} />
            </button>
            <button
              type="button"
              className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center text-foreground/80 hover:text-foreground transition-colors"
              onClick={(e) => toggleTheme(e)}
              aria-label={t('actions.toggleTheme', { defaultValue: 'Toggle theme' })}
            >
              {mounted && resolvedTheme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {/* User menu */}
            {isAuthenticated && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center text-foreground/80 hover:text-foreground transition-colors"
                    aria-label={t('account.title', { defaultValue: 'My account' })}
                  >
                    <UserCircle size={20} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium truncate">
                        {user.firstName ? `${user.firstName} ${user.lastName}`.trim() : user.email}
                      </span>
                      <span className="text-xs text-muted-foreground capitalize">{user.role}</span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/account" className="cursor-pointer">
                      <UserCircle size={16} className="mr-2" />
                      {t('account.title', { defaultValue: 'My account' })}
                    </Link>
                  </DropdownMenuItem>
                  {user.isStaffRole && (
                    <DropdownMenuItem asChild>
                      <Link to="/admin" className="cursor-pointer">
                        <LayoutDashboard size={16} className="mr-2" />
                        {t('account.admin', { defaultValue: 'Admin' })}
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="cursor-pointer">
                    <LogOut size={16} className="mr-2" />
                    {t('account.signOut', { defaultValue: 'Sign out' })}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link
                to="/login"
                className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center text-foreground/80 hover:text-foreground transition-colors"
                aria-label={t('auth.signIn', { defaultValue: 'Sign in' })}
              >
                <User size={20} />
              </Link>
            )}

            <Link
              to="/cart"
              className="relative p-3 min-w-[44px] min-h-[44px] flex items-center justify-center text-foreground/80 hover:text-foreground transition-colors"
              aria-label={t('cartPage.title')}
            >
              <ShoppingBag size={20} className="text-foreground/80" />
              {totalItems > 0 && (
                <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-medium text-primary-foreground">
                  {totalItems}
                </span>
              )}
            </Link>
          </div>
        </div>
      </nav>

      <SearchDialog open={isSearchOpen} onOpenChange={setIsSearchOpen} />

      {/* Mobile drawer menu */}
      <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <SheetContent side="left" className="w-[300px] p-0">
          <SheetHeader className="border-b px-6 py-4">
            <SheetTitle className="text-left">
              <span className="font-serif font-medium text-lg">
                <span className="text-gradient-gold">{t('brand.stone')}</span>
                <span>{t('brand.soul')}</span>
              </span>
            </SheetTitle>
          </SheetHeader>
          <div className="px-6 py-4">
            <div className="mb-6">
              <ToggleGroup
                type="single"
                value={i18n.language}
                onValueChange={handleLanguageChange}
                variant="outline"
                className="w-full"
              >
                <ToggleGroupItem value="en" className="flex-1">
                  {t('language.en')}
                </ToggleGroupItem>
                <ToggleGroupItem value="ka" className="flex-1">
                  {t('language.ka')}
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            <div className="space-y-1">
              {navLinks.map((link, index) => (
                <motion.div
                  key={link.key}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.08 }}
                >
                  <Link
                    to={link.href}
                    onClick={() => setIsMenuOpen(false)}
                    className="block py-3 px-2 text-lg font-medium text-foreground hover:text-primary transition-colors rounded-lg hover:bg-secondary/50"
                  >
                    {t(link.key)}
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
};

export default Header;
