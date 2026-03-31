import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import type { Item } from "@shared/schema";
import { TAG_OPTIONS, parseTags, UNITS, DEFAULT_UNITS, CATEGORY_ICONS, CATEGORY_UNITS } from "@shared/schema";
import { searchProducts as searchCatalog, type ProductEntry } from "@shared/products";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { ShoppingCart, ArrowLeft, Plus, Trash2, Package, Pencil, X, Search, List, Loader2 } from "lucide-react";
import { CATEGORIES, CATEGORY_DESCRIPTIONS, unitLabels } from "@/lib/constants";
import { ItemEditRow } from "@/components/ItemEditRow";
import { PriceAlertButton } from "@/components/PriceAlertButton";

export default function Items() {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [defaultUnit, setDefaultUnit] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [addMode, setAddMode] = useState<"single" | "bulk">("single");

  // Bulk add state
  const [bulkText, setBulkText] = useState("");
  const [bulkParsed, setBulkParsed] = useState<Array<{ raw: string; match: ProductEntry | null; selected: boolean }>>([]);
  const [bulkStep, setBulkStep] = useState<"input" | "preview">("input");

  const parseBulkText = () => {
    const lines = bulkText
      .split(/[,\n]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
    const parsed = lines.map(raw => {
      const results = searchCatalog(raw);
      const match = results.length > 0 ? results[0] : null;
      return { raw, match, selected: true };
    });
    setBulkParsed(parsed);
    setBulkStep("preview");
  };

  const toggleBulkItem = (index: number) => {
    setBulkParsed(prev => prev.map((item, i) => i === index ? { ...item, selected: !item.selected } : item));
  };

  const bulkAddMutation = useMutation({
    mutationFn: async (items: Array<{ name: string; category: string | null; tags: string | null; defaultUnit: string | null }>) => {
      const res = await apiRequest("POST", "/api/items/bulk", { items });
      return res.json();
    },
    onSuccess: (created: any[]) => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      setBulkText("");
      setBulkParsed([]);
      setBulkStep("input");
      toast({ title: `${created.length} item${created.length === 1 ? "" : "s"} added`, description: "Fetch prices to get pricing for the new items." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleBulkAdd = () => {
    const toAdd = bulkParsed
      .filter(p => p.selected)
      .map(p => ({
        name: p.match?.name || p.raw,
        category: p.match?.category || null,
        tags: null, // no tags in bulk mode — user can edit after
        defaultUnit: p.match?.defaultUnit || null,
      }));
    if (toAdd.length === 0) return;
    bulkAddMutation.mutate(toAdd);
  };

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<ProductEntry[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [matchedProduct, setMatchedProduct] = useState<ProductEntry | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleNameChange = (value: string) => {
    setName(value);
    setMatchedProduct(null);
    if (value.trim().length >= 2) {
      const results = searchCatalog(value);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const selectSuggestion = (product: ProductEntry) => {
    setName(product.name);
    setCategory(product.category);
    setDefaultUnit(product.defaultUnit);
    setSelectedTags([]);
    setMatchedProduct(product);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const { data: items = [], isLoading } = useQuery<Item[]>({
    queryKey: ["/api/items"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; category: string | null; tags: string | null; defaultUnit: string | null }) => {
      const res = await apiRequest("POST", "/api/items", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prices"] });
      setName("");
      setCategory("");
      setSelectedTags([]);
      setDefaultUnit("");
      toast({ title: "Item added", description: "Now log prices for this item at your stores." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/items/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prices"] });
      toast({ title: "Item removed" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate({
      name: name.trim(),
      category: category || null,
      tags: selectedTags.length > 0 ? JSON.stringify(selectedTags) : null,
      defaultUnit: defaultUnit || null,
    });
  };

  // If a product was selected from catalog, show only its relevant tags.
  // Otherwise show all tags for the category.
  const availableTags = matchedProduct
    ? matchedProduct.relevantTags
    : category
      ? (TAG_OPTIONS[category] || TAG_OPTIONS["Other"])
      : [];

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleCategoryChange = (cat: string) => {
    if (category === cat) {
      setCategory("");
      setSelectedTags([]);
      setDefaultUnit("");
    } else {
      setCategory(cat);
      setSelectedTags([]);
      setDefaultUnit(DEFAULT_UNITS[cat] || "oz");
    }
  };

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
              <h1 className="text-lg font-semibold tracking-tight">My Items</h1>
            </div>
          </div>
        </nav>
      </header>

      <main id="main-content" className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Add Item Form */}
        <section role="region" aria-label="Add items">
        <Card className="mb-8">
          <CardContent className="pt-5 pb-5 px-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold">Add Items</h2>
              <div className="flex items-center bg-muted rounded-lg p-0.5" role="group" aria-label="Add mode">
                <button
                  type="button"
                  onClick={() => { setAddMode("single"); setBulkStep("input"); }}
                  className={`text-xs px-3 py-1.5 min-h-[44px] rounded-md transition-colors focus:ring-2 focus:ring-blue-500 ${addMode === "single" ? "bg-card text-foreground shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"}`}
                  aria-label="Single item add mode"
                  aria-pressed={addMode === "single"}
                  data-testid="button-mode-single"
                >
                  <Plus className="w-3 h-3 inline mr-1" aria-hidden="true" />Single
                </button>
                <button
                  type="button"
                  onClick={() => setAddMode("bulk")}
                  className={`text-xs px-3 py-1.5 min-h-[44px] rounded-md transition-colors focus:ring-2 focus:ring-blue-500 ${addMode === "bulk" ? "bg-card text-foreground shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"}`}
                  aria-label="Bulk add mode"
                  aria-pressed={addMode === "bulk"}
                  data-testid="button-mode-bulk"
                >
                  <List className="w-3 h-3 inline mr-1" aria-hidden="true" />Bulk Add
                </button>
              </div>
            </div>

            {addMode === "bulk" ? (
              <div className="space-y-4">
                {bulkStep === "input" ? (
                  <>
                    <div>
                      <Label htmlFor="bulk-textarea" className="text-xs font-medium text-muted-foreground mb-1.5 block">
                        Type or paste your grocery list
                      </Label>
                      <Textarea
                        id="bulk-textarea"
                        placeholder={"Milk\nEggs\nChicken Breast\nRice\nBananas, Avocados, Tortillas"}
                        value={bulkText}
                        onChange={(e) => setBulkText(e.target.value)}
                        className="text-sm min-h-[120px] w-full focus:ring-2 focus:ring-blue-500"
                        aria-label="Grocery list for bulk add"
                        aria-describedby="bulk-textarea-hint"
                        data-testid="textarea-bulk"
                      />
                      <p id="bulk-textarea-hint" className="text-[11px] text-muted-foreground mt-1">Separate items with commas or new lines. We'll match them to products automatically.</p>
                    </div>
                    <Button
                      type="button"
                      onClick={parseBulkText}
                      disabled={!bulkText.trim()}
                      className="w-full sm:w-auto min-h-[44px] focus:ring-2 focus:ring-blue-500"
                      aria-label={`Find products for ${bulkText.split(/[,\n]+/).filter(s => s.trim()).length} items`}
                      data-testid="button-bulk-parse"
                    >
                      <Search className="w-4 h-4 mr-1.5" aria-hidden="true" />
                      Find Products ({bulkText.split(/[,\n]+/).filter(s => s.trim()).length})
                    </Button>
                  </>
                ) : (
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-xs font-medium text-muted-foreground">
                          Review matches ({bulkParsed.filter(p => p.selected).length} selected)
                        </Label>
                        <button
                          type="button"
                          onClick={() => setBulkStep("input")}
                          className="text-xs text-primary hover:underline min-h-[44px] focus:ring-2 focus:ring-blue-500 rounded"
                          aria-label="Back to edit grocery list"
                        >
                          Back to edit
                        </button>
                      </div>
                      <div className="space-y-1.5" aria-live="polite" aria-atomic="false">
                        {bulkParsed.map((item, i) => (
                          <label
                            key={i}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors min-h-[44px] ${
                              item.selected
                                ? item.match ? "bg-primary/5 border-primary/25" : "bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700"
                                : "bg-muted/30 border-transparent opacity-50"
                            }`}
                            data-testid={`bulk-item-${i}`}
                          >
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={() => toggleBulkItem(i)}
                              className="rounded min-h-[18px] min-w-[18px] focus:ring-2 focus:ring-blue-500"
                              aria-label={`Include ${item.match?.name || item.raw} in bulk add`}
                            />
                            {item.match ? (
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-base">{CATEGORY_ICONS[item.match.category] || "📦"}</span>
                                  <span className="text-sm font-medium">{item.match.name}</span>
                                  <Badge variant="secondary" className="text-[10px]">{item.match.category}</Badge>
                                  <span className="text-[10px] text-muted-foreground">per {item.match.defaultUnit}</span>
                                </div>
                                {item.raw.toLowerCase() !== item.match.name.toLowerCase() && (
                                  <p className="text-[10px] text-muted-foreground mt-0.5 ml-7">
                                    Matched from "{item.raw}"
                                  </p>
                                )}
                              </div>
                            ) : (
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-base">❓</span>
                                  <span className="text-sm font-medium">{item.raw}</span>
                                  <span className="text-[10px] text-amber-600 dark:text-amber-400">No match found</span>
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-0.5 ml-7">
                                  Will be added as-is. You can edit it later.
                                </p>
                              </div>
                            )}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        onClick={handleBulkAdd}
                        disabled={bulkAddMutation.isPending || bulkParsed.filter(p => p.selected).length === 0}
                        className="w-full sm:w-auto min-h-[44px] focus:ring-2 focus:ring-blue-500"
                        aria-label={`Add ${bulkParsed.filter(p => p.selected).length} selected items`}
                        data-testid="button-bulk-add"
                      >
                        {bulkAddMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-1.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <Plus className="w-4 h-4 mr-1.5" aria-hidden="true" />
                        )}
                        Add {bulkParsed.filter(p => p.selected).length} Items
                      </Button>
                      <Button type="button" variant="outline" onClick={() => { setBulkStep("input"); setBulkParsed([]); }} className="w-full sm:w-auto min-h-[44px] focus:ring-2 focus:ring-blue-500" aria-label="Cancel bulk add">
                        <X className="w-4 h-4 mr-1" aria-hidden="true" /> Cancel
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ) : (
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Step 1: Name */}
              <div>
                <Label htmlFor="item-name-input" className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold" aria-hidden="true">1</span>
                  What product are you tracking?
                </Label>
                <div className="relative">
                  <Input
                    id="item-name-input"
                    ref={inputRef}
                    placeholder="Start typing... e.g. Milk, Yogurt, Chicken Breast"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                    className="text-sm w-full min-h-[44px] focus:ring-2 focus:ring-blue-500"
                    autoComplete="off"
                    aria-label="Product name"
                    aria-autocomplete="list"
                    aria-expanded={showSuggestions}
                    aria-controls={showSuggestions ? "suggestions-listbox" : undefined}
                    data-testid="input-item-name"
                  />
                  {/* Autocomplete dropdown */}
                  {showSuggestions && suggestions.length > 0 && (
                    <div
                      id="suggestions-listbox"
                      ref={suggestionsRef}
                      className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden"
                      role="listbox"
                      aria-label="Product suggestions"
                      data-testid="suggestions-dropdown"
                    >
                      {suggestions[0].name.toLowerCase() !== name.toLowerCase().trim() && (
                        <p className="text-[11px] text-muted-foreground px-3 pt-2 pb-1" aria-hidden="true">Did you mean...</p>
                      )}
                      {suggestions.map((product, i) => (
                        <button
                          key={`${product.name}-${i}`}
                          type="button"
                          role="option"
                          aria-selected={false}
                          onClick={() => selectSuggestion(product)}
                          className="w-full text-left px-3 py-2.5 min-h-[44px] hover:bg-muted/60 flex items-center gap-3 transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          aria-label={`Select ${product.name}, ${product.category}, per ${product.defaultUnit}`}
                          data-testid={`suggestion-${i}`}
                        >
                          <span className="text-base" aria-hidden="true">{CATEGORY_ICONS[product.category] || "📦"}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{product.name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {product.category} · per {product.defaultUnit}
                              {product.relevantTags.length > 0 && (
                                <> · {product.relevantTags.slice(0, 4).join(", ")}{product.relevantTags.length > 4 ? "..." : ""}</>
                              )}
                            </p>
                          </div>
                          <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {matchedProduct
                    ? `✓ Matched to "${matchedProduct.name}" — category, unit, and tags auto-filled.`
                    : "Type a product name and pick from suggestions for the best results."
                  }
                </p>
              </div>

              {/* Step 2: Category */}
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold" aria-hidden="true">2</span>
                  Pick a category
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2" role="group" aria-label="Category selection">
                  {CATEGORIES.map((cat) => {
                    const icon = CATEGORY_ICONS[cat] || "📦";
                    const desc = CATEGORY_DESCRIPTIONS[cat] || "";
                    const isSelected = category === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => handleCategoryChange(cat)}
                        className={`flex flex-col items-center gap-1 px-2 py-2.5 min-h-[44px] rounded-lg border text-center transition-all focus:ring-2 focus:ring-blue-500 ${
                          isSelected
                            ? "bg-primary/10 border-primary/40 ring-1 ring-primary/20"
                            : "bg-card border-border hover:bg-muted/50 hover:border-muted-foreground/20"
                        }`}
                        aria-pressed={isSelected}
                        aria-label={`${cat}: ${desc}`}
                        data-testid={`button-category-${cat.toLowerCase()}`}
                      >
                        <span className="text-lg leading-none" aria-hidden="true">{icon}</span>
                        <span className={`text-xs font-medium ${isSelected ? "text-primary" : "text-foreground"}`}>{cat}</span>
                        <span className="text-[10px] text-muted-foreground leading-tight" aria-hidden="true">{desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 3: Unit */}
              {category && (
                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold" aria-hidden="true">3</span>
                    How is this product measured?
                  </Label>
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Unit of measurement selection">
                    {(CATEGORY_UNITS[category] || UNITS).map((u) => {
                      const isSelected = defaultUnit === u;
                      return (
                        <button
                          key={u}
                          type="button"
                          onClick={() => setDefaultUnit(u)}
                          className={`text-xs px-3 py-1.5 min-h-[44px] rounded-md border transition-colors focus:ring-2 focus:ring-blue-500 ${
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-card text-foreground border-border hover:bg-muted"
                          }`}
                          aria-pressed={isSelected}
                          aria-label={`Measure in ${unitLabels[u] || u}`}
                          data-testid={`button-unit-${u.replace(/\s/g, "-")}`}
                        >
                          {unitLabels[u] || u}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Step 4: Tags */}
              {category && availableTags.length > 0 && (
                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold" aria-hidden="true">4</span>
                    What type? (pick all that apply)
                  </Label>
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Type tags">
                    {availableTags.map((tag) => {
                      const isSelected = selectedTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          className={`text-xs px-2.5 py-1.5 min-h-[44px] rounded-md border transition-colors focus:ring-2 focus:ring-blue-500 ${
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-card text-foreground border-border hover:bg-muted"
                          }`}
                          aria-pressed={isSelected}
                          aria-label={`${isSelected ? "Remove" : "Add"} tag: ${tag}`}
                          data-testid={`button-tag-${tag.toLowerCase().replace(/\s+/g, "-")}`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                  {selectedTags.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Selected: {selectedTags.join(", ")}
                    </p>
                  )}
                </div>
              )}

              {/* Submit */}
              {name.trim() && (
                <div className="pt-1">
                  <Button type="submit" disabled={createMutation.isPending} className="w-full sm:w-auto min-h-[44px] focus:ring-2 focus:ring-blue-500" aria-label={createMutation.isPending ? "Adding item" : `Add ${name.trim()} to your items`} data-testid="button-add-item">
                    <Plus className="w-4 h-4 mr-1.5" aria-hidden="true" />
                    {createMutation.isPending ? "Adding..." : `Add ${name.trim()}`}
                  </Button>
                </div>
              )}
            </form>
            )}
          </CardContent>
        </Card>
        </section>

        {/* Item list */}
        <section role="region" aria-label="Your items">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Your Items ({items.length})</h2>
          </div>

          <div aria-live="polite" aria-atomic="false">
          {isLoading ? (
            <div className="space-y-3" role="status" aria-label="Loading items">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <Card>
              <CardContent className="py-12 flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4" aria-hidden="true">
                  <Package className="w-6 h-6 text-muted-foreground" aria-hidden="true" />
                </div>
                <h3 className="font-medium mb-1">No items yet</h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Add the grocery items you want to track. Pick a category, choose how it's measured, and select the type.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {items.map((item) => {
                if (editingId === item.id) {
                  return (
                    <ItemEditRow
                      key={item.id}
                      item={item}
                      onDone={() => setEditingId(null)}
                    />
                  );
                }

                const itemTags = parseTags(item);
                const icon = item.category ? (CATEGORY_ICONS[item.category] || "📦") : "📦";
                return (
                  <Card key={item.id}>
                    <CardContent className="py-3 px-5 flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center shrink-0 text-base" aria-hidden="true">
                          {icon}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium" data-testid={`text-item-name-${item.id}`}>{item.name}</p>
                            {item.category && (
                              <Badge variant="secondary" className="text-xs" data-testid={`badge-item-category-${item.id}`}>
                                {item.category}
                              </Badge>
                            )}
                          </div>
                          {(itemTags.length > 0 || item.defaultUnit) && (
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              {item.defaultUnit && (
                                <span className="text-[11px] text-muted-foreground">
                                  per {item.defaultUnit}
                                </span>
                              )}
                              {itemTags.length > 0 && item.defaultUnit && (
                                <span className="text-[11px] text-muted-foreground" aria-hidden="true">·</span>
                              )}
                              {itemTags.map((tag) => (
                                <Badge
                                  key={tag}
                                  variant="outline"
                                  className="text-[11px] h-5 px-1.5 border-primary/30 text-primary"
                                  data-testid={`badge-item-tag-${item.id}-${tag}`}
                                >
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <PriceAlertButton itemId={item.id} itemName={item.name} />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 min-h-[44px] min-w-[44px] text-muted-foreground hover:text-primary focus:ring-2 focus:ring-blue-500"
                          onClick={() => setEditingId(item.id)}
                          aria-label={`Edit ${item.name}`}
                          data-testid={`button-edit-item-${item.id}`}
                        >
                          <Pencil className="w-4 h-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 min-h-[44px] min-w-[44px] text-muted-foreground hover:text-destructive focus:ring-2 focus:ring-blue-500"
                          onClick={() => deleteMutation.mutate(item.id)}
                          disabled={deleteMutation.isPending}
                          aria-label={`Delete ${item.name}`}
                          data-testid={`button-delete-item-${item.id}`}
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
          </div>
        </section>
      </main>
    </div>
  );
}
