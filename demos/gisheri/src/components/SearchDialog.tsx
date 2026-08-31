import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ShoppingBag, Sparkles, Star, FileText, Search, ArrowRight } from "lucide-react";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandInput,
  CommandSeparator,
} from "@/components/ui/command";
import { searchSite, type SearchResult } from "@/lib/search";
import { useCollections, useProducts, useZodiacInfo } from "@/hooks/use-catalog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function groupLabel(type: SearchResult["type"]) {
  switch (type) {
    case "product":
      return "search.groups.products";
    case "collection":
      return "search.groups.collections";
    case "zodiac":
      return "search.groups.zodiac";
    case "page":
      return "search.groups.pages";
    default:
      return "search.groups.results";
  }
}

function TypeIcon({ type }: { type: SearchResult["type"] }) {
  const iconClass = "w-4 h-4 text-muted-foreground";
  switch (type) {
    case "product":
      return <ShoppingBag className={iconClass} />;
    case "collection":
      return <Sparkles className={iconClass} />;
    case "zodiac":
      return <Star className={iconClass} />;
    case "page":
      return <FileText className={iconClass} />;
    default:
      return <Search className={iconClass} />;
  }
}

export default function SearchDialog({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [selectedValue, setSelectedValue] = useState("");

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelectedValue("");
  }, [open]);

  const { data: products = [] } = useProducts();
  const { data: collections = [] } = useCollections();
  const { data: zodiacData = [] } = useZodiacInfo();

  const results = useMemo(
    () => searchSite(query, { products, collections, zodiacData }, 12),
    [query, products, collections, zodiacData],
  );

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setSelectedValue("");
      return;
    }

    if (results.length > 0) {
      setSelectedValue(`${results[0].type}:${results[0].id}`);
    } else {
      setSelectedValue(`all:${q}`);
    }
  }, [query, results]);

  const grouped = useMemo(() => {
    const map = new Map<SearchResult["type"], SearchResult[]>();
    for (const r of results) {
      const arr = map.get(r.type) ?? [];
      arr.push(r);
      map.set(r.type, arr);
    }
    return map;
  }, [results]);

  const valueToHref = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of results) map.set(`${r.type}:${r.id}`, r.href);
    return map;
  }, [results]);

  const go = (href: string) => {
    onOpenChange(false);
    navigate(href);
  };

  const resultCount = results.length;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      {/* We fully control filtering (Fuse), not cmdk */}
      <Command
        shouldFilter={false}
        value={selectedValue}
        onValueChange={setSelectedValue}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          if (!query.trim()) return;

          e.preventDefault();
          if (results.length > 0) {
            if (selectedValue.startsWith("all:")) {
              go(results[0].href);
              return;
            }
            const href = valueToHref.get(selectedValue);
            if (href) {
              go(href);
              return;
            }
            go(results[0].href);
            return;
          }
          if (selectedValue.startsWith("all:")) {
            go(`/shop?q=${encodeURIComponent(query)}`);
          }
        }}
      >
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder={t("search.placeholder")}
          autoFocus
        />
        <CommandList className="max-h-[60vh] md:max-h-[400px]">
          {/* View all results option */}
          {query.trim().length > 0 && (
            <>
              <CommandGroup>
                <CommandItem 
                  value={`all:${query}`} 
                  onSelect={() => go(`/shop?q=${encodeURIComponent(query)}`)}
                  className="group"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center">
                        <Search className="w-4 h-4 text-gold" />
                      </div>
                      <div>
                        <span className="font-medium">{t("search.viewAllResultsFor", { query })}</span>
                        {resultCount > 0 && (
                          <span className="text-xs text-muted-foreground ml-2">
                            ({resultCount} {t("shopPage.products", { defaultValue: "found" })})
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-data-[selected=true]:text-foreground transition-colors" />
                  </div>
                </CommandItem>
              </CommandGroup>
              <CommandSeparator className="my-2" />
            </>
          )}

          {/* Empty state */}
          {query.trim().length > 0 && results.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-secondary/50 flex items-center justify-center mx-auto mb-3">
                <Search className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">{t("search.noResults")}</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                {t("search.tryDifferent", { defaultValue: "Try a different search term" })}
              </p>
            </div>
          ) : null}

          {/* Hint when empty */}
          {query.trim().length === 0 && (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground mb-2">
                {t("search.hint", { defaultValue: "Search for products, collections, or zodiac signs" })}
              </p>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/70">
                <kbd className="px-2 py-1 bg-secondary rounded text-[10px] font-mono">ESC</kbd>
                <span>{t("search.toClose", { defaultValue: "to close" })}</span>
              </div>
            </div>
          )}

          {/* Grouped results */}
          {Array.from(grouped.entries()).map(([type, items], idx) => (
            <div key={type}>
              <CommandGroup heading={t(groupLabel(type))}>
                {items.map((r) => (
                  <CommandItem 
                    key={`${r.type}:${r.id}`} 
                    value={`${r.type}:${r.id}`} 
                    onSelect={() => go(r.href)}
                    className="group"
                  >
                    <div className="flex items-center gap-3 w-full">
                      <div className="w-8 h-8 rounded-lg bg-secondary/50 flex items-center justify-center shrink-0 group-data-[selected=true]:bg-gold/10">
                        <TypeIcon type={r.type} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium block truncate">{r.title}</span>
                        {r.subtitle && (
                          <span className="text-xs text-muted-foreground block truncate">{r.subtitle}</span>
                        )}
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-data-[selected=true]:opacity-100 transition-opacity shrink-0" />
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
              {idx < grouped.size - 1 && <CommandSeparator className="my-2" />}
            </div>
          ))}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}

