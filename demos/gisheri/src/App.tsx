import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Routes, Route, useLocation } from "react-router-dom";
import ScrollToTop from "@/components/ScrollToTop";
import { ThemeProvider } from "@/components/theme-provider";
import { CartProvider } from "@/context/cart";
import { AuthProvider } from "@/context/auth";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import DemoBanner from "@/components/demo/DemoBanner";
import { APP_BASE, HASH_ROUTING } from "@/demo/base-path";
import Index from "./pages/Index";
import ShopPage from "./pages/ShopPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import ZodiacPage from "./pages/ZodiacPage";
import QuizPage from "./pages/QuizPage";
import CollectionsPage from "./pages/CollectionsPage";
import AboutPage from "./pages/AboutPage";
import CartPage from "./pages/CartPage";
import NotFound from "./pages/NotFound";
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";
import AccountPage from "./pages/auth/AccountPage";
import OrderDetailPage from "./pages/OrderDetailPage";

// Admin pages — lazy-loaded so customers don't ship admin code.
// All admin chunks share an "admin-*" name prefix via Vite's automatic
// chunk naming, so the browser fetches them together on first /admin hit
// and caches them for subsequent navigations.
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminDashboardPage = lazy(() => import("./pages/admin/AdminDashboardPage"));
const ProductsListPage = lazy(() => import("./pages/admin/ProductsListPage"));
const ProductEditPage = lazy(() => import("./pages/admin/ProductEditPage"));
const OrdersListPage = lazy(() => import("./pages/admin/OrdersListPage"));
const OrderCreatePage = lazy(() => import("./pages/admin/OrderCreatePage"));
const AdminOrderDetailPage = lazy(() => import("./pages/admin/OrderDetailPage"));
const DiscountsListPage = lazy(() => import("./pages/admin/DiscountsListPage"));
const DiscountEditPage = lazy(() => import("./pages/admin/DiscountEditPage"));
const SiteSettingsPage = lazy(() => import("./pages/admin/SiteSettingsPage"));
const PageSeoListPage = lazy(() => import("./pages/admin/PageSeoListPage"));
const PageSeoEditPage = lazy(() => import("./pages/admin/PageSeoEditPage"));
const CollectionsListPage = lazy(() => import("./pages/admin/CollectionsListPage"));
const CollectionEditPage = lazy(() => import("./pages/admin/CollectionEditPage"));
const ZodiacListPage = lazy(() => import("./pages/admin/ZodiacListPage"));
const ZodiacEditPage = lazy(() => import("./pages/admin/ZodiacEditPage"));
const QuizConfigPage = lazy(() => import("./pages/admin/QuizConfigPage"));
const UsersListPage = lazy(() => import("./pages/admin/UsersListPage"));
const UserEditPage = lazy(() => import("./pages/admin/UserEditPage"));

// Import fonts
import "@fontsource/playfair-display/400.css";
import "@fontsource/playfair-display/500.css";
import "@fontsource/playfair-display/600.css";
import "@fontsource/playfair-display/700.css";
import "@fontsource/noto-sans/300.css";
import "@fontsource/noto-sans/400.css";
import "@fontsource/noto-sans/500.css";
import "@fontsource/noto-sans/600.css";
// Georgian, bundled. Upstream pulled these two families from Google Fonts with
// an `@import` at the top of index.css; nothing here may reach a third-party
// origin at runtime, and `[lang="ka"]` names both families by hand in index.css,
// so without them half the app renders in a fallback the designer never saw.
import "@fontsource/noto-sans-georgian/400.css";
import "@fontsource/noto-sans-georgian/500.css";
import "@fontsource/noto-serif-georgian/400.css";
import "@fontsource/noto-serif-georgian/600.css";

const queryClient = new QueryClient();

/**
 * Upstream this was a bare `<BrowserRouter>`, because the SPA owned a domain
 * root. Here the same bundle is served from `/demos/gisheri/`, so the router
 * needs a basename or every `<Link to="/shop">` walks out of the demo and into
 * the portfolio's 404; and it may be built onto the hash router instead, which
 * is the escape hatch for a static host that cannot serve index.html for an
 * unknown path. `<HashRouter>` takes no basename — the `#` is the basename.
 *
 * `APP_BASE` is empty at a domain root and `<BrowserRouter>` rejects an empty
 * basename, hence the `|| "/"`.
 */
const DemoRouter = ({ children }: { children: ReactNode }) =>
  HASH_ROUTING ? (
    <HashRouter>{children}</HashRouter>
  ) : (
    <BrowserRouter basename={APP_BASE || "/"}>{children}</BrowserRouter>
  );

