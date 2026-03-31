import type { Item, PriceEntry } from "@shared/schema";

// A product group is items that share the same name (e.g. all "Milk" entries)
export interface ProductGroup {
  productName: string;
  category: string;
  allTags: string[];
  items: Array<{ item: Item; tags: string[] }>;
}

// A size key is "size|unit" e.g. "128|fl oz" for dedup/filtering
export function sizeKey(size: number | null, unit: string | null): string {
  if (!size || !unit) return "";
  return `${size}|${unit}`;
}

export function parseSizeKey(key: string): { size: number; unit: string } | null {
  const [s, u] = key.split("|");
  if (!s || !u) return null;
  return { size: parseFloat(s), unit: u };
}
