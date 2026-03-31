import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const stores = sqliteTable("stores", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  location: text("location"),
  address: text("address"),
});

export const items = sqliteTable("items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  category: text("category"),
  tags: text("tags"), // JSON array of strings, e.g. '["2%","Organic"]'
  defaultUnit: text("default_unit"), // Default unit for this item (fl oz, oz, lb, ct, gal, L)
});

export const priceAlerts = sqliteTable("price_alerts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  itemId: integer("item_id").notNull(),
  targetPrice: real("target_price").notNull(), // Alert when price drops to or below this
  active: integer("active").notNull().default(1), // 1 = active, 0 = paused
  lastTriggered: text("last_triggered"), // ISO date when alert last fired, null if never
});

export const priceEntries = sqliteTable("price_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  itemId: integer("item_id").notNull(),
  storeId: integer("store_id").notNull(),
  price: real("price").notNull(),
  date: text("date").notNull(),
  size: real("size"), // The size/quantity of this product (e.g. 128 for 128 fl oz)
  unit: text("unit"), // The unit (fl oz, oz, lb, ct, gal, L)
});

// Insert schemas
export const insertStoreSchema = createInsertSchema(stores).omit({ id: true });
export const insertItemSchema = createInsertSchema(items).omit({ id: true });
export const insertPriceEntrySchema = createInsertSchema(priceEntries).omit({ id: true });
export const insertPriceAlertSchema = createInsertSchema(priceAlerts).omit({ id: true });

// Types
export type Store = typeof stores.$inferSelect;
export type InsertStore = z.infer<typeof insertStoreSchema>;
export type Item = typeof items.$inferSelect;
export type InsertItem = z.infer<typeof insertItemSchema>;
export type PriceEntry = typeof priceEntries.$inferSelect;
export type InsertPriceEntry = z.infer<typeof insertPriceEntrySchema>;
export type PriceAlert = typeof priceAlerts.$inferSelect;
export type InsertPriceAlert = z.infer<typeof insertPriceAlertSchema>;

// Helper to parse tags from JSON string
export function parseTags(item: Item): string[] {
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
  // Fluid ounce conversions
  { size: 128, unit: "fl oz", label: "1 gal" },
  { size: 64, unit: "fl oz", label: "half gal" },
  { size: 32, unit: "fl oz", label: "1 qt" },
  { size: 16, unit: "fl oz", label: "1 pt" },
  // Ounce/pound conversions
  { size: 16, unit: "oz", label: "1 lb" },
  { size: 32, unit: "oz", label: "2 lb" },
  { size: 48, unit: "oz", label: "3 lb" },
  { size: 8, unit: "oz", label: "half lb" },
  // Gallon labels
  { size: 1, unit: "gal", label: "1 gal" },
  { size: 0.5, unit: "gal", label: "half gal" },
];

// Format size + unit for display using friendly labels when possible
export function formatSize(size: number | null, unit: string | null): string {
  if (!size || !unit) return "";
  // Check for a friendly label first
  const friendly = FRIENDLY_SIZES.find(f => f.size === size && f.unit === unit);
  if (friendly) return friendly.label;
  // Fallback: show the raw number + unit
  const sizeStr = size % 1 === 0 ? String(size) : size.toFixed(1);
  return `${sizeStr} ${unit}`;
}

