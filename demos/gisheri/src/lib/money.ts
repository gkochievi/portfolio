import i18n from "@/i18n";

function getLocale(lng: string) {
  if (lng.startsWith("ka")) return "ka-GE";
  return "en-US";
}

export function formatMoneyGEL(amount: number, lng: string = i18n.language || "en") {
  const isInt = Number.isInteger(amount);
  return new Intl.NumberFormat(getLocale(lng), {
    style: "currency",
    currency: "GEL",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: isInt ? 0 : 2,
    maximumFractionDigits: isInt ? 0 : 2,
  }).format(amount);
}

