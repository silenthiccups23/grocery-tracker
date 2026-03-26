import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import type { Store, Item, PriceEntry } from "@shared/schema";
import { parseTags, TAG_OPTIONS, computeUnitPrice, formatUnitPrice, formatSize } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Store as StoreIcon, ShoppingCart, DollarSign, TrendingDown, ChevronDown, Filter, Ruler, ExternalLink, RefreshCw, Loader2 } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// --- Store product link generation ---
// Links directly to the store's own product search page.
// These URLs work when a real user clicks them from their normal browser.
const STORE_SEARCH_URLS: Array<{ keyword: string; urlTemplate: string }> = [
  // Albertsons / Safeway family
  { keyword: "albertsons", urlTemplate: "https://www.albertsons.com/shop/search-results.html?q={q}" },
  { keyword: "vons", urlTemplate: "https://www.vons.com/shop/search-results.html?q={q}" },
  { keyword: "pavilions", urlTemplate: "https://www.pavilions.com/shop/search-results.html?q={q}" },
  { keyword: "safeway", urlTemplate: "https://www.safeway.com/shop/search-results.html?q={q}" },
  { keyword: "jewel", urlTemplate: "https://www.jewelosco.com/shop/search-results.html?q={q}" },
  { keyword: "shaw", urlTemplate: "https://www.shaws.com/shop/search-results.html?q={q}" },
  { keyword: "acme", urlTemplate: "https://www.acmemarkets.com/shop/search-results.html?q={q}" },
  // Kroger family
  { keyword: "ralphs", urlTemplate: "https://www.ralphs.com/search?query={q}&searchType=default_search" },
  { keyword: "kroger", urlTemplate: "https://www.kroger.com/search?query={q}&searchType=default_search" },
  { keyword: "food 4 less", urlTemplate: "https://www.food4less.com/search?query={q}&searchType=default_search" },
  { keyword: "fry", urlTemplate: "https://www.frysfood.com/search?query={q}&searchType=default_search" },
  { keyword: "fred meyer", urlTemplate: "https://www.fredmeyer.com/search?query={q}&searchType=default_search" },
  { keyword: "king soopers", urlTemplate: "https://www.kingsoopers.com/search?query={q}&searchType=default_search" },
  { keyword: "smith", urlTemplate: "https://www.smithsfoodanddrug.com/search?query={q}&searchType=default_search" },
  // Big-box / wholesale
  { keyword: "walmart", urlTemplate: "https://www.walmart.com/search?q={q}" },
  { keyword: "target", urlTemplate: "https://www.target.com/s?searchTerm={q}" },
  { keyword: "costco", urlTemplate: "https://www.costco.com/CatalogSearch?dept=All&keyword={q}" },
  { keyword: "sam's club", urlTemplate: "https://www.samsclub.com/s/{q}" },
  { keyword: "bj's", urlTemplate: "https://www.bjs.com/search/{q}" },
  // Specialty / natural
  { keyword: "trader joe", urlTemplate: "https://www.traderjoes.com/home/search?q={q}&section=products" },
  { keyword: "whole foods", urlTemplate: "https://www.wholefoodsmarket.com/search?text={q}" },
  { keyword: "sprouts", urlTemplate: "https://shop.sprouts.com/store/sprouts/s?k={q}" },
  { keyword: "natural grocers", urlTemplate: "https://www.naturalgrocers.com/search?keywords={q}" },
  // Value / discount
  { keyword: "aldi", urlTemplate: "https://www.aldi.us/products/?search={q}" },
  { keyword: "grocery outlet", urlTemplate: "https://www.groceryoutlet.com/search?q={q}" },
  { keyword: "smart & final", urlTemplate: "https://www.smartandfinal.com/search?q={q}" },
  { keyword: "winco", urlTemplate: "https://www.wincofoods.com/products/search?q={q}" },
  // International
  { keyword: "h mart", urlTemplate: "https://www.hmart.com/search?q={q}" },
  { keyword: "99 ranch", urlTemplate: "https://www.99ranch.com/search?keyword={q}" },
  { keyword: "mitsuwa", urlTemplate: "https://mitsuwa.com/search?q={q}" },
  // Regional
  { keyword: "publix", urlTemplate: "https://www.publix.com/shop/search?query={q}" },
  { keyword: "h-e-b", urlTemplate: "https://www.heb.com/search/?q={q}" },
  { keyword: "meijer", urlTemplate: "https://www.meijer.com/shopping/search.html?text={q}" },
  { keyword: "wegmans", urlTemplate: "https://shop.wegmans.com/search?search_term={q}" },
  { keyword: "stop & shop", urlTemplate: "https://stopandshop.com/search?query={q}" },
  { keyword: "giant", urlTemplate: "https://giantfood.com/search?query={q}" },
  { keyword: "food lion", urlTemplate: "https://shop.foodlion.com/search?search_term={q}" },
  { keyword: "harris teeter", urlTemplate: "https://www.harristeeter.com/search?query={q}" },
  { keyword: "gelson", urlTemplate: "https://www.gelsons.com/shop#!/?q={q}" },
  { keyword: "stater bros", urlTemplate: "https://www.staterbros.com/search?q={q}" },
  { keyword: "northgate", urlTemplate: "https://shop.northgatemarket.com/store/northgate-market/s?k={q}" },
  { keyword: "cardenas", urlTemplate: "https://shop.cardenasmarkets.com/search?search_term={q}" },
  { keyword: "vallarta", urlTemplate: "https://shop.vallartasupermarkets.com/search?search_term={q}" },
];

