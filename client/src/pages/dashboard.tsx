import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import type { Store, Item, PriceEntry, PriceAlert } from "@shared/schema";
import { parseTags, TAG_OPTIONS, computeUnitPrice, formatUnitPrice, formatSize } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Store as StoreIcon, ShoppingCart, DollarSign, TrendingDown, ExternalLink, RefreshCw, Loader2, BellRing } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getStoreProductUrl, navigateToStore } from "@/lib/storeLinks";
import { type ProductGroup, sizeKey, parseSizeKey } from "@/lib/priceUtils";
import { TagMultiSelect, SizeMultiSelect } from "@/components/FilterSelects";

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
  const { data: alerts = [] } = useQuery<PriceAlert[]>({
    queryKey: ["/api/alerts"],
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
      {/* Skip to main content — visible on focus for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:ring-2 focus:ring-blue-500"
      >
        Skip to main content
      </a>
      {/* Header */}
      <header className="border-b border-border bg-card" role="banner">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center" aria-hidden="true">
              <ShoppingCart className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-lg font-semibold tracking-tight" data-testid="text-app-title">GroceryTrack</h1>
          </div>
          <nav className="flex items-center gap-1" aria-label="Main navigation">
            <Link href="/stores">
              <Button variant="ghost" size="sm" data-testid="link-stores" aria-label="Manage stores">Stores</Button>
            </Link>
            <Link href="/items">
              <Button variant="ghost" size="sm" data-testid="link-items" aria-label="Manage tracked items">Items</Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchPricesMutation.mutate()}
              disabled={fetchPricesMutation.isPending}
              data-testid="button-fetch-prices"
              aria-label={fetchPricesMutation.isPending ? "Fetching latest prices from stores, please wait" : "Fetch latest prices from stores"}
              className="focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
            >
              {fetchPricesMutation.isPending ? (
                <Loader2 className="w-4 h-4 sm:mr-1 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="w-4 h-4 sm:mr-1" aria-hidden="true" />
              )}
              <span className="hidden sm:inline">{fetchPricesMutation.isPending ? "Fetching..." : "Fetch Prices"}</span>
            </Button>
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main id="main-content" className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Stats row */}
        <div
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8"
          role="region"
          aria-label="Summary statistics"
        >
          <Card aria-label={`${totalStores} stores tracked`}>
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center" aria-hidden="true">
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
          <Card aria-label={`${uniqueItems} items tracked`}>
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center" aria-hidden="true">
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
          <Card aria-label={`${totalEntries} price entries recorded`}>
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center" aria-hidden="true">
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

        {/* Triggered Price Alerts */}
        {alerts.filter(a => a.lastTriggered).length > 0 && (
          <div
            className="mb-6"
            role="region"
            aria-label="Price alerts"
          >
            <div className="flex items-center gap-2 mb-3">
              <BellRing className="w-4 h-4 text-amber-500" aria-hidden="true" />
              <h2 className="text-base font-semibold">Price Alerts</h2>
            </div>
            <div className="space-y-2">
              {alerts.filter(a => a.lastTriggered).map((alert) => {
                return (
                  <Card
                    key={alert.id}
                    className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20"
                    data-testid={`alert-card-${alert.id}`}
                  >
                    <CardContent className="py-3 px-4 sm:px-5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-green-100 dark:bg-green-900/30" aria-hidden="true">
                          <BellRing className="w-4 h-4 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            Alert triggered
                            <span className="ml-2 text-xs font-semibold text-green-600 dark:text-green-400">
                              Price dropped
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Target: ${alert.targetPrice.toFixed(2)} · Triggered {alert.lastTriggered}
                          </p>
                        </div>
                      </div>
                      <Badge className="bg-green-600 text-white text-[10px] shrink-0">Deal</Badge>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Price Comparison */}
        <div
          className="mb-6"
          role="region"
          aria-label="Price comparison"
          aria-live="polite"
          aria-atomic="false"
        >
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
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4" aria-hidden="true">
                  <TrendingDown className="w-6 h-6 text-muted-foreground" />
                </div>
                <h3 className="font-medium mb-1">No items tracked yet</h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-xs">
                  Start by adding stores and items, then fetch prices to compare them side by side.
                </p>
                <div className="flex gap-2">
                  <Link href="/stores">
                    <Button variant="outline" size="sm" data-testid="button-add-store-empty" aria-label="Add a grocery store to track">Add a store</Button>
                  </Link>
                  <Link href="/items">
                    <Button size="sm" data-testid="button-add-item-empty" aria-label="Add a grocery item to track">Add an item</Button>
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
                  <Card
                    key={group.productName}
                    aria-label={`Price comparison for ${group.productName}${cheapestStore ? `, cheapest at ${cheapestStore.name}` : ''}`}
                  >
                    <CardContent className="py-4 px-3 sm:px-5">
                      {/* Product header: name + category badge + filters */}
                      <div className="flex flex-wrap items-start justify-between mb-3 gap-2">
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
                          <div
                            className="text-right shrink-0"
                            aria-label={`Best price: ${cheapestEntry.unitPrice !== null ? formatUnitPrice(cheapestEntry.unitPrice, cheapestEntry.unit!) : `$${cheapestEntry.price.toFixed(2)}`} at ${cheapestStore.name}`}
                          >
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
                              This product wasn't found at your stores. If the name is a brand or nickname, try editing it to a generic name (e.g., "Hot Dogs" instead of a brand name). Then hit "Fetch Prices" to update.
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
                                        className={`group text-xs px-3 py-2.5 rounded-lg inline-flex items-center gap-1.5 cursor-pointer border-2 transition-all duration-150 hover:shadow-md hover:-translate-y-[1px] no-underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
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
                                        <ExternalLink className={`w-3.5 h-3.5 shrink-0 transition-opacity ${isCheapest ? 'opacity-80' : 'opacity-50 group-hover:opacity-100'}`} aria-hidden="true" />
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
          <div role="region" aria-label="Recent price entries">
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

      <footer className="max-w-5xl mx-auto px-4 sm:px-6 py-6 border-t border-border" role="contentinfo">
        <p className="text-[10px] text-muted-foreground/50 text-center leading-relaxed max-w-2xl mx-auto">
          Disclaimer: All prices displayed are estimates based on publicly available data and may not reflect actual in-store prices. Prices vary by store location, time of purchase, and ongoing promotions. GroceryTrack does not guarantee the accuracy of any pricing information. Always verify prices directly with the retailer before making purchasing decisions.
        </p>
      </footer>
    </div>
  );
}
