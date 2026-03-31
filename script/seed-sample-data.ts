/**
 * Seed sample product data for development/testing.
 * Simulates what the nightly collector would produce.
 * 
 * Run: npx tsx script/seed-sample-data.ts
 */

import "dotenv/config";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { products, collectedPrices, stores, collectorRuns } from "../shared/schema.js";

const client = createClient(
  process.env.TURSO_DATABASE_URL
    ? { url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN }
    : { url: "file:./data.db" }
);
const db = drizzle(client);

const today = new Date().toISOString().split("T")[0];

// Get existing stores
const allStores = await db.select().from(stores);
console.log(`Found ${allStores.length} stores: ${allStores.map(s => s.name).join(", ")}`);

if (allStores.length === 0) {
  console.log("No stores found. Please add stores first.");
  process.exit(1);
}

// Sample products — realistic grocery items with prices
const sampleProducts: Array<{
  name: string; brand: string; category: string; subcategory: string;
  size: string; sizeNum: number; sizeUnit: string;
  chain: string; prices: number[]; // one price per store
}> = [
  // Dairy
  { name: "Great Value Whole Milk", brand: "Great Value", category: "Dairy", subcategory: "Milk", size: "1 gal", sizeNum: 128, sizeUnit: "fl oz", chain: "kroger", prices: [3.48, 3.99, 4.29] },
  { name: "Organic Valley 2% Milk", brand: "Organic Valley", category: "Dairy", subcategory: "Milk", size: "half gal", sizeNum: 64, sizeUnit: "fl oz", chain: "kroger", prices: [4.99, 5.49, 5.79] },
  { name: "Oatly Oat Milk Original", brand: "Oatly", category: "Dairy", subcategory: "Milk", size: "64 fl oz", sizeNum: 64, sizeUnit: "fl oz", chain: "kroger", prices: [4.49, 4.99, 4.79] },
  { name: "Kroger Large Eggs", brand: "Kroger", category: "Dairy", subcategory: "Eggs", size: "12 ct", sizeNum: 12, sizeUnit: "ct", chain: "kroger", prices: [3.29, 3.79, 3.99] },
  { name: "Tillamook Medium Cheddar", brand: "Tillamook", category: "Dairy", subcategory: "Cheese", size: "8 oz", sizeNum: 8, sizeUnit: "oz", chain: "kroger", prices: [4.49, 4.99, 5.29] },
  { name: "Chobani Greek Yogurt Vanilla", brand: "Chobani", category: "Dairy", subcategory: "Yogurt", size: "32 oz", sizeNum: 32, sizeUnit: "oz", chain: "kroger", prices: [4.99, 5.49, 5.99] },
  { name: "Kerrygold Irish Butter", brand: "Kerrygold", category: "Dairy", subcategory: "Butter", size: "8 oz", sizeNum: 8, sizeUnit: "oz", chain: "kroger", prices: [4.29, 4.99, 5.49] },
  // Produce
  { name: "Bananas", brand: "", category: "Produce", subcategory: "Fresh Fruit", size: "per lb", sizeNum: 1, sizeUnit: "lb", chain: "kroger", prices: [0.59, 0.69, 0.79] },
  { name: "Organic Strawberries", brand: "", category: "Produce", subcategory: "Fresh Fruit", size: "1 lb", sizeNum: 1, sizeUnit: "lb", chain: "kroger", prices: [4.99, 5.49, 5.99] },
  { name: "Hass Avocados", brand: "", category: "Produce", subcategory: "Fresh Fruit", size: "each", sizeNum: 1, sizeUnit: "ct", chain: "kroger", prices: [1.25, 0.99, 1.49] },
  { name: "Roma Tomatoes", brand: "", category: "Produce", subcategory: "Fresh Vegetables", size: "per lb", sizeNum: 1, sizeUnit: "lb", chain: "kroger", prices: [1.49, 1.79, 1.99] },
  { name: "Russet Potatoes", brand: "", category: "Produce", subcategory: "Fresh Vegetables", size: "5 lb bag", sizeNum: 5, sizeUnit: "lb", chain: "kroger", prices: [3.99, 4.49, 4.99] },
  { name: "Baby Spinach", brand: "", category: "Produce", subcategory: "Fresh Vegetables", size: "5 oz", sizeNum: 5, sizeUnit: "oz", chain: "kroger", prices: [3.49, 3.99, 4.29] },
  // Meat
  { name: "Boneless Skinless Chicken Breast", brand: "", category: "Meat", subcategory: "Chicken", size: "per lb", sizeNum: 1, sizeUnit: "lb", chain: "kroger", prices: [3.99, 4.49, 4.99] },
  { name: "80/20 Ground Beef", brand: "", category: "Meat", subcategory: "Beef", size: "1 lb", sizeNum: 1, sizeUnit: "lb", chain: "kroger", prices: [5.49, 5.99, 6.49] },
  { name: "Oscar Mayer Bacon", brand: "Oscar Mayer", category: "Meat", subcategory: "Bacon & Sausage", size: "16 oz", sizeNum: 16, sizeUnit: "oz", chain: "kroger", prices: [6.99, 7.49, 7.99] },
  { name: "Atlantic Salmon Fillet", brand: "", category: "Meat", subcategory: "Seafood", size: "per lb", sizeNum: 1, sizeUnit: "lb", chain: "kroger", prices: [9.99, 10.99, 11.49] },
  // Bakery
  { name: "Dave's Killer Bread 21 Whole Grains", brand: "Dave's Killer Bread", category: "Bakery", subcategory: "Bread", size: "27 oz", sizeNum: 27, sizeUnit: "oz", chain: "kroger", prices: [5.49, 5.99, 6.29] },
  { name: "Mission Flour Tortillas", brand: "Mission", category: "Bakery", subcategory: "Tortillas", size: "10 ct", sizeNum: 10, sizeUnit: "ct", chain: "kroger", prices: [3.29, 3.49, 3.99] },
  // Frozen
  { name: "DiGiorno Rising Crust Pepperoni Pizza", brand: "DiGiorno", category: "Frozen", subcategory: "Frozen Pizza", size: "27.5 oz", sizeNum: 27.5, sizeUnit: "oz", chain: "kroger", prices: [6.99, 7.99, 8.49] },
  { name: "Ben & Jerry's Half Baked", brand: "Ben & Jerry's", category: "Frozen", subcategory: "Ice Cream", size: "1 pt", sizeNum: 16, sizeUnit: "fl oz", chain: "kroger", prices: [5.49, 5.99, 6.49] },
  // Beverages
  { name: "Dasani Purified Water", brand: "Dasani", category: "Beverages", subcategory: "Water", size: "24 pk", sizeNum: 24, sizeUnit: "ct", chain: "kroger", prices: [4.99, 5.49, 5.99] },
  { name: "Simply Orange Juice", brand: "Simply", category: "Beverages", subcategory: "Juice", size: "52 fl oz", sizeNum: 52, sizeUnit: "fl oz", chain: "kroger", prices: [4.29, 4.49, 4.99] },
  { name: "Coca-Cola 12 Pack", brand: "Coca-Cola", category: "Beverages", subcategory: "Soda", size: "12 pk", sizeNum: 12, sizeUnit: "ct", chain: "kroger", prices: [6.99, 7.49, 7.99] },
  { name: "Folgers Classic Roast Coffee", brand: "Folgers", category: "Beverages", subcategory: "Coffee", size: "30.5 oz", sizeNum: 30.5, sizeUnit: "oz", chain: "kroger", prices: [9.99, 10.49, 11.99] },
  // Pantry
  { name: "Cheerios", brand: "General Mills", category: "Pantry", subcategory: "Cereal", size: "18 oz", sizeNum: 18, sizeUnit: "oz", chain: "kroger", prices: [4.79, 4.99, 5.49] },
  { name: "Barilla Spaghetti", brand: "Barilla", category: "Pantry", subcategory: "Pasta & Grains", size: "16 oz", sizeNum: 16, sizeUnit: "oz", chain: "kroger", prices: [1.49, 1.79, 1.99] },
  { name: "Skippy Creamy Peanut Butter", brand: "Skippy", category: "Pantry", subcategory: "Pantry", size: "16.3 oz", sizeNum: 16.3, sizeUnit: "oz", chain: "kroger", prices: [3.49, 3.79, 3.99] },
  { name: "Extra Virgin Olive Oil", brand: "Bertolli", category: "Pantry", subcategory: "Cooking Oil", size: "17 fl oz", sizeNum: 17, sizeUnit: "fl oz", chain: "kroger", prices: [6.49, 6.99, 7.49] },
  // Snacks
  { name: "Lay's Classic Potato Chips", brand: "Lay's", category: "Snacks", subcategory: "Chips", size: "10 oz", sizeNum: 10, sizeUnit: "oz", chain: "kroger", prices: [4.49, 4.79, 4.99] },
  { name: "Oreo Cookies", brand: "Nabisco", category: "Snacks", subcategory: "Cookies", size: "14.3 oz", sizeNum: 14.3, sizeUnit: "oz", chain: "kroger", prices: [4.99, 5.29, 5.49] },
  { name: "Blue Diamond Almonds", brand: "Blue Diamond", category: "Snacks", subcategory: "Nuts", size: "6 oz", sizeNum: 6, sizeUnit: "oz", chain: "kroger", prices: [4.99, 5.49, 5.99] },
  // Household
  { name: "Bounty Select-A-Size Paper Towels", brand: "Bounty", category: "Household", subcategory: "Paper Products", size: "6 rolls", sizeNum: 6, sizeUnit: "ct", chain: "kroger", prices: [12.99, 14.49, 15.99] },
  { name: "Tide Original Laundry Detergent", brand: "Tide", category: "Household", subcategory: "Laundry", size: "92 fl oz", sizeNum: 92, sizeUnit: "fl oz", chain: "kroger", prices: [11.99, 12.49, 13.99] },
  { name: "Dawn Ultra Dish Soap", brand: "Dawn", category: "Household", subcategory: "Cleaning", size: "19.4 fl oz", sizeNum: 19.4, sizeUnit: "fl oz", chain: "kroger", prices: [3.49, 3.79, 3.99] },
];

