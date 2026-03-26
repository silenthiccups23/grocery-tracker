import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import type { Store } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  ShoppingCart, ArrowLeft, Trash2, MapPin,
  Store as StoreIcon, Navigation,
  Loader2, MapPinned, Plus, Search
} from "lucide-react";

interface FoundStore {
  name: string;
  address: string;
  lat: number;
  lon: number;
}

export default function Stores() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [zip, setZip] = useState("");
  const [radius, setRadius] = useState("10");

  // Search results + selection state
  const [searchResults, setSearchResults] = useState<FoundStore[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedStores, setSelectedStores] = useState<Set<number>>(new Set());

  // "Your Stores" selection state (for bulk remove)
  const [selectedMyStores, setSelectedMyStores] = useState<Set<number>>(new Set());

  const { data: stores = [], isLoading } = useQuery<Store[]>({
    queryKey: ["/api/stores"],
  });

  // Search for stores (doesn't add them — just shows results)
  const searchMutation = useMutation({
    mutationFn: async ({ zipCode, radiusMiles }: { zipCode: string; radiusMiles: string }) => {
      const res = await apiRequest("GET", `/api/stores/search?zip=${encodeURIComponent(zipCode)}&radius=${radiusMiles}`);
      const data = await res.json();
      return (data.stores || []) as FoundStore[];
    },
    onSuccess: (found) => {
      // Deduplicate by chain name (keep one per chain)
      const seen = new Set<string>();
      const deduped: FoundStore[] = [];
      for (const store of found) {
        const chainName = store.name.toLowerCase().replace(/[^a-z]/g, "");
        if (!seen.has(chainName)) {
          seen.add(chainName);
          deduped.push(store);
        }
      }
      setSearchResults(deduped);
      setSelectedStores(new Set());
      setHasSearched(true);
      if (deduped.length === 0) {
        toast({ title: "No stores found", description: "Try a different zip code or increase the radius.", variant: "destructive" });
      }
    },
    onError: (err: Error) => {
      toast({ title: "Search failed", description: err.message, variant: "destructive" });
    },
  });

  // Add selected stores
  const addMutation = useMutation({
    mutationFn: async (storesToAdd: FoundStore[]) => {
      const res = await apiRequest("POST", "/api/stores/bulk", { stores: storesToAdd });
      return res.json();
    },
    onSuccess: (created: any[]) => {
      queryClient.invalidateQueries({ queryKey: ["/api/stores"] });
      // Remove added stores from search results
      const addedNames = new Set(created.map((s: any) => s.name.toLowerCase()));
      setSearchResults(prev => prev.filter(s => !addedNames.has(s.name.toLowerCase())));
      setSelectedStores(new Set());
      toast({
        title: `${created.length} store${created.length === 1 ? "" : "s"} added`,
        description: "Head to the dashboard to compare prices.",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Error adding stores", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/stores/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stores"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prices"] });
      toast({ title: "Store removed" });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      await Promise.all(ids.map(id => apiRequest("DELETE", `/api/stores/${id}`)));
      return ids.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["/api/stores"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prices"] });
      setSelectedMyStores(new Set());
      toast({ title: `${count} store${count === 1 ? "" : "s"} removed` });
    },
    onError: (err: Error) => {
      toast({ title: "Error removing stores", description: err.message, variant: "destructive" });
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!zip.trim() || !/^\d{5}$/.test(zip.trim())) {
      toast({ title: "Enter a valid zip code", description: "Must be a 5-digit US zip code.", variant: "destructive" });
      return;
    }
    searchMutation.mutate({ zipCode: zip.trim(), radiusMiles: radius });
  };

  const toggleStore = (index: number) => {
    setSelectedStores(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedStores(new Set(searchResults.map((_, i) => i)));
  };

  const clearSelection = () => {
    setSelectedStores(new Set());
  };

  const handleAddSelected = () => {
    const storesToAdd = searchResults.filter((_, i) => selectedStores.has(i));
    if (storesToAdd.length === 0) {
      toast({ title: "No stores selected", description: "Check the stores you want to add.", variant: "destructive" });
      return;
    }
    addMutation.mutate(storesToAdd);
  };

  const openInMaps = (addr: string) => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`, "_blank");
  };

  // "Your Stores" selection helpers
  const toggleMyStore = (id: number) => {
    setSelectedMyStores(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const selectAllMyStores = () => setSelectedMyStores(new Set(stores.map(s => s.id)));
  const clearMySelection = () => setSelectedMyStores(new Set());
  const handleRemoveSelected = () => {
    const ids = Array.from(selectedMyStores);
    if (ids.length === 0) return;
    bulkDeleteMutation.mutate(ids);
  };

  // Filter out stores already in the user's list
  const existingNames = new Set(stores.map(s => s.name.toLowerCase()));
  const filteredResults = searchResults.filter(s => !existingNames.has(s.name.toLowerCase()));

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-lg font-semibold tracking-tight">My Stores</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Zip code + radius search */}
        <Card className="mb-6">
          <CardContent className="pt-5 pb-5 px-5">
            <div className="flex items-center gap-3 mb-3">
              <MapPinned className="w-5 h-5 text-primary shrink-0" />
              <div>
                <h2 className="text-sm font-semibold">Find stores near you</h2>
                <p className="text-xs text-muted-foreground">Search by zip code and radius, then pick the stores you want to track.</p>
              </div>
            </div>
            <form onSubmit={handleSearch} className="flex flex-wrap gap-2 items-center">
              <Input
                placeholder="Zip code (e.g. 92154)"
                value={zip}
                onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
                className="max-w-[170px]"
                data-testid="input-zip"
              />
              <Select value={radius} onValueChange={setRadius}>
                <SelectTrigger className="w-[110px]" data-testid="select-radius">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 mile</SelectItem>
                  <SelectItem value="5">5 miles</SelectItem>
                  <SelectItem value="10">10 miles</SelectItem>
                  <SelectItem value="25">25 miles</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="submit"
                disabled={searchMutation.isPending || !zip.trim()}
                data-testid="button-search-stores"
              >
                {searchMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <Search className="w-4 h-4 mr-1.5" />
                )}
                {searchMutation.isPending ? "Searching..." : "Search"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Search Results */}
        {hasSearched && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">
                Search Results ({filteredResults.length})
              </h2>
              {filteredResults.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={selectAll}
                    className={`text-xs hover:underline ${selectedStores.size < filteredResults.length ? "text-primary" : "text-muted-foreground"}`}
                    data-testid="button-select-all"
                  >
                    Select all
                  </button>
                  <span className="text-muted-foreground/40">|</span>
                  <button
                    onClick={clearSelection}
                    className={`text-xs hover:underline ${selectedStores.size > 0 ? "text-primary" : "text-muted-foreground"}`}
                    data-testid="button-clear-selection"
                  >
                    Deselect all
                  </button>
                  <Button
                    size="sm"
                    onClick={handleAddSelected}
                    disabled={selectedStores.size === 0 || addMutation.isPending}
                    data-testid="button-add-selected"
                  >
                    {addMutation.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                    ) : (
                      <Plus className="w-3.5 h-3.5 mr-1" />
                    )}
                    Add {selectedStores.size > 0 ? `(${selectedStores.size})` : "selected"}
                  </Button>
                </div>
              )}
            </div>

            {filteredResults.length === 0 ? (
              <Card>
                <CardContent className="py-8 flex flex-col items-center text-center">
                  <p className="text-sm text-muted-foreground">
                    {searchResults.length > 0
                      ? "All found stores are already in your list."
                      : "No grocery chain stores found in this area. Try a wider radius or different zip code."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-1.5">
                {filteredResults.map((store, index) => {
                  const isSelected = selectedStores.has(index);
                  return (
                    <label
                      key={`${store.name}-${index}`}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-primary/5 border-primary/25"
                          : "bg-card border-border hover:bg-muted/50"
                      }`}
                      data-testid={`search-result-${index}`}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleStore(index)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{store.name}</p>
                        {store.address && (
                          <p className="text-xs text-muted-foreground truncate">{store.address}</p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Existing store list */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Your Stores ({stores.length})</h2>
          {stores.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={selectAllMyStores}
                className={`text-xs hover:underline ${selectedMyStores.size < stores.length ? "text-primary" : "text-muted-foreground"}`}
                data-testid="button-select-all-my"
              >
                Select all
              </button>
              <span className="text-muted-foreground/40">|</span>
              <button
                onClick={clearMySelection}
                className={`text-xs hover:underline ${selectedMyStores.size > 0 ? "text-primary" : "text-muted-foreground"}`}
                data-testid="button-deselect-all-my"
              >
                Deselect all
              </button>
              {selectedMyStores.size > 0 && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleRemoveSelected}
                  disabled={bulkDeleteMutation.isPending}
                  data-testid="button-remove-selected"
                >
                  {bulkDeleteMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                  )}
                  Remove ({selectedMyStores.size})
                </Button>
              )}
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : stores.length === 0 ? (
          <Card>
            <CardContent className="py-12 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <StoreIcon className="w-6 h-6 text-muted-foreground" />
              </div>
              <h3 className="font-medium mb-1">No stores yet</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Search for stores above and pick the ones you want to track.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {stores.map((store) => {
              const isSelected = selectedMyStores.has(store.id);
              return (
                <Card key={store.id} className={isSelected ? "border-destructive/25 bg-destructive/5" : ""}>
                  <CardContent className="py-4 px-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleMyStore(store.id)}
                            data-testid={`checkbox-my-store-${store.id}`}
                          />
                        </div>
                        <div>
                          <p className="text-sm font-medium" data-testid={`text-store-name-${store.id}`}>{store.name}</p>
                          {store.location && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 shrink-0" />
                              {store.location}
                            </p>
                          )}
                          {store.address && (
                            <button
                              onClick={() => openInMaps(store.address!)}
                              className="text-xs text-primary/70 hover:text-primary flex items-center gap-1 mt-0.5 hover:underline"
                              data-testid={`link-address-${store.id}`}
                            >
                              <Navigation className="w-3 h-3 shrink-0" />
                              {store.address}
                            </button>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => deleteMutation.mutate(store.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-store-${store.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
