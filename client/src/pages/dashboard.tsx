import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import type { Store, Product, CollectedPrice, PriceAlert, CollectorRun } from "@shared/schema";
import { CATEGORY_ICONS, GROCERY_CATEGORIES, computeUnitPrice, formatUnitPrice } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ShoppingCart, Store as StoreIcon, Package, TrendingDown,
  Search, Clock, BellRing, ArrowRight,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { cleanProductName, getLatestPricePerStore } from "@/lib/productUtils";

export default function Dashboard() {
  const [quickSearch, setQuickSearch] = useState("");

  const { data: stores = [] } = useQuery<Store[]>({ queryKey: ["/api/stores"] });
  const { data: alerts = [] } = useQuery<PriceAlert[]>({ queryKey: ["/api/alerts"] });
  const { data: collectorRuns = [] } = useQuery<CollectorRun[]>({ queryKey: ["/api/collector/status"] });

  const { data: productData, isLoading: productsLoading } = useQuery<{ products: Product[]; total: number }>({
    queryKey: ["/api/products", "dashboard"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/products?limit=200");
      return res.json();
    },
  });

  const totalProducts = productData?.total ?? 0;
  const sampleProducts = productData?.products ?? [];

  // Get prices for sample products to find best deals
  const productIds = sampleProducts.map(p => p.id);
  const { data: allPrices = [] } = useQuery<CollectedPrice[]>({
    queryKey: ["/api/dashboard-prices", productIds.join(",")],
    queryFn: async () => {
      if (productIds.length === 0) return [];
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

  // Find products with the biggest savings (price difference between stores)
  const bestDeals = sampleProducts
    .map(product => {
      const rawPrices = allPrices.filter(p => p.productId === product.id);
      const prices = getLatestPricePerStore(rawPrices);
      if (prices.length < 2) return null;
      const cheapest = prices.reduce((min, p) => p.price < min.price ? p : min);
      const mostExpensive = prices.reduce((max, p) => p.price > max.price ? p : max);
      const savings = mostExpensive.price - cheapest.price;
      if (savings < 0.10) return null;
      const cheapestStore = stores.find(s => s.id === cheapest.storeId);
      return { product, cheapest, mostExpensive, savings, cheapestStore };
    })
    .filter(Boolean)
    .sort((a, b) => b!.savings - a!.savings)
    .slice(0, 8) as Array<{
      product: Product;
      cheapest: CollectedPrice;
      mostExpensive: CollectedPrice;
      savings: number;
      cheapestStore: Store | undefined;
    }>;

  // Latest successful collector run
  const latestRun = collectorRuns.find(r => r.status === "completed" && (r.productsFound ?? 0) > 0);
  const lastUpdated = latestRun?.finishedAt
    ? new Date(latestRun.finishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : null;

  // Category counts from sample
  const categoryCounts: Record<string, number> = {};
  for (const p of sampleProducts) {
    if (p.category) {
      categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
    }
  }

  return (
    <div className="min-h-screen bg-background">
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
            <Link href="/products">
              <Button variant="ghost" size="sm" data-testid="link-products" aria-label="Browse products">Products</Button>
            </Link>
            <Link href="/stores">
              <Button variant="ghost" size="sm" data-testid="link-stores" aria-label="Manage stores">Stores</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main id="main-content" className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Quick search */}
        <section className="mb-8" role="search">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" aria-hidden="true" />
            <Input
              placeholder="Search 1,000+ products... e.g. milk, eggs, chicken"
              value={quickSearch}
              onChange={(e) => setQuickSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && quickSearch.trim()) {
                  window.location.hash = `/products?q=${encodeURIComponent(quickSearch.trim())}`;
                }
              }}
              className="pl-12 pr-4 h-12 text-base rounded-xl border-2 focus:ring-2 focus:ring-blue-500"
              aria-label="Search products"
              data-testid="input-quick-search"
            />
            {quickSearch.trim() && (
              <Link href={`/products?q=${encodeURIComponent(quickSearch.trim())}`}>
                <Button
                  size="sm"
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  data-testid="button-search-go"
                >
                  Search <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </Link>
            )}
          </div>
        </section>

        {/* Stats row */}
        <div
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8"
          role="region"
          aria-label="Summary statistics"
        >
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center" aria-hidden="true">
                  <Package className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-xl font-semibold tabular-nums" data-testid="text-product-count">
                    {productsLoading ? <Skeleton className="h-6 w-10" /> : totalProducts.toLocaleString()}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Products</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center" aria-hidden="true">
                  <StoreIcon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-xl font-semibold tabular-nums" data-testid="text-store-count">{stores.length}</p>
                  <p className="text-[11px] text-muted-foreground">Stores</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center" aria-hidden="true">
                  <TrendingDown className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-xl font-semibold tabular-nums" data-testid="text-deals-count">{bestDeals.length}</p>
                  <p className="text-[11px] text-muted-foreground">Deals found</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center" aria-hidden="true">
                  <Clock className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium" data-testid="text-last-updated">
                    {lastUpdated || "—"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Last updated</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Triggered Alerts */}
        {alerts.filter(a => a.lastTriggered).length > 0 && (
          <div className="mb-8" role="region" aria-label="Price alerts">
            <div className="flex items-center gap-2 mb-3">
              <BellRing className="w-4 h-4 text-amber-500" aria-hidden="true" />
              <h2 className="text-base font-semibold">Price Alerts</h2>
            </div>
            <div className="space-y-2">
              {alerts.filter(a => a.lastTriggered).map((alert) => (
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
                          Price dropped
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Target: ${alert.targetPrice.toFixed(2)} · Triggered {alert.lastTriggered}
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-green-600 text-white text-[10px] shrink-0">Deal</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Best Deals */}
        <div className="mb-8" role="region" aria-label="Best deals">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold">Best Deals Today</h2>
            <Link href="/products">
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" data-testid="link-view-all">
                View all <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </div>

          {productsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))}
            </div>
          ) : bestDeals.length === 0 ? (
            <Card>
              <CardContent className="py-10 flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4" aria-hidden="true">
                  <TrendingDown className="w-6 h-6 text-muted-foreground" />
                </div>
                <h3 className="font-medium mb-1">
                  {totalProducts > 0 ? "No price differences found" : "No products collected yet"}
                </h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-xs">
                  {totalProducts > 0
                    ? "Add more stores to compare prices across locations."
                    : "Your Raspberry Pi will collect prices tonight. Check back tomorrow morning."}
                </p>
                <Link href="/products">
                  <Button size="sm" data-testid="button-browse-products">Browse Products</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {bestDeals.map(({ product, cheapest, savings, cheapestStore }) => {
                const icon = product.category ? (CATEGORY_ICONS[product.category] || "📦") : "📦";
                const unitPrice = product.sizeNum && product.sizeUnit
                  ? computeUnitPrice(cheapest.price, product.sizeNum, product.sizeUnit)
                  : null;

                return (
                  <Card key={product.id} data-testid={`deal-card-${product.id}`}>
                    <CardContent className="py-3 px-4 flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center shrink-0 text-base mt-0.5" aria-hidden="true">
                          {icon}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-tight line-clamp-2">{cleanProductName(product.name, product.brand)}</p>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {product.brand && (
                              <span className="text-[11px] text-muted-foreground">{product.brand}</span>
                            )}
                            {product.size && (
                              <span className="text-[11px] text-muted-foreground">· {product.size}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-primary tabular-nums">
                          ${cheapest.price.toFixed(2)}
                        </p>
                        {unitPrice && product.sizeUnit && (
                          <p className="text-[10px] text-muted-foreground tabular-nums">
                            {formatUnitPrice(unitPrice, product.sizeUnit)}
                          </p>
                        )}
                        {cheapestStore && (
                          <p className="text-[10px] text-muted-foreground">at {cheapestStore.name}</p>
                        )}
                        <p className="text-[11px] font-semibold text-green-600 mt-0.5">
                          Save ${savings.toFixed(2)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Browse by Category */}
        <div role="region" aria-label="Browse by category">
          <h2 className="text-base font-semibold mb-3">Browse by Category</h2>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {GROCERY_CATEGORIES.map(cat => (
              <Link key={cat} href={`/products?cat=${cat}`}>
                <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                  <CardContent className="py-3 px-2 flex flex-col items-center text-center">
                    <span className="text-2xl mb-1" aria-hidden="true">{CATEGORY_ICONS[cat] || "📦"}</span>
                    <p className="text-xs font-medium">{cat}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </main>

      <footer className="max-w-5xl mx-auto px-4 sm:px-6 py-6 border-t border-border" role="contentinfo">
        <p className="text-[10px] text-muted-foreground/50 text-center leading-relaxed max-w-2xl mx-auto">
          Prices are collected daily from Kroger-family stores in the San Diego area. Actual in-store prices may vary. Always verify prices at the store before purchasing.
        </p>
      </footer>
    </div>
  );
}
