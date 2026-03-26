import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import type { Store, Item } from "@shared/schema";
import { parseTags, UNITS, computeUnitPrice, formatUnitPrice } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ShoppingCart, ArrowLeft, Check, DollarSign } from "lucide-react";

export default function AddPrice() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [itemId, setItemId] = useState("");
  const [storeId, setStoreId] = useState("");
  const [price, setPrice] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [size, setSize] = useState("");
  const [unit, setUnit] = useState("");

  const { data: stores = [] } = useQuery<Store[]>({
    queryKey: ["/api/stores"],
  });
  const { data: items = [] } = useQuery<Item[]>({
    queryKey: ["/api/items"],
  });

  // When an item is selected, auto-fill the unit from its default
  useEffect(() => {
    if (itemId) {
      const selectedItem = items.find(i => String(i.id) === itemId);
      if (selectedItem?.defaultUnit) {
        setUnit(selectedItem.defaultUnit);
      }
    }
  }, [itemId, items]);

  const createMutation = useMutation({
    mutationFn: async (data: {
      itemId: number; storeId: number; price: number; date: string;
      size: number | null; unit: string | null;
    }) => {
      const res = await apiRequest("POST", "/api/prices", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prices"] });
      toast({ title: "Price logged", description: "Your price entry has been saved." });
      setItemId("");
      setPrice("");
      setSize("");
      setUnit("");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedPrice = parseFloat(price);
    const parsedSize = size ? parseFloat(size) : null;
    if (!itemId || !storeId || isNaN(parsedPrice) || parsedPrice <= 0) {
      toast({ title: "Missing info", description: "Please fill in all fields.", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      itemId: parseInt(itemId),
      storeId: parseInt(storeId),
      price: parsedPrice,
      date,
      size: parsedSize && parsedSize > 0 ? parsedSize : null,
      unit: unit || null,
    });
  };

  // Format the item label with its tags
  const formatItemLabel = (item: Item): string => {
    const tags = parseTags(item);
    let label = item.name;
    if (tags.length > 0) label += ` — ${tags.join(", ")}`;
    if (item.category) label += ` (${item.category})`;
    return label;
  };

  // Compute live unit price preview
  const parsedPrice = parseFloat(price);
  const parsedSize = parseFloat(size);
  const liveUnitPrice = (!isNaN(parsedPrice) && !isNaN(parsedSize) && parsedSize > 0 && unit)
    ? computeUnitPrice(parsedPrice, parsedSize, unit)
    : null;

  const canSubmit = itemId && storeId && price && parseFloat(price) > 0;
  const needsSetup = stores.length === 0 || items.length === 0;

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
            <h1 className="text-lg font-semibold tracking-tight">Log a Price</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {needsSetup ? (
          <Card>
            <CardContent className="py-12 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <DollarSign className="w-6 h-6 text-muted-foreground" />
              </div>
              <h3 className="font-medium mb-1">Setup needed</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-xs">
                Before logging prices, you need at least one store and one item.
              </p>
              <div className="flex gap-2">
                {stores.length === 0 && (
                  <Link href="/stores">
                    <Button variant="outline" size="sm" data-testid="button-setup-stores">Add stores</Button>
                  </Link>
                )}
                {items.length === 0 && (
                  <Link href="/items">
                    <Button size="sm" data-testid="button-setup-items">Add items</Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-5 pb-5 px-5">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="select-item">Item</Label>
                    <Select value={itemId} onValueChange={setItemId}>
                      <SelectTrigger id="select-item" data-testid="select-item">
                        <SelectValue placeholder="Pick an item" />
                      </SelectTrigger>
                      <SelectContent>
                        {items.map((item) => (
                          <SelectItem key={item.id} value={String(item.id)} data-testid={`option-item-${item.id}`}>
                            {formatItemLabel(item)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="select-store">Store</Label>
                    <Select value={storeId} onValueChange={setStoreId}>
                      <SelectTrigger id="select-store" data-testid="select-store">
                        <SelectValue placeholder="Pick a store" />
                      </SelectTrigger>
                      <SelectContent>
                        {stores.map((store) => (
                          <SelectItem key={store.id} value={String(store.id)} data-testid={`option-store-${store.id}`}>
                            {store.name}{store.location ? ` (${store.location})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="input-price">Price ($)</Label>
                    <Input
                      id="input-price"
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      data-testid="input-price"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="input-date">Date</Label>
                    <Input
                      id="input-date"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      data-testid="input-date"
                    />
                  </div>
                </div>

                {/* Size + Unit row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="input-size">Size / Quantity</Label>
                    <Input
                      id="input-size"
                      type="number"
                      step="0.1"
                      min="0.1"
                      placeholder="e.g. 128, 64, 12"
                      value={size}
                      onChange={(e) => setSize(e.target.value)}
                      data-testid="input-size"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Unit</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {UNITS.map((u) => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => setUnit(u)}
                          className={`text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
                            unit === u
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-card text-foreground border-border hover:bg-muted"
                          }`}
                          data-testid={`button-unit-${u.replace(/\s/g, "-")}`}
                        >
                          {u}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Live unit price preview */}
                {liveUnitPrice !== null && (
                  <div className="bg-primary/5 rounded-lg px-4 py-3 border border-primary/20">
                    <p className="text-xs text-muted-foreground">Unit Price</p>
                    <p className="text-lg font-semibold text-primary" data-testid="text-unit-price-preview">
                      {formatUnitPrice(liveUnitPrice, unit)}
                    </p>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button type="submit" disabled={!canSubmit || createMutation.isPending} data-testid="button-submit-price">
                    <Check className="w-4 h-4 mr-1" />
                    {createMutation.isPending ? "Saving..." : "Log Price"}
                  </Button>
                  <Link href="/">
                    <Button variant="outline" type="button" data-testid="button-cancel">
                      Back to Dashboard
                    </Button>
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