function getStoreProductUrl(storeName: string, productName: string, tags: string[]): string {
  const lowerStore = storeName.toLowerCase();
  const query = [productName, ...tags].join(" ");
  const encoded = encodeURIComponent(query);

  for (const entry of STORE_SEARCH_URLS) {
    if (lowerStore.includes(entry.keyword)) {
      return entry.urlTemplate.replace("{q}", encoded);
    }
  }
  // Fallback: search on the store's own website via Google
  return `https://www.google.com/search?q=${encodeURIComponent(`${query} ${storeName}`)}+grocery+price`;
}

/**
 * Navigate to an external URL. Uses top-level navigation to escape
 * nested iframes (Perplexity deploys sites inside double-nested iframes,
 * and iOS Safari blocks target="_blank" popups from within them).
 */
function navigateToStore(url: string, e: React.MouseEvent) {
  e.preventDefault();
  // Try to navigate the topmost window so we escape all iframe layers
  try {
    if (window.top && window.top !== window) {
      window.top.location.href = url;
      return;
    }
  } catch {
    // Cross-origin — top is not accessible
  }
  // Try parent
  try {
    if (window.parent && window.parent !== window) {
      window.parent.location.href = url;
      return;
    }
  } catch {}
  // Direct navigation as last resort
  window.location.href = url;
}

// A product group is items that share the same name (e.g. all "Milk" entries)
interface ProductGroup {
  productName: string;
  category: string;
  allTags: string[];
  items: Array<{ item: Item; tags: string[] }>;
}

// A size key is "size|unit" e.g. "128|fl oz" for dedup/filtering
function sizeKey(size: number | null, unit: string | null): string {
  if (!size || !unit) return "";
  return `${size}|${unit}`;
}

function parseSizeKey(key: string): { size: number; unit: string } | null {
  const [s, u] = key.split("|");
  if (!s || !u) return null;
  return { size: parseFloat(s), unit: u };
}

