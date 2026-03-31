import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import type { Product, CollectedPrice, Store } from "@shared/schema";
import { CATEGORY_ICONS, GROCERY_CATEGORIES, formatSize, computeUnitPrice, formatUnitPrice } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import {
  ShoppingCart, ArrowLeft, Search, Package, ChevronRight, Store as StoreIcon, Tag,
} from "lucide-react";

export default function Products() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search input
  const [debounceTimer, setDebounceTimer] = useState<any>(null);
  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (debounceTimer) clearTimeout(debounceTimer);
    setDebounceTimer(setTimeout(() => setDebouncedSearch(value), 300));
  };

  const { data: stores = [] } = useQuery<Store[]>({ queryKey: ["/api/stores"] });

  const { data: productData, isLoading } = useQuery<{ products: Product[]; total: number }>({
    queryKey: ["/api/products", debouncedSearch, selectedCategory],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (selectedCategory) params.set("category", selectedCategory);
      params.set("limit", "50");
      const res = await apiRequest("GET", `/api/products?${params}`);
      return res.json();
    },
  });

  const productList = productData?.products ?? [];
  const totalProducts = productData?.total ?? 0;

  // For each product, fetch its latest prices
  const productIds = productList.map(p => p.id);
  const { data: allPrices = [] } = useQuery<CollectedPrice[]>({
    queryKey: ["/api/product-prices-batch", productIds.join(",")],
    queryFn: async () => {
      if (productIds.length === 0) return [];
      // Fetch prices for each product in parallel
      const results = await Promise.all(
        productIds.map(async id => {
          const res = await apiRequest("GET", `/api/products/${id}/prices`);
          return res.json() as Promise<CollectedPrice[]>;
        })
      );
      return results.flat();
    },
    enabled: productIds.length > 0,
  });

  return (
    <div className="min-h-screen bg-background">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-white focus:text-blue-600 focus:underline">Skip to main content</a>
      <header role="banner" className="border-b border-border bg-card">
        <nav aria-label="Main navigation">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon" className="h-8 w-8 min-h-[44px] min-w-[44px] focus:ring-2 focus:ring-blue-500" aria-label="Back to dashboard" data-testid="button-back">
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center" aria-hidden="true">
                <ShoppingCart className="w-5 h-5 text-primary-foreground" aria-hidden="true" />
              </div>
              <h1 className="text-lg font-semibold tracking-tight">Browse Products</h1>
            </div>
          </div>
        </nav>
      </header>

      <main id="main-content" className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Search */}
        <section role="search" aria-label="Product search">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              placeholder="Search products... e.g. milk, eggs, chicken"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10 min-h-[44px] text-sm focus:ring-2 focus:ring-blue-500"
              aria-label="Search products"
              data-testid="input-product-search"
            />
          </div>

          {/* Category filter chips */}
          <div className="flex flex-wrap gap-2 mb-6" role="group" aria-label="Filter by category">
            <button
              onClick={() => setSelectedCategory("")}
              className={`text-xs px-3 py-1.5 min-h-[36px] rounded-full border transition-colors focus:ring-2 focus:ring-blue-500 ${
                !selectedCategory
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-foreground border-border hover:bg-muted"
              }`}
              aria-pressed={!selectedCategory}
              data-testid="filter-all"
            >
              All
            </button>
            {GROCERY_CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(selectedCategory === cat ? "" : cat)}
                className={`text-xs px-3 py-1.5 min-h-[36px] rounded-full border transition-colors focus:ring-2 focus:ring-blue-500 ${
                  selectedCategory === cat
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-foreground border-border hover:bg-muted"
                }`}
                aria-pressed={selectedCategory === cat}
                data-testid={`filter-${cat.toLowerCase()}`}
              >
                {CATEGORY_ICONS[cat] || "📦"} {cat}
              </button>
            ))}
          </div>
        </section>

        {/* Results count */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-muted-foreground" data-testid="text-product-count">
            {isLoading ? "Searching..." : `${totalProducts} product${totalProducts !== 1 ? "s" : ""} found`}
          </p>
        </div>

        {/* Product list */}
        <section role="region" aria-label="Product results" aria-live="polite">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          ) : productList.length === 0 ? (
            <Card>
              <CardContent className="py-12 flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4" aria-hidden="true">
                  <Package className="w-6 h-6 text-muted-foreground" />
                </div>
                <h3 className="font-medium mb-1">
                  {debouncedSearch || selectedCategory ? "No products match your search" : "No products collected yet"}
                </h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                  {debouncedSearch || selectedCategory
                    ? "Try a different search term or category."
                    : "Products will appear here after the Raspberry Pi runs its nightly collection."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {productList.map(product => {
                // Get prices for this product
                const productPrices = allPrices.filter(p => p.productId === product.id);
                // Find cheapest
                const cheapest = productPrices.length > 0
                  ? productPrices.reduce((min, p) => p.price < min.price ? p : min)
                  : null;
                const cheapestStore = cheapest ? stores.find(s => s.id === cheapest.storeId) : null;
                // Find most expensive for comparison
                const mostExpensive = productPrices.length > 1
                  ? productPrices.reduce((max, p) => p.price > max.price ? p : max)
                  : null;

                const icon = product.category ? (CATEGORY_ICONS[product.category] || "📦") : "📦";
                const unitPrice = cheapest && product.sizeNum && product.sizeUnit
                  ? computeUnitPrice(cheapest.price, product.sizeNum, product.sizeUnit)
                  : null;

                return (
                  <Card key={product.id} data-testid={`product-card-${product.id}`}>
                    <CardContent className="py-3 px-4 sm:px-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center shrink-0 text-base mt-0.5" aria-hidden="true">
                            {icon}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium leading-tight" data-testid={`product-name-${product.id}`}>
                              {product.name}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              {product.brand && (
                                <span className="text-[11px] text-muted-foreground">{product.brand}</span>
                              )}
                              {product.brand && product.size && (
                                <span className="text-[11px] text-muted-foreground" aria-hidden="true">·</span>
                              )}
                              {product.size && (
                                <span className="text-[11px] text-muted-foreground">{product.size}</span>
                              )}
                              {product.category && (
                                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{product.category}</Badge>
                              )}
                            </div>

                            {/* Prices across stores */}
                            {productPrices.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {productPrices.map(pp => {
                                  const store = stores.find(s => s.id === pp.storeId);
                                  const isCheapest = cheapest && pp.storeId === cheapest.storeId;
                                  return (
                                    <span
                                      key={pp.id}
                                      className={`text-[11px] px-2 py-1 rounded-md ${
                                        isCheapest
                                          ? "bg-blue-600 text-white font-semibold"
                                          : "bg-muted text-muted-foreground"
                                      }`}
                                      data-testid={`price-chip-${product.id}-${pp.storeId}`}
                                    >
                                      {isCheapest && <span className="mr-0.5">✓</span>}
                                      {store?.name}: ${pp.price.toFixed(2)}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Price summary on the right */}
                        {cheapest && (
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold text-primary tabular-nums" data-testid={`product-price-${product.id}`}>
                              ${cheapest.price.toFixed(2)}
                            </p>
                            {unitPrice && product.sizeUnit && (
                              <p className="text-[10px] text-muted-foreground tabular-nums">
                                {formatUnitPrice(unitPrice, product.sizeUnit)}
                              </p>
                            )}
                            {cheapestStore && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                at {cheapestStore.name}
                              </p>
                            )}
                            {mostExpensive && mostExpensive.price > cheapest.price && (
                              <p className="text-[10px] text-green-600 font-medium mt-0.5">
                                Save ${(mostExpensive.price - cheapest.price).toFixed(2)}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
