import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Seo from "@/components/Seo";

const NotFound = () => {
  const { t } = useTranslation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      window.location?.pathname
    );
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Seo
        title={t("seo.pages.notFound.title")}
        description={t("seo.pages.notFound.description")}
        robots="noindex,nofollow"
      />
      <div className="text-center max-w-md">
        <h1 className="font-serif text-6xl sm:text-7xl font-medium text-gold mb-4">404</h1>
        <p className="text-muted-foreground mb-8 text-lg">{t("notFound.title")}</p>
        {/* A root-absolute anchor is a full page load at the origin's root, which
            under `/demos/gisheri/` is the portfolio, not this shop's home. The
            router's <Link> resolves against the basename — and against the `#`
            under hash routing — which is the whole point of having one. */}
        <Link to="/">
          <Button size="lg">{t("notFound.returnHome")}</Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