const SeoDefaults = () => {
  const location = useLocation();
  const { i18n } = useTranslation();

  useEffect(() => {
    if (typeof window === "undefined") return;
    // The router's `location` has the basename stripped (it re-runs this
    // effect on navigation); the document's own URL is what canonical/og:url
    // must carry, base path included.
    const url = `${window.location.origin}${window.location.pathname}${window.location.search}`;
    const isKa = i18n.language === "ka";
    const ogLocale = isKa ? "ka_GE" : "en_US";
    const ogLocaleAlt = isKa ? "en_US" : "ka_GE";

    const ensureMeta = (selector: string, attrs: Record<string, string>) => {
      let el = document.querySelector(selector) as HTMLMetaElement | HTMLLinkElement | null;
      if (!el) {
        el = document.createElement(attrs.rel ? "link" : "meta") as HTMLMetaElement | HTMLLinkElement;
        Object.entries(attrs).forEach(([key, value]) => el!.setAttribute(key, value));
        document.head.appendChild(el);
      }
      if (attrs.content) el.setAttribute("content", attrs.content);
      if (attrs.href) el.setAttribute("href", attrs.href);
    };

    ensureMeta('link[rel="canonical"]', { rel: "canonical", href: url });
    ensureMeta('meta[property="og:url"]', { property: "og:url", content: url });
    ensureMeta('meta[name="twitter:url"]', { name: "twitter:url", content: url });
    ensureMeta('meta[property="og:locale"]', { property: "og:locale", content: ogLocale });
    ensureMeta('meta[property="og:locale:alternate"]', { property: "og:locale:alternate", content: ogLocaleAlt });
  }, [location, i18n.language]);

  return null;
};

const AdminLoading = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="text-sm text-muted-foreground">Loading…</div>
  </div>
);

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
    <DemoRouter>
      <AuthProvider>
        <CartProvider>
          <ScrollToTop />
          <SeoDefaults />
          <QueryClientProvider client={queryClient}>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              {/* Inside the providers because it signs in through `useAuth`,
                  empties the cart through `useCart` and drops the query cache;
                  outside <Routes> so it survives an unrecognised path and is
                  still there to sign you in on the 404 page. */}
              <DemoBanner />
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/shop" element={<ShopPage />} />
                <Route path="/product/:id" element={<ProductDetailPage />} />
                <Route path="/zodiac" element={<ZodiacPage />} />
                <Route path="/zodiac/:sign" element={<ZodiacPage />} />
                <Route path="/quiz" element={<QuizPage />} />
                <Route path="/collections" element={<CollectionsPage />} />
                <Route path="/collections/:slug" element={<CollectionsPage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/cart" element={<CartPage />} />

                {/* Auth */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />

                {/* Authenticated */}
                <Route element={<ProtectedRoute />}>
                  <Route path="/account" element={<AccountPage />} />
                  <Route path="/orders/:id" element={<OrderDetailPage />} />
                </Route>

                {/* Staff/Admin — single Suspense boundary so all admin chunks share one fallback */}
                <Route element={<ProtectedRoute requireRole="staff" />}>
                  <Route
                    path="/admin"
                    element={
                      <Suspense fallback={<AdminLoading />}>
                        <AdminLayout />
                      </Suspense>
                    }
                  >
                    <Route index element={<AdminDashboardPage />} />
                    <Route path="products" element={<ProductsListPage />} />
                    <Route path="products/:id" element={<ProductEditPage />} />
                    <Route path="orders" element={<OrdersListPage />} />
                    <Route path="orders/new" element={<OrderCreatePage />} />
                    <Route path="orders/:id" element={<AdminOrderDetailPage />} />
                    <Route path="discounts" element={<DiscountsListPage />} />
                    <Route path="discounts/:id" element={<DiscountEditPage />} />
                    <Route path="settings" element={<SiteSettingsPage />} />
                    <Route path="page-seo" element={<PageSeoListPage />} />
                    <Route path="page-seo/:id" element={<PageSeoEditPage />} />
                    <Route path="collections" element={<CollectionsListPage />} />
                    <Route path="collections/:id" element={<CollectionEditPage />} />
                    <Route path="zodiac" element={<ZodiacListPage />} />
                    <Route path="zodiac/:sign" element={<ZodiacEditPage />} />
                    <Route path="quiz" element={<QuizConfigPage />} />
                  </Route>
                </Route>

                {/* Admin only */}
                <Route element={<ProtectedRoute requireRole="admin" />}>
                  <Route
                    path="/admin"
                    element={
                      <Suspense fallback={<AdminLoading />}>
                        <AdminLayout />
                      </Suspense>
                    }
                  >
                    <Route path="users" element={<UsersListPage />} />
                    <Route path="users/:id" element={<UserEditPage />} />
                  </Route>
                </Route>

                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </TooltipProvider>
          </QueryClientProvider>
        </CartProvider>
      </AuthProvider>
    </DemoRouter>
  </ThemeProvider>
);

export default App;