function TagMultiSelect({
  allTags,
  selectedTags,
  onToggle,
  onClear,
}: {
  allTags: string[];
  selectedTags: Set<string>;
  onToggle: (tag: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedCount = allTags.filter((t) => selectedTags.has(t)).length;
  const selectedLabels = allTags
    .filter((t) => selectedTags.has(t))
    .join(", ");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs justify-between min-w-[140px] max-w-[280px]"
          data-testid="button-tag-filter"
        >
          <Filter className="w-3 h-3 mr-1.5 shrink-0 opacity-50" />
          <span className="truncate text-left">
            {selectedCount === 0
              ? "Filter by type..."
              : selectedLabels}
          </span>
          <ChevronDown className="w-3.5 h-3.5 ml-1.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-2" align="start">
        <p className="text-xs font-medium text-muted-foreground px-2 mb-1.5">
          Must match ALL selected
        </p>
        <div className="space-y-1">
          {allTags.map((tag) => {
            const isChecked = selectedTags.has(tag);
            return (
              <label
                key={tag}
                className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer text-sm"
                data-testid={`checkbox-tag-${tag}`}
              >
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={() => onToggle(tag)}
                />
                <span className={isChecked ? "font-medium" : ""}>{tag}</span>
              </label>
            );
          })}
        </div>
        {selectedCount > 0 && (
          <div className="border-t border-border mt-1.5 pt-1.5 px-2">
            <button
              className="text-xs text-primary hover:underline"
              onClick={onClear}
              data-testid="button-clear-filter"
            >
              Clear filter
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function SizeMultiSelect({
  allSizes,
  selectedSizes,
  onToggle,
  onClear,
}: {
  allSizes: string[]; // sizeKey strings
  selectedSizes: Set<string>;
  onToggle: (key: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedCount = allSizes.filter((s) => selectedSizes.has(s)).length;
  const selectedLabels = allSizes
    .filter((s) => selectedSizes.has(s))
    .map((s) => {
      const parsed = parseSizeKey(s);
      return parsed ? formatSize(parsed.size, parsed.unit) : s;
    })
    .join(", ");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs justify-between min-w-[120px] max-w-[240px]"
          data-testid="button-size-filter"
        >
          <Ruler className="w-3 h-3 mr-1.5 shrink-0 opacity-50" />
          <span className="truncate text-left">
            {selectedCount === 0
              ? "Filter by size..."
              : selectedLabels}
          </span>
          <ChevronDown className="w-3.5 h-3.5 ml-1.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="start">
        <p className="text-xs font-medium text-muted-foreground px-2 mb-1.5">
          Show selected sizes
        </p>
        <div className="space-y-1">
          {allSizes.map((sk) => {
            const parsed = parseSizeKey(sk);
            const label = parsed ? formatSize(parsed.size, parsed.unit) : sk;
            const isChecked = selectedSizes.has(sk);
            return (
              <label
                key={sk}
                className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer text-sm"
                data-testid={`checkbox-size-${sk}`}
              >
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={() => onToggle(sk)}
                />
                <span className={isChecked ? "font-medium" : ""}>{label}</span>
              </label>
            );
          })}
        </div>
        {selectedCount > 0 && (
          <div className="border-t border-border mt-1.5 pt-1.5 px-2">
            <button
              className="text-xs text-primary hover:underline"
              onClick={onClear}
              data-testid="button-clear-size-filter"
            >
              Clear filter
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default function Dashboard() {
  const { toast } = useToast();
  const { data: stores = [], isLoading: storesLoading } = useQuery<Store[]>({
    queryKey: ["/api/stores"],
  });
  const { data: items = [], isLoading: itemsLoading } = useQuery<Item[]>({
    queryKey: ["/api/items"],
  });
  const { data: prices = [], isLoading: pricesLoading } = useQuery<PriceEntry[]>({
    queryKey: ["/api/prices"],
  });
  const fetchPricesMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/prices/fetch-live");
      return res.json();
    },
    onSuccess: (data: { pricesAdded: number; errors?: string[] }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/prices"] });
      toast({
        title: `${data.pricesAdded} prices fetched`,
        description: data.errors ? `${data.errors.length} items had issues` : "All prices updated successfully.",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to fetch prices", description: err.message, variant: "destructive" });
    },
  });

  const isLoading = storesLoading || itemsLoading || pricesLoading;

  // Group items by product name and collect all unique tags across the group
  const productGroups = useMemo<ProductGroup[]>(() => {
    const groupMap = new Map<string, ProductGroup>();
    for (const item of items) {
      const key = item.name;
      const itemTags = parseTags(item);
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          productName: item.name,
          category: item.category || "Other",
          allTags: [],
          items: [],
        });
      }
      const group = groupMap.get(key)!;
      group.items.push({ item, tags: itemTags });
      for (const tag of itemTags) {
        if (!group.allTags.includes(tag)) {
          group.allTags.push(tag);
        }
      }
    }
    return Array.from(groupMap.values());
  }, [items]);

  // Track which tags are selected per product group for filtering
  const [filterByProduct, setFilterByProduct] = useState<Record<string, Set<string>>>({});
  // Track which sizes are selected per product group
  const [sizeFilterByProduct, setSizeFilterByProduct] = useState<Record<string, Set<string>>>({});

  const getSelectedTags = (productName: string): Set<string> => {
    return filterByProduct[productName] || new Set();
  };

  const toggleTag = (productName: string, tag: string) => {
    setFilterByProduct((prev) => {
      const current = prev[productName] || new Set();
      const next = new Set(current);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return { ...prev, [productName]: next };
    });
  };

  const clearTags = (productName: string) => {
    setFilterByProduct((prev) => ({ ...prev, [productName]: new Set() }));
  };

  const getSelectedSizes = (productName: string): Set<string> => {
    return sizeFilterByProduct[productName] || new Set();
  };

  const toggleSize = (productName: string, sk: string) => {
    setSizeFilterByProduct((prev) => {
      const current = prev[productName] || new Set();
      const next = new Set(current);
      if (next.has(sk)) next.delete(sk);
      else next.add(sk);
      return { ...prev, [productName]: next };
    });
  };

  const clearSizes = (productName: string) => {
    setSizeFilterByProduct((prev) => ({ ...prev, [productName]: new Set() }));
  };

  // For each product group, filter items that match ALL selected tags, then show prices
  const comparisonData = productGroups.map((group) => {
    const selectedTags = getSelectedTags(group.productName);
    const selectedSizes = getSelectedSizes(group.productName);

    // Filter: keep items whose tags are a superset of selectedTags
    const matchingItems = selectedTags.size === 0
      ? group.items
      : group.items.filter(({ tags }) =>
          Array.from(selectedTags).every((st) => tags.includes(st))
        );

    // Get ALL prices for matching items (before size filter)
    const allPriceDataRaw: Array<{
      item: Item;
      tags: string[];
      storeId: number;
      price: number;
      size: number | null;
      unit: string | null;
      unitPrice: number | null;
      priceEntry: PriceEntry;
      sizeKey: string;
    }> = [];

    for (const { item, tags } of matchingItems) {
      const itemPrices = prices.filter((p) => p.itemId === item.id);
      const latestByStore = new Map<number, PriceEntry>();
      for (const p of itemPrices) {
        const existing = latestByStore.get(p.storeId);
        if (!existing || p.date > existing.date) {
          latestByStore.set(p.storeId, p);
        }
      }
      for (const [storeId, entry] of latestByStore) {
        const up = computeUnitPrice(entry.price, entry.size, entry.unit);
        allPriceDataRaw.push({
          item, tags, storeId,
          price: entry.price,
          size: entry.size,
          unit: entry.unit,
          unitPrice: up,
          priceEntry: entry,
          sizeKey: sizeKey(entry.size, entry.unit),
        });
      }
    }

    // Collect all unique sizes for the size filter dropdown
    const allSizeKeys: string[] = [];
    const seenSizes = new Set<string>();
    for (const pd of allPriceDataRaw) {
      if (pd.sizeKey && !seenSizes.has(pd.sizeKey)) {
        seenSizes.add(pd.sizeKey);
        allSizeKeys.push(pd.sizeKey);
      }
    }
    // Sort sizes by the numeric value (smallest first)
    allSizeKeys.sort((a, b) => {
      const pa = parseSizeKey(a);
      const pb = parseSizeKey(b);
      if (!pa || !pb) return 0;
      return pa.size - pb.size;
    });

    // Apply size filter
    const allPriceData = selectedSizes.size === 0
      ? allPriceDataRaw
      : allPriceDataRaw.filter(pd => selectedSizes.has(pd.sizeKey));

    // Determine if we can compare by unit price
    const hasUnitPrices = allPriceData.some(d => d.unitPrice !== null);

    // Find cheapest
    let cheapestEntry: typeof allPriceData[0] | null = null;
    if (allPriceData.length > 0) {
      if (hasUnitPrices) {
        cheapestEntry = allPriceData.reduce((a, b) => {
          const aUp = a.unitPrice ?? Infinity;
          const bUp = b.unitPrice ?? Infinity;
          return aUp <= bUp ? a : b;
        });
      } else {
        cheapestEntry = allPriceData.reduce((a, b) => (a.price < b.price ? a : b));
      }
    }
    const cheapestStore = cheapestEntry ? stores.find((s) => s.id === cheapestEntry!.storeId) : null;

    return {
      group,
      matchingItems,
      allPriceData,
      allPriceDataRaw,
      allSizeKeys,
      cheapestEntry,
      cheapestStore,
      hasUnitPrices,
    };
  });

  const totalEntries = prices.length;
  const uniqueItems = items.length;
  const totalStores = stores.length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-lg font-semibold tracking-tight" data-testid="text-app-title">GroceryTrack</h1>
          </div>
          <nav className="flex items-center gap-1">
            <Link href="/stores">
              <Button variant="ghost" size="sm" data-testid="link-stores">Stores</Button>
            </Link>
            <Link href="/items">
              <Button variant="ghost" size="sm" data-testid="link-items">Items</Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchPricesMutation.mutate()}
              disabled={fetchPricesMutation.isPending}
              data-testid="button-fetch-prices"
            >
              {fetchPricesMutation.isPending ? (
                <Loader2 className="w-4 h-4 sm:mr-1 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 sm:mr-1" />
              )}
              <span className="hidden sm:inline">{fetchPricesMutation.isPending ? "Fetching..." : "Fetch Prices"}</span>
            </Button>
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                  <StoreIcon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-semibold tabular-nums" data-testid="text-store-count">
                    {isLoading ? <Skeleton className="h-7 w-8" /> : totalStores}
                  </p>
                  <p className="text-xs text-muted-foreground">Stores</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                  <ShoppingCart className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-semibold tabular-nums" data-testid="text-item-count">
                    {isLoading ? <Skeleton className="h-7 w-8" /> : uniqueItems}
                  </p>
                  <p className="text-xs text-muted-foreground">Items</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-semibold tabular-nums" data-testid="text-entry-count">
                    {isLoading ? <Skeleton className="h-7 w-8" /> : totalEntries}
                  </p>
                  <p className="text-xs text-muted-foreground">Price Entries</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Price Comparison */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-semibold">Price Comparison</h2>
          </div>
          {totalEntries > 0 && (
            <p className="text-[11px] text-muted-foreground/70 mb-4">Prices shown are estimates and may not reflect current in-store pricing. Actual prices may vary by location, availability, and promotions. Click any price to verify directly on the retailer's website.</p>
          )}

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          ) : comparisonData.length === 0 ? (
            <Card>
              <CardContent className="py-12 flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                  <TrendingDown className="w-6 h-6 text-muted-foreground" />
                </div>
                <h3 className="font-medium mb-1">No items tracked yet</h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-xs">
                  Start by adding stores and items, then fetch prices to compare them side by side.
                </p>
                <div className="flex gap-2">
                  <Link href="/stores">
                    <Button variant="outline" size="sm" data-testid="button-add-store-empty">Add a store</Button>
                  </Link>
                  <Link href="/items">
                    <Button size="sm" data-testid="button-add-item-empty">Add an item</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {comparisonData.map(({ group, matchingItems, allPriceData, allPriceDataRaw, allSizeKeys, cheapestEntry, cheapestStore, hasUnitPrices }) => {
                const selectedTags = getSelectedTags(group.productName);
                const selectedSizes = getSelectedSizes(group.productName);
                return (
                  <Card key={group.productName}>
                    <CardContent className="py-4 px-5">
                      {/* Product header: name + category badge + filters */}
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-medium" data-testid={`text-product-name-${group.productName}`}>
                            {group.productName}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <Badge variant="secondary" className="text-xs">
                              {group.category}
                            </Badge>
                            {group.allTags.length > 0 && (
                              <TagMultiSelect
                                allTags={group.allTags}
                                selectedTags={selectedTags}
                                onToggle={(tag) => toggleTag(group.productName, tag)}
                                onClear={() => clearTags(group.productName)}
                              />
                            )}
                            {allSizeKeys.length > 1 && (
                              <SizeMultiSelect
                                allSizes={allSizeKeys}
                                selectedSizes={selectedSizes}
                                onToggle={(sk) => toggleSize(group.productName, sk)}
                                onClear={() => clearSizes(group.productName)}
                              />
                            )}
                          </div>
                        </div>
                        {cheapestEntry && cheapestStore && (
                          <div className="text-right shrink-0 ml-4">
                            {cheapestEntry.unitPrice !== null ? (
                              <>
                                <p className="text-lg font-semibold text-primary tabular-nums">
                                  {formatUnitPrice(cheapestEntry.unitPrice, cheapestEntry.unit!)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Best at {cheapestStore.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  ${cheapestEntry.price.toFixed(2)} / {formatSize(cheapestEntry.size, cheapestEntry.unit)}
                                </p>
                              </>
                            ) : (
                              <>
                                <p className="text-lg font-semibold text-primary tabular-nums">
                                  ${cheapestEntry.price.toFixed(2)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Best at {cheapestStore.name}
                                </p>
                              </>
                            )}
                            {cheapestEntry.tags.length > 0 && (
                              <p className="text-xs text-primary/70 font-medium">
                                {cheapestEntry.tags.join(", ")}
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Matching items and their prices */}
                      {allPriceData.length === 0 ? (
                        allPriceDataRaw.length === 0 ? (
                          <div className="bg-muted/50 rounded-lg px-4 py-3">
                            <p className="text-sm font-medium text-muted-foreground">No prices available yet</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              This product wasn't found at your stores. Try hitting "Fetch Prices" to update.
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            No prices match the selected filters. Try changing your size or type selection.
                          </p>
                        )
                      ) : (
                        <div className="space-y-2.5">
                          {matchingItems.map(({ item, tags }) => {
                            const itemPriceData = allPriceData.filter((p) => p.item.id === item.id);
                            if (itemPriceData.length === 0) return null;

                            const itemHasUnitPrices = itemPriceData.some(d => d.unitPrice !== null);
                            let itemCheapest: typeof itemPriceData[0];
                            if (itemHasUnitPrices) {
                              itemCheapest = itemPriceData.reduce((a, b) => {
                                const aUp = a.unitPrice ?? Infinity;
                                const bUp = b.unitPrice ?? Infinity;
                                return aUp <= bUp ? a : b;
                              });
                            } else {
                              itemCheapest = itemPriceData.reduce((a, b) => (a.price < b.price ? a : b));
                            }

                            return (
                              <div key={item.id} data-testid={`item-row-${item.id}`}>
                                {matchingItems.length > 1 && tags.length > 0 && (
                                  <div className="flex gap-1 mb-1">
                                    {tags.map((tag) => (
                                      <span key={tag} className="text-xs font-medium text-primary/80">
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                <div className="flex flex-wrap gap-2">
                                  {itemPriceData.map((pd) => {
                                    const store = stores.find((s) => s.id === pd.storeId);
                                    const isCheapest = pd.priceEntry.id === itemCheapest.priceEntry.id;
                                    const sizeLabel = formatSize(pd.size, pd.unit);
                                    const unitPriceLabel = pd.unitPrice !== null && pd.unit
                                      ? formatUnitPrice(pd.unitPrice, pd.unit)
                                      : null;
                                    const productUrl = store
                                      ? getStoreProductUrl(store.name, group.productName, tags)
                                      : null;

                                    return (
                                      <a
                                        key={`${pd.item.id}-${pd.storeId}`}
                                        href={productUrl || "#"}
                                        target="_top"
                                        rel="noopener noreferrer"
                                        onClick={(e) => { if (productUrl) navigateToStore(productUrl, e); }}
                                        aria-label={`${store?.name}: $${pd.price.toFixed(2)}${sizeLabel ? ` per ${sizeLabel}` : ''}${isCheapest ? ' — Best price' : ''}. Tap to view on store website.`}
                                        className={`group text-xs px-3 py-2.5 rounded-lg inline-flex items-center gap-1.5 cursor-pointer border-2 transition-all duration-150 hover:shadow-md hover:-translate-y-[1px] no-underline ${
                                          isCheapest
                                            ? "bg-blue-600 text-white font-semibold border-blue-700 hover:bg-blue-700 shadow-sm"
                                            : "bg-muted text-muted-foreground border-transparent hover:border-border hover:bg-muted/80"
                                        }`}
                                        data-testid={`price-tag-${item.id}-${pd.storeId}`}
                                      >
                                        {isCheapest && (
                                          <span className="bg-white text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded mr-0.5" aria-hidden="true">✓ BEST</span>
                                        )}
                                        <span>
                                          <span className={`font-semibold ${isCheapest ? '' : 'underline underline-offset-2 decoration-1 decoration-current/30 group-hover:decoration-current/70'}`}>{store?.name}</span>
                                          {": "}
                                          <span className={isCheapest ? "font-bold" : ""}>${pd.price.toFixed(2)}</span>
                                          {sizeLabel && (
                                            <span className={isCheapest ? "opacity-90" : "opacity-70"}> / {sizeLabel}</span>
                                          )}
                                          {unitPriceLabel && (
                                            <span className={`ml-1 ${isCheapest ? "text-white/90" : "text-foreground/70"}`}>
                                              ({unitPriceLabel})
                                            </span>
                                          )}
                                        </span>
                                        <ExternalLink className={`w-3.5 h-3.5 shrink-0 transition-opacity ${isCheapest ? 'opacity-80' : 'opacity-50 group-hover:opacity-100'}`} />
                                      </a>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent price entries */}
        {prices.length > 0 && (
          <div>
            <h2 className="text-base font-semibold mb-4">Recent Entries</h2>
            <Card>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {prices.slice(0, 8).map((entry) => {
                    const item = items.find((i) => i.id === entry.itemId);
                    const store = stores.find((s) => s.id === entry.storeId);
                    const itemTags = item ? parseTags(item) : [];
                    const sizeLabel = formatSize(entry.size, entry.unit);
                    const up = computeUnitPrice(entry.price, entry.size, entry.unit);
                    const upLabel = up !== null && entry.unit ? formatUnitPrice(up, entry.unit) : null;
                    return (
                      <div key={entry.id} className="flex items-center justify-between py-3 px-5" data-testid={`row-entry-${entry.id}`}>
                        <div>
                          <p className="text-sm font-medium">
                            {item?.name ?? "Unknown"}
                            {itemTags.length > 0 && (
                              <span className="text-muted-foreground font-normal"> · {itemTags.join(", ")}</span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {store?.name ?? "Unknown"} · {entry.date}
                            {sizeLabel && ` · ${sizeLabel}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold tabular-nums">${entry.price.toFixed(2)}</p>
                          {upLabel && (
                            <p className="text-xs text-muted-foreground tabular-nums">{upLabel}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      <footer className="max-w-5xl mx-auto px-4 sm:px-6 py-6 border-t border-border">
        <p className="text-[10px] text-muted-foreground/50 text-center leading-relaxed max-w-2xl mx-auto">
          Disclaimer: All prices displayed are estimates based on publicly available data and may not reflect actual in-store prices. Prices vary by store location, time of purchase, and ongoing promotions. GroceryTrack does not guarantee the accuracy of any pricing information. Always verify prices directly with the retailer before making purchasing decisions.
        </p>
      </footer>
    </div>
  );
}
