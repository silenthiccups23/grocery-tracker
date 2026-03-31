import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

// Stores the user wants to track (selected via zip code search)
export const stores = sqliteTable("stores", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  location: text("location"),
  address: text("address"),
  chain: text("chain"), // normalized chain key: "kroger", "walmart", "albertsons", etc.
});

// Products discovered by the nightly collector.
// One row per unique product (identified by name + store chain + size).
// The collector upserts these — existing products get updated, new ones get inserted.
export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),                    // "Great Value Whole Milk"
  brand: text("brand"),                             // "Great Value"
  category: text("category"),                       // "Dairy"
  subcategory: text("subcategory"),                 // "Milk"
  size: text("size"),                               // "1 gal" (raw text from store)
  sizeNum: real("size_num"),                        // 128 (parsed numeric)
  sizeUnit: text("size_unit"),                      // "fl oz" (parsed unit)
  imageUrl: text("image_url"),                      // product thumbnail
  chain: text("chain").notNull(),                   // "walmart", "kroger", "albertsons"
  storeProductUrl: text("store_product_url"),        // direct link to product on store's site
  lastSeen: text("last_seen").notNull(),            // ISO date of last collection
});

// Price snapshots — one row per product per store per day.
// The collector writes these daily. Old prices are kept for history.
export const collectedPrices = sqliteTable("collected_prices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id").notNull(),
  storeId: integer("store_id").notNull(),
  price: real("price").notNull(),
  promoPrice: real("promo_price"),                  // sale price if available
  date: text("date").notNull(),                     // ISO date
});

// User's watchlist — products they care about and want to compare.
// This replaces the old "items" table. Users pick from pre-collected products.
export const watchlist = sqliteTable("watchlist", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productName: text("product_name").notNull(),       // generic name: "Milk", "Eggs", "Chicken Breast"
  category: text("category"),
  tags: text("tags"),                                // JSON array: '["2%","Organic"]'
  defaultUnit: text("default_unit"),
});

// Price alerts — notify when a watched product drops below target
export const priceAlerts = sqliteTable("price_alerts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  watchlistId: integer("watchlist_id").notNull(),
  targetPrice: real("target_price").notNull(),
  active: integer("active").notNull().default(1),
  lastTriggered: text("last_triggered"),
});

// Collector run log — tracks when each store was last collected
export const collectorRuns = sqliteTable("collector_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  chain: text("chain").notNull(),                    // "walmart", "kroger", "albertsons"
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  productsFound: integer("products_found").default(0),
  pricesCollected: integer("prices_collected").default(0),
  errors: integer("errors").default(0),
  status: text("status").notNull().default("running"), // "running", "completed", "failed"
});

// ---- Legacy tables kept for backwards compatibility during migration ----
// These can be dropped once the new system is fully running.
export const items = sqliteTable("items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  category: text("category"),
  tags: text("tags"),
  defaultUnit: text("default_unit"),
});

export const priceEntries = sqliteTable("price_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  itemId: integer("item_id").notNull(),
  storeId: integer("store_id").notNull(),
  price: real("price").notNull(),
  date: text("date").notNull(),
  size: real("size"),
  unit: text("unit"),
});

// ---- Insert schemas ----
export const insertStoreSchema = createInsertSchema(stores).omit({ id: true });
export const insertProductSchema = createInsertSchema(products).omit({ id: true });
export const insertCollectedPriceSchema = createInsertSchema(collectedPrices).omit({ id: true });
export const insertWatchlistSchema = createInsertSchema(watchlist).omit({ id: true });
export const insertPriceAlertSchema = createInsertSchema(priceAlerts).omit({ id: true });
export const insertCollectorRunSchema = createInsertSchema(collectorRuns).omit({ id: true });
// Legacy
export const insertItemSchema = createInsertSchema(items).omit({ id: true });
export const insertPriceEntrySchema = createInsertSchema(priceEntries).omit({ id: true });

// ---- Types ----
export type Store = typeof stores.$inferSelect;
export type InsertStore = z.infer<typeof insertStoreSchema>;
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type CollectedPrice = typeof collectedPrices.$inferSelect;
export type InsertCollectedPrice = z.infer<typeof insertCollectedPriceSchema>;
export type WatchlistItem = typeof watchlist.$inferSelect;
export type InsertWatchlistItem = z.infer<typeof insertWatchlistSchema>;
export type PriceAlert = typeof priceAlerts.$inferSelect;
export type InsertPriceAlert = z.infer<typeof insertPriceAlertSchema>;
export type CollectorRun = typeof collectorRuns.$inferSelect;
export type InsertCollectorRun = z.infer<typeof insertCollectorRunSchema>;
// Legacy
export type Item = typeof items.$inferSelect;
export type InsertItem = z.infer<typeof insertItemSchema>;
export type PriceEntry = typeof priceEntries.$inferSelect;
export type InsertPriceEntry = z.infer<typeof insertPriceEntrySchema>;

// ---- Helper functions ----