// Tag options by category — modeled after how real grocery stores organize their aisles.
// Includes both product types and attributes so users can filter precisely.
export const TAG_OPTIONS: Record<string, string[]> = {
  Dairy: [
    // Milk types
    "Whole", "2%", "1%", "Skim", "Fat-Free", "Lactose-Free", "Non-Dairy", "Oat", "Almond", "Soy",
    // Yogurt types
    "Greek", "Low-Fat", "Non-Fat", "Plant-Based",
    // Cheese types
    "Shredded", "Sliced", "Block", "Cream Cheese", "String Cheese",
    // Egg types
    "Cage-Free", "Free-Range", "Pasture-Raised", "Brown", "Large", "Extra Large",
    // Butter types
    "Salted", "Unsalted", "Whipped",
    // Attributes (milk/butter only: Grass-Fed; general: Organic)
    "Organic", "Grass-Fed", "A2", "Raw", "Ultra-Pasteurized", "Flavored", "Vanilla", "Plain", "Strawberry",
  ],
  Produce: [
    // Fruits
    "Fresh", "Pre-Cut", "Bagged", "Bunch",
    // Attributes
    "Conventional", "Organic", "Local", "In-Season", "Hydroponic", "Non-GMO", "Baby/Mini",
    // Frozen produce
    "Frozen", "Canned",
  ],
  Meat: [
    // Cuts & types
    "Boneless", "Bone-In", "Lean", "Ground", "Whole", "Thigh", "Breast", "Wing", "Drumstick",
    "Steak", "Roast", "Ribs", "Tenderloin", "Fillet", "Patty",
    // Deli
    "Deli-Sliced", "Smoked", "Cured", "Uncured",
    // Seafood
    "Wild-Caught", "Farm-Raised", "Shell-On", "Peeled", "Fresh", "Frozen",
    // Attributes
    "Conventional", "Organic", "Grass-Fed", "Free-Range", "Pasture-Raised", "No Antibiotics", "Kosher", "Halal",
  ],
  Bakery: [
    // Bread types
    "White", "Whole Wheat", "Multigrain", "Sourdough", "Rye", "Brioche", "Sprouted",
    // Other baked goods
    "Tortilla", "Bun", "Roll", "Bagel", "English Muffin", "Pita", "Naan", "Croissant",
    // Attributes
    "Gluten-Free", "Organic", "Keto", "Thin-Sliced", "Unsliced", "Sliced",
  ],
  Frozen: [
    // Frozen meals
    "Pizza", "Burrito", "Dinner", "Breakfast",
    // Frozen produce/protein
    "Vegetables", "Fruit", "Chicken", "Fish", "Shrimp",
    // Ice cream & desserts
    "Ice Cream", "Popsicle", "Dessert", "Waffles", "Pancakes",
    // Attributes
    "Conventional", "Organic", "Family Size", "Single Serve", "Gluten-Free", "Low-Calorie", "Plant-Based", "Microwaveable", "Steam-in-Bag",
  ],
  Beverages: [
    // Types
    "Water", "Sparkling Water", "Juice", "Soda", "Coffee", "Tea", "Sports Drink", "Energy Drink", "Kombucha", "Lemonade",
    // Attributes
    "Regular", "Diet", "Zero Sugar", "Organic", "Cold-Pressed", "Sparkling", "Decaf", "Unsweetened", "Flavored", "Concentrate", "Single Serve", "Plant-Based", "Electrolyte",
  ],
  Snacks: [
    // Types
    "Chips", "Crackers", "Cookies", "Nuts", "Trail Mix", "Popcorn", "Pretzels", "Granola Bar", "Protein Bar", "Dried Fruit", "Jerky", "Rice Cake",
    // Attributes
    "Regular", "Organic", "Family Size", "Reduced Fat", "Gluten-Free", "Baked", "Kettle-Cooked", "Low-Sodium", "Protein", "Keto", "Multi-Pack", "Single Serve", "Spicy", "BBQ", "Salt & Vinegar",
  ],
  Pantry: [
    // Types
    "Cereal", "Oatmeal", "Pasta", "Rice", "Beans", "Canned Tomato", "Soup", "Broth", "Sauce", "Cooking Oil", "Olive Oil", "Vinegar", "Spice", "Flour", "Sugar", "Honey", "Peanut Butter", "Jelly",
    // Attributes
    "Regular", "Organic", "Low-Sodium", "Gluten-Free", "Family Size", "No Sugar Added", "Whole Grain", "Non-GMO", "Canned", "Dried", "Instant", "Extra Virgin",
  ],
  Household: [
    // Types
    "Paper Towels", "Toilet Paper", "Trash Bags", "Dish Soap", "Laundry Detergent", "All-Purpose Cleaner", "Disinfectant", "Sponge", "Aluminum Foil", "Plastic Wrap", "Zip Bags",
    // Attributes
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