console.log(`\nSeeding ${sampleProducts.length} products with prices at ${allStores.length} stores...`);

let productCount = 0;
let priceCount = 0;

for (const sp of sampleProducts) {
  // Insert product
  const rows = await db.insert(products).values({
    name: sp.name,
    brand: sp.brand || null,
    category: sp.category,
    subcategory: sp.subcategory,
    size: sp.size,
    sizeNum: sp.sizeNum,
    sizeUnit: sp.sizeUnit,
    imageUrl: null,
    chain: sp.chain,
    storeProductUrl: null,
    lastSeen: today,
  }).returning();
  const productId = rows[0].id;
  productCount++;

  // Insert prices for each store
  for (let i = 0; i < allStores.length && i < sp.prices.length; i++) {
    await db.insert(collectedPrices).values({
      productId,
      storeId: allStores[i].id,
      price: sp.prices[i],
      promoPrice: null,
      date: today,
    });
    priceCount++;
  }
}

// Create a collector run log entry
await db.insert(collectorRuns).values({
  chain: "kroger",
  startedAt: new Date().toISOString(),
  finishedAt: new Date().toISOString(),
  productsFound: productCount,
  pricesCollected: priceCount,
  errors: 0,
  status: "completed",
});

console.log(`✅ Seeded ${productCount} products and ${priceCount} prices`);
process.exit(0);