export function parseTags(item: { tags: string | null }): string[] {
  if (!item.tags) return [];
  try {
    const parsed = JSON.parse(item.tags);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// All supported units
export const UNITS = ["fl oz", "oz", "lb", "ct", "gal", "L"] as const;
export type Unit = typeof UNITS[number];

// Which unit to use by default for each product category
export const DEFAULT_UNITS: Record<string, Unit> = {
  Dairy: "fl oz",
  Produce: "lb",
  Meat: "lb",
  Bakery: "oz",
  Frozen: "oz",
  Beverages: "fl oz",
  Snacks: "oz",
  Pantry: "oz",
  Household: "ct",
  Other: "oz",
};

// Which units make sense for each category (shown to the user)
export const CATEGORY_UNITS: Record<string, Unit[]> = {
  Dairy: ["fl oz", "oz", "lb", "gal", "ct", "L"],
  Produce: ["lb", "oz", "ct"],
  Meat: ["lb", "oz", "ct"],
  Bakery: ["oz", "ct", "lb"],
  Frozen: ["oz", "lb", "ct"],
  Beverages: ["fl oz", "gal", "L", "ct"],
  Snacks: ["oz", "ct", "lb"],
  Pantry: ["oz", "lb", "ct", "fl oz"],
  Household: ["ct", "fl oz", "oz"],
  Other: ["oz", "lb", "ct", "fl oz", "gal", "L"],
};

// Compute unit price (price per single unit). Returns null if size info is missing.
export function computeUnitPrice(price: number, size: number | null, unit: string | null): number | null {
  if (!size || size <= 0 || !unit) return null;
  return price / size;
}

// Format unit price for display (e.g. "31.6¢/oz" or "$1.20/lb")
export function formatUnitPrice(unitPrice: number, unit: string): string {
  if (unitPrice < 1) {
    return `${(unitPrice * 100).toFixed(1)}¢/${unit}`;
  }
  return `$${unitPrice.toFixed(2)}/${unit}`;
}

// Human-friendly size labels for common measurements
const FRIENDLY_SIZES: Array<{ size: number; unit: string; label: string }> = [
  { size: 128, unit: "fl oz", label: "1 gal" },
  { size: 64, unit: "fl oz", label: "half gal" },
  { size: 32, unit: "fl oz", label: "1 qt" },
  { size: 16, unit: "fl oz", label: "1 pt" },
  { size: 16, unit: "oz", label: "1 lb" },
  { size: 32, unit: "oz", label: "2 lb" },
  { size: 48, unit: "oz", label: "3 lb" },
  { size: 8, unit: "oz", label: "half lb" },
  { size: 1, unit: "gal", label: "1 gal" },
  { size: 0.5, unit: "gal", label: "half gal" },
];

export function formatSize(size: number | null, unit: string | null): string {
  if (!size || !unit) return "";
  const friendly = FRIENDLY_SIZES.find(f => f.size === size && f.unit === unit);
  if (friendly) return friendly.label;
  const sizeStr = size % 1 === 0 ? String(size) : size.toFixed(1);
  return `${sizeStr} ${unit}`;
}

// Supported store chains — the collector has a module for each
export const SUPPORTED_CHAINS: Array<{ key: string; name: string; color: string }> = [
  { key: "kroger", name: "Kroger", color: "#0056A4" },
  { key: "walmart", name: "Walmart", color: "#0071CE" },
  { key: "albertsons", name: "Albertsons", color: "#EF3E42" },
];

// Map store names to chain keys (for auto-detection)
export const CHAIN_MATCHERS: Array<{ keywords: string[]; chain: string }> = [
  { keywords: ["kroger", "ralphs", "fry's", "fred meyer", "king soopers", "smith's", "food 4 less"], chain: "kroger" },
  { keywords: ["walmart", "wal-mart"], chain: "walmart" },
  { keywords: ["albertsons", "vons", "safeway", "pavilions", "jewel", "shaw's", "acme"], chain: "albertsons" },
  { keywords: ["target"], chain: "target" },
  { keywords: ["costco"], chain: "costco" },
  { keywords: ["sprouts"], chain: "sprouts" },
  { keywords: ["whole foods"], chain: "wholefoods" },
  { keywords: ["h-e-b", "heb"], chain: "heb" },
  { keywords: ["aldi"], chain: "aldi" },
  { keywords: ["publix"], chain: "publix" },
];

export function detectChain(storeName: string): string | null {
  const lower = storeName.toLowerCase();
  for (const matcher of CHAIN_MATCHERS) {
    if (matcher.keywords.some(kw => lower.includes(kw))) {
      return matcher.chain;
    }
  }
  return null;
}

// Tag options by category
export const TAG_OPTIONS: Record<string, string[]> = {
  Dairy: [
    "Whole", "2%", "1%", "Skim", "Fat-Free", "Lactose-Free", "Non-Dairy", "Oat", "Almond", "Soy",
    "Greek", "Low-Fat", "Non-Fat", "Plant-Based",
    "Shredded", "Sliced", "Block", "Cream Cheese", "String Cheese",
    "Cage-Free", "Free-Range", "Pasture-Raised", "Brown", "Large", "Extra Large",
    "Salted", "Unsalted", "Whipped",
    "Organic", "Grass-Fed", "A2", "Raw", "Ultra-Pasteurized", "Flavored", "Vanilla", "Plain", "Strawberry",
  ],
  Produce: [
    "Fresh", "Pre-Cut", "Bagged", "Bunch",
    "Conventional", "Organic", "Local", "In-Season", "Hydroponic", "Non-GMO", "Baby/Mini",
    "Frozen", "Canned",
  ],
  Meat: [
    "Boneless", "Bone-In", "Lean", "Ground", "Whole", "Thigh", "Breast", "Wing", "Drumstick",
    "Steak", "Roast", "Ribs", "Tenderloin", "Fillet", "Patty",
    "Deli-Sliced", "Smoked", "Cured", "Uncured",
    "Wild-Caught", "Farm-Raised", "Shell-On", "Peeled", "Fresh", "Frozen",
    "Conventional", "Organic", "Grass-Fed", "Free-Range", "Pasture-Raised", "No Antibiotics", "Kosher", "Halal",
  ],
  Bakery: [
    "White", "Whole Wheat", "Multigrain", "Sourdough", "Rye", "Brioche", "Sprouted",
    "Tortilla", "Bun", "Roll", "Bagel", "English Muffin", "Pita", "Naan", "Croissant",
    "Gluten-Free", "Organic", "Keto", "Thin-Sliced", "Unsliced", "Sliced",
  ],
  Frozen: [
    "Pizza", "Burrito", "Dinner", "Breakfast",
    "Vegetables", "Fruit", "Chicken", "Fish", "Shrimp",
    "Ice Cream", "Popsicle", "Dessert", "Waffles", "Pancakes",
    "Conventional", "Organic", "Family Size", "Single Serve", "Gluten-Free", "Low-Calorie", "Plant-Based", "Microwaveable", "Steam-in-Bag",
  ],
  Beverages: [
    "Water", "Sparkling Water", "Juice", "Soda", "Coffee", "Tea", "Sports Drink", "Energy Drink", "Kombucha", "Lemonade",
    "Regular", "Diet", "Zero Sugar", "Organic", "Cold-Pressed", "Sparkling", "Decaf", "Unsweetened", "Flavored", "Concentrate", "Single Serve", "Plant-Based", "Electrolyte",
  ],
  Snacks: [
    "Chips", "Crackers", "Cookies", "Nuts", "Trail Mix", "Popcorn", "Pretzels", "Granola Bar", "Protein Bar", "Dried Fruit", "Jerky", "Rice Cake",
    "Regular", "Organic", "Family Size", "Reduced Fat", "Gluten-Free", "Baked", "Kettle-Cooked", "Low-Sodium", "Protein", "Keto", "Multi-Pack", "Single Serve", "Spicy", "BBQ", "Salt & Vinegar",
  ],
  Pantry: [
    "Cereal", "Oatmeal", "Pasta", "Rice", "Beans", "Canned Tomato", "Soup", "Broth", "Sauce", "Cooking Oil", "Olive Oil", "Vinegar", "Spice", "Flour", "Sugar", "Honey", "Peanut Butter", "Jelly",
    "Regular", "Organic", "Low-Sodium", "Gluten-Free", "Family Size", "No Sugar Added", "Whole Grain", "Non-GMO", "Canned", "Dried", "Instant", "Extra Virgin",
  ],
  Household: [
    "Paper Towels", "Toilet Paper", "Trash Bags", "Dish Soap", "Laundry Detergent", "All-Purpose Cleaner", "Disinfectant", "Sponge", "Aluminum Foil", "Plastic Wrap", "Zip Bags",
    "Regular", "Eco-Friendly", "Concentrated", "Fragrance-Free", "Biodegradable", "Sensitive", "Heavy-Duty", "Refill", "Bulk", "Unscented",
  ],
  Other: ["Regular", "Organic", "Premium", "Value Pack", "Trial Size", "Import", "Specialty"],
};

// Category emoji icons for display
export const CATEGORY_ICONS: Record<string, string> = {
  Produce: "\ud83e\udd66",
  Dairy: "\ud83e\uddc0",
  Meat: "\ud83e\udd69",
  Bakery: "\ud83c\udf5e",
  Frozen: "\u2744\ufe0f",
  Beverages: "\ud83e\uddc3",
  Snacks: "\ud83c\udf7f",
  Pantry: "\ud83e\uded8",
  Household: "\ud83e\uddf9",
  Other: "\ud83d\udce6",
};

// Grocery categories used for collecting
export const GROCERY_CATEGORIES = [
  "Produce", "Dairy", "Meat", "Bakery", "Frozen",
  "Beverages", "Snacks", "Pantry", "Household",
] as const;
