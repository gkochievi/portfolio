import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enCommon from "@/locales/en/common.json";
import kaCommon from "@/locales/ka/common.json";

/**
 * The one and only Web Storage key this demo is allowed to write, alongside
 * next-themes' own. Everything else — the cart, the JWTs, the whole store —
 * lives in memory and dies with the tab.
 */
const STORAGE_KEY = "gisheri:lang";

function getInitialLanguage() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "en" || stored === "ka") return stored;

  // Upstream opens in Georgian, because the shop is a Tbilisi one. The demo
  // opens in English instead: a portfolio visitor who cannot read the interface
  // cannot judge it, and the header's language toggle is on every page. Georgian
  // is one click away and stays the `fallbackLng` below, so any key the English
  // bundle is missing still resolves the way it does in production.
  return "en";
}

i18n.use(initReactI18next).init({
  lng: getInitialLanguage(),
  fallbackLng: "ka",
  supportedLngs: ["en", "ka"],
  resources: {
    en: { common: enCommon },
    ka: { common: kaCommon },
  },
  defaultNS: "common",
  interpolation: { escapeValue: false },
});

const updateDocumentLanguage = (lng: string) => {
  if (typeof document === "undefined") return;
  document.documentElement.lang = lng;
};

i18n.on("languageChanged", (lng) => {
  if (lng === "en" || lng === "ka") localStorage.setItem(STORAGE_KEY, lng);
  updateDocumentLanguage(lng);
});

updateDocumentLanguage(i18n.language);

export default i18n;

