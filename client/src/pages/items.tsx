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
import { ShoppingCart, ArrowLeft, Plus, Trash2, Package, Pencil, X, Check, Search } from "lucide-react";

const CATEGORIES = [
  "Produce", "Dairy", "Meat", "Bakery", "Frozen",
  "Beverages", "Snacks", "Pantry", "Household", "Other"
];

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  Produce: "Fruits, vegetables, herbs",
  Dairy: "Milk, cheese, yogurt, eggs, butter",
  Meat: "Beef, chicken, pork, fish, deli",
  Bakery: "Bread, rolls, tortillas, pastries",
  Frozen: "Frozen meals, pizza, ice cream, veggies",
  Beverages: "Water, juice, soda, coffee, tea",
  Snacks: "Chips, crackers, cookies, nuts, bars",
  Pantry: "Cereal, pasta, rice, canned goods, oils",
  Household: "Cleaning, paper goods, bags, soap",
  Other: "Anything else",
};

const unitLabels: Record<string, string> = {
  "fl oz": "Fluid Ounces (fl oz)",
  "oz": "Ounces (oz)",
  "lb": "Pounds (lb)",
  "ct": "Count (ct)",
  "gal": "Gallons (gal)",
  "L": "Liters (L)",
};

// Inline edit component for a single item
function ItemEditRow({ item, onDone }: { item: Item; onDone: () => void }) {
  const { toast } = useToast();
  const [editName, setEditName] = useState(item.name);
  const [editCategory, setEditCategory] = useState(item.category || "");
  const [editTags, setEditTags] = useState<string[]>(parseTags(item));
  const [editUnit, setEditUnit] = useState(item.defaultUnit || "");

  const availableTags = editCategory ? (TAG_OPTIONS[editCategory] || TAG_OPTIONS["Other"]) : [];

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/items/${item.id}`, {
        name: editName.trim(),
        category: editCategory || null,
        tags: editTags.length > 0 ? JSON.stringify(editTags) : null,
        defaultUnit: editUnit || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prices"] });
      toast({ title: "Item updated" });
      onDone();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const toggleTag = (tag: string) => {
    setEditTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const handleCategoryChange = (cat: string) => {
    if (editCategory === cat) {
      setEditCategory("");
      setEditTags([]);
      setEditUnit("");
    } else {
      setEditCategory(cat);
      // Keep tags that exist in the new category, drop ones that don't
      const newAvailable = TAG_OPTIONS[cat] || [];
      setEditTags(prev => prev.filter(t => newAvailable.includes(t)));
      setEditUnit(DEFAULT_UNITS[cat] || "oz");
    }
  };

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="py-4 px-5 space-y-4">
        {/* Name */}
        <div>
          <Label className="text-xs font-medium text-muted-foreground mb-1 block">Name</Label>
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="text-sm"
            data-testid={`edit-name-${item.id}`}
          />
        </div>

        {/* Category */}
        <div>
          <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Category</Label>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => handleCategoryChange(cat)}
                className={`text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
                  editCategory === cat
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-foreground border-border hover:bg-muted"
                }`}
              >
                {CATEGORY_ICONS[cat] || "📦"} {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Unit */}
        {editCategory && (
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Measured in</Label>
            <div className="flex flex-wrap gap-1.5">
              {(CATEGORY_UNITS[editCategory] || UNITS).map(u => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setEditUnit(u)}
                  className={`text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
                    editUnit === u
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-foreground border-border hover:bg-muted"
                  }`}
                >
                  {unitLabels[u] || u}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        {editCategory && availableTags.length > 0 && (
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Type</Label>
            <div className="flex flex-wrap gap-1.5">
              {availableTags.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
                    editTags.includes(tag)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-foreground border-border hover:bg-muted"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Save / Cancel */}
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending || !editName.trim()}
            data-testid={`button-save-edit-${item.id}`}
          >
            <Check className="w-3.5 h-3.5 mr-1" />
            {updateMutation.isPending ? "Saving..." : "Save"}
          </Button>
          <Button size="sm" variant="outline" onClick={onDone} data-testid={`button-cancel-edit-${item.id}`}>
            <X className="w-3.5 h-3.5 mr-1" />
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Items() {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [defaultUnit, setDefaultUnit] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);

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
            <h1 className="text-lg font-semibold tracking-tight">My Items</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Add Item Form */}
        <Card className="mb-8">
          <CardContent className="pt-5 pb-5 px-5">
            <h2 className="text-sm font-semibold mb-4">Add an Item</h2>
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Step 1: Name */}
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">1</span>
                  What product are you tracking?
                </Label>
                <div className="relative">
                  <Input
                    ref={inputRef}
                    placeholder="Start typing... e.g. Milk, Yogurt, Chicken Breast"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                    className="text-sm"
                    autoComplete="off"
                    data-testid="input-item-name"
                  />
                  {/* Autocomplete dropdown */}
                  {showSuggestions && suggestions.length > 0 && (
                    <div
                      ref={suggestionsRef}
                      className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden"
                      data-testid="suggestions-dropdown"
                    >
                      {suggestions[0].name.toLowerCase() !== name.toLowerCase().trim() && (
                        <p className="text-[11px] text-muted-foreground px-3 pt-2 pb-1">Did you mean...</p>
                      )}
                      {suggestions.map((product, i) => (
                        <button
                          key={`${product.name}-${i}`}
                          type="button"
                          onClick={() => selectSuggestion(product)}
                          className="w-full text-left px-3 py-2.5 hover:bg-muted/60 flex items-center gap-3 transition-colors"
                          data-testid={`suggestion-${i}`}
                        >
                          <span className="text-base">{CATEGORY_ICONS[product.category] || "📦"}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{product.name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {product.category} · per {product.defaultUnit}
                              {product.relevantTags.length > 0 && (
                                <> · {product.relevantTags.slice(0, 4).join(", ")}{product.relevantTags.length > 4 ? "..." : ""}</>
                              )}
                            </p>
                          </div>
                          <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
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
                  <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">2</span>
                  Pick a category
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {CATEGORIES.map((cat) => {
                    const icon = CATEGORY_ICONS[cat] || "📦";
                    const desc = CATEGORY_DESCRIPTIONS[cat] || "";
                    const isSelected = category === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => handleCategoryChange(cat)}
                        className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg border text-center transition-all ${
                          isSelected
                            ? "bg-primary/10 border-primary/40 ring-1 ring-primary/20"
                            : "bg-card border-border hover:bg-muted/50 hover:border-muted-foreground/20"
                        }`}
                        data-testid={`button-category-${cat.toLowerCase()}`}
                      >
                        <span className="text-lg leading-none">{icon}</span>
                        <span className={`text-xs font-medium ${isSelected ? "text-primary" : "text-foreground"}`}>{cat}</span>
                        <span className="text-[10px] text-muted-foreground leading-tight">{desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 3: Unit */}
              {category && (
                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">3</span>
                    How is this product measured?
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {(CATEGORY_UNITS[category] || UNITS).map((u) => {
                      const isSelected = defaultUnit === u;
                      return (
                        <button
                          key={u}
                          type="button"
                          onClick={() => setDefaultUnit(u)}
                          className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-card text-foreground border-border hover:bg-muted"
                          }`}
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
                    <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">4</span>
                    What type? (pick all that apply)
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {availableTags.map((tag) => {
                      const isSelected = selectedTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          className={`text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-card text-foreground border-border hover:bg-muted"
                          }`}
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
                  <Button type="submit" disabled={createMutation.isPending} className="w-full sm:w-auto" data-testid="button-add-item">
                    <Plus className="w-4 h-4 mr-1.5" />
                    {createMutation.isPending ? "Adding..." : `Add ${name.trim()}`}
                  </Button>
                </div>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Item list */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Your Items ({items.length})</h2>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="py-12 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <Package className="w-6 h-6 text-muted-foreground" />
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
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center shrink-0 text-base">
                        {icon}
                      </div>
                      <div>
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
                              <span className="text-[11px] text-muted-foreground">·</span>
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
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => setEditingId(item.id)}
                        data-testid={`button-edit-item-${item.id}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteMutation.mutate(item.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-item-${item.id}`}
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
