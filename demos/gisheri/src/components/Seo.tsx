import { useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAllPageSeo, useSiteSettings, pickLang } from "@/hooks/use-site-settings";

type SeoProps = {
  title: string;
  /**
   * Optional, and it was optional in practice upstream too: `AdminLayout`
   * renders <Seo> with a title and nothing else. Upstream never noticed,
   * because that tree is compiled with `strict: false` and its build never ran
   * tsc at all; this workspace does run it, and a required prop that one caller
   * omits is a TS2741 the moment anyone looks.
   *
   * Type-only. The runtime is unchanged: with no description and no per-page
   * override, `ensureMeta` finds the `<meta name="description">` index.html
   * already ships and its falsy-content guard leaves it alone — exactly what
   * happened before, since `undefined` was what that caller passed anyway.
   */
  description?: string;
  type?: string;
  image?: string;
  robots?: string;
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
};

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

export default function Seo({ title, description, type = "website", image, robots, jsonLd }: SeoProps) {
  const location = useLocation();
  const { i18n } = useTranslation();
  const { data: settings } = useSiteSettings();
  const { data: pageSeoList = [] } = useAllPageSeo();

  const override = useMemo(
    () => pageSeoList.find((p) => p.path === location.pathname),
    [pageSeoList, location.pathname],
  );

  const overrideTitle = override
    ? pickLang(override.titleEn, override.titleKa, i18n.language)
    : "";
  const overrideDescription = override
    ? pickLang(override.descriptionEn, override.descriptionKa, i18n.language)
    : "";

  // Resolution order: per-page override > prop > global default
  const resolvedTitle = overrideTitle || title;
  const resolvedDescription = overrideDescription || description || "";
  const resolvedImage = override?.ogImage || image || settings?.defaultOgImage || "";
  const resolvedRobots = override?.robots || robots || settings?.defaultRobots || "index,follow";

  useEffect(() => {
    if (typeof document === "undefined") return;

    document.title = resolvedTitle;
    ensureMeta('meta[name="description"]', { name: "description", content: resolvedDescription });
    ensureMeta('meta[name="robots"]', { name: "robots", content: resolvedRobots });
    ensureMeta('meta[property="og:title"]', { property: "og:title", content: resolvedTitle });
    ensureMeta('meta[property="og:description"]', { property: "og:description", content: resolvedDescription });
    ensureMeta('meta[property="og:type"]', { property: "og:type", content: type });
    ensureMeta('meta[name="twitter:title"]', { name: "twitter:title", content: resolvedTitle });
    ensureMeta('meta[name="twitter:description"]', { name: "twitter:description", content: resolvedDescription });

    if (resolvedImage) {
      ensureMeta('meta[property="og:image"]', { property: "og:image", content: resolvedImage });
      ensureMeta('meta[name="twitter:image"]', { name: "twitter:image", content: resolvedImage });
    }

    if (settings?.twitterHandle) {
      ensureMeta('meta[name="twitter:site"]', { name: "twitter:site", content: `@${settings.twitterHandle.replace(/^@/, "")}` });
    }

    if (settings?.siteName) {
      ensureMeta('meta[property="og:site_name"]', { property: "og:site_name", content: settings.siteName });
    }

    const scriptId = "seo-jsonld";
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (jsonLd && (Array.isArray(jsonLd) ? jsonLd.length !== 0 : Object.keys(jsonLd).length !== 0)) {
      if (!script) {
        script = document.createElement("script");
        script.type = "application/ld+json";
        script.id = scriptId;
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(jsonLd);
    } else if (script) {
      script.remove();
    }
  }, [resolvedTitle, resolvedDescription, resolvedImage, resolvedRobots, type, jsonLd, settings]);

  return null;
}
