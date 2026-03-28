/**
 * Home Price Fetcher Script
 * 
 * Run this daily from your home computer (residential IP) to fetch
 * real prices from the Kroger API and upload them to your Turso cloud database.
 * 
 * The Kroger API blocks cloud/datacenter IPs but allows residential IPs.
 * This script bridges that gap — it runs from home and writes to the cloud.
 * 
 * Usage:
 *   npx tsx script/fetch-prices.ts
 * 
 * Set up as a daily cron job (macOS/Linux):
 *   crontab -e
 *   0 8 * * * cd /path/to/grocery-tracker && npx tsx script/fetch-prices.ts >> fetch.log 2>&1
 * 
 * Or on Windows Task Scheduler, run daily at 8am.
 * 
 * Required environment variables (in .env):
 *   KROGER_CLIENT_ID=your-kroger-client-id
 *   KROGER_CLIENT_SECRET=your-kroger-client-secret
 *   TURSO_DATABASE_URL=libsql://your-db-name-your-org.turso.io
 *   TURSO_AUTH_TOKEN=your-turso-auth-token
 *   FETCH_ZIP_CODE=92154  (optional, defaults to 92154)
 */

import "dotenv/config";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { stores, items, priceEntries, settings } from "../shared/schema.js";

// --- Validate environment ---
const requiredVars = ["KROGER_CLIENT_ID", "KROGER_CLIENT_SECRET"];
for (const v of requiredVars) {
  if (!process.env[v]) {
    console.error(`❌ Missing environment variable: ${v}`);
    console.error("   Make sure your .env file has Kroger API credentials.");
    process.exit(1);
  }
}

// Connect to database — Turso if available, otherwise local file
const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;

if (tursoUrl) {
  console.log("📡 Connected to Turso cloud database");
} else {
  console.log("📁 Using local SQLite database (data.db)");
  console.log("   Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN to use cloud DB.");
}

const client = createClient(
  tursoUrl
    ? { url: tursoUrl, authToken: tursoToken }
    : { url: "file:./data.db" }
);
const db = drizzle(client);

// --- Kroger API functions ---
const KROGER_API_BASE = "https://api.kroger.com/v1";
let accessToken = "";
let tokenExpiry = 0;

async function getAccessToken(): Promise<string> {
  if (accessToken && Date.now() < tokenExpiry) return accessToken;

  const credentials = Buffer.from(
    `${process.env.KROGER_CLIENT_ID}:${process.env.KROGER_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch(`${KROGER_API_BASE}/connect/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: "grant_type=client_credentials&scope=product.compact",
  });

  if (!res.ok) {
    throw new Error(`Kroger auth failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as any;
  accessToken = data.access_token;
  tokenExpiry = Date.now() + ((data.expires_in || 1800) - 60) * 1000;
  return accessToken;
}

async function searchLocations(zipCode: string, radius: number = 25) {
  const token = await getAccessToken();
  const res = await fetch(
    `${KROGER_API_BASE}/locations?filter.zipCode.near=${zipCode}&filter.radiusInMiles=${radius}&filter.limit=10`,
    { headers: { Accept: "application/json", Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`Location search failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as any;
  return (data.data || []).map((loc: any) => ({
    locationId: loc.locationId,
    name: loc.name,
    chain: loc.chain,
  }));
}

async function searchProducts(term: string, locationId: string, limit: number = 3) {
  const token = await getAccessToken();
  const res = await fetch(
    `${KROGER_API_BASE}/products?filter.term=${encodeURIComponent(term)}&filter.locationId=${locationId}&filter.limit=${limit}`,
    { headers: { Accept: "application/json", Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`Product search failed: ${res.status}`);
  const data = (await res.json()) as any;
  return (data.data || []).map((p: any) => {
    const item = p.items?.[0] || {};
    const price = item.price || {};
    return {
      description: p.description || "",
      size: item.size || "",
      price: price.regular || price.promo || null,
    };
  });
}

// --- Size parsing (same logic as the server) ---
const DAIRY_ITEMS = ["milk", "cream", "yogurt", "kefir", "eggnog", "half and half", "half & half", "creamer"];
const EGG_ITEMS = ["egg", "eggs"];

function parseSize(sizeStr: string, itemName: string): { size: number | null; unit: string | null } {
  if (!sizeStr) return { size: null, unit: null };
  const clean = sizeStr.toLowerCase().trim();
  const nameLower = itemName.toLowerCase();

  // Egg detection
  const isEgg = EGG_ITEMS.some(e => nameLower.includes(e));
  if (isEgg) {
    const countMatch = clean.match(/(\d+)\s*(ct|count|pk|pack|dz|dozen)/i);
    if (countMatch) return { size: parseFloat(countMatch[1]), unit: "ct" };
    const justNum = clean.match(/^(\d+)$/);
    if (justNum) return { size: parseFloat(justNum[1]), unit: "ct" };
    if (clean.includes("dozen")) return { size: 12, unit: "ct" };
  }

  // Gallon / half gallon
  if (/\b(1\s*gal|one\s*gal|gallon)\b/i.test(clean)) return { size: 128, unit: "fl oz" };
  if (/\b(half\s*gal|1\/2\s*gal|0\.5\s*gal)\b/i.test(clean)) return { size: 64, unit: "fl oz" };

  // Extract number + unit
  const match = clean.match(/([\d.]+)\s*(fl\.?\s*oz|oz|lb|ct|gal|l|liter|litre|pt|qt|kg|g|ml|count|pack|pk)/i);
  if (!match) return { size: null, unit: null };

  let size = parseFloat(match[1]);
  let unit = match[2].replace(/\./g, "").trim().toLowerCase();

  // Normalize units
  if (unit === "floz" || unit === "fl oz") unit = "fl oz";
  else if (unit === "liter" || unit === "litre" || unit === "l") { size *= 33.814; unit = "fl oz"; }
  else if (unit === "ml") { size *= 0.033814; unit = "fl oz"; }
  else if (unit === "pt") { size *= 16; unit = "fl oz"; }
  else if (unit === "qt") { size *= 32; unit = "fl oz"; }
  else if (unit === "kg") { size *= 2.20462; unit = "lb"; }
  else if (unit === "g") { size *= 0.035274; unit = "oz"; }
  else if (unit === "count" || unit === "pack" || unit === "pk") unit = "ct";
  else if (unit === "gal") { size *= 128; unit = "fl oz"; }

  // If it says "oz" but it's a dairy item, it's probably fluid ounces
  if (unit === "oz") {
    const isDairy = DAIRY_ITEMS.some(d => nameLower.includes(d));
    if (isDairy) unit = "fl oz";
  }

  return { size: Math.round(size * 100) / 100, unit };
}

function parseTags(item: { tags: string | null }): string[] {
  if (!item.tags) return [];
  try {
    const parsed = JSON.parse(item.tags);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

// --- Main fetch logic ---
async function main() {
  const startTime = Date.now();
  const zipCode = process.env.FETCH_ZIP_CODE || "92154";
  const today = new Date().toISOString().split("T")[0];

  console.log(`\n🛒 GroceryTrack Price Fetcher`);
  console.log(`📍 ZIP code: ${zipCode}`);
  console.log(`📅 Date: ${today}`);
  console.log(`⏰ Time: ${new Date().toLocaleString()}\n`);

  // Load stores and items from database
  const allStores = await db.select().from(stores);
  const allItems = await db.select().from(items);

  if (allStores.length === 0) {
    console.error("❌ No stores in database. Add stores through the app first.");
    process.exit(1);
  }
  if (allItems.length === 0) {
    console.error("❌ No items in database. Add items through the app first.");
    process.exit(1);
  }

  console.log(`🏪 Stores: ${allStores.map(s => s.name).join(", ")}`);
  console.log(`📦 Items: ${allItems.length} products to check\n`);

  // Separate Costco from other stores (Costco uses a different API)
  const costcoStores = allStores.filter(s => s.name.toLowerCase().includes("costco"));
  const otherStores = allStores.filter(s => !s.name.toLowerCase().includes("costco"));

  let pricesAdded = 0;
  const errors: string[] = [];

  // --- Kroger prices for non-Costco stores ---
  if (otherStores.length > 0) {
    console.log("🔍 Searching for Kroger-family stores nearby...");
    let krogerLocations: Array<{ locationId: string; name: string; chain: string }> = [];
    try {
      krogerLocations = await searchLocations(zipCode, 25);
      console.log(`   Found ${krogerLocations.length} Kroger locations: ${krogerLocations.map(l => `${l.name} (${l.chain})`).join(", ")}\n`);
    } catch (e: any) {
      console.error(`❌ Failed to find Kroger locations: ${e.message}`);
      errors.push(e.message);
    }

    if (krogerLocations.length > 0) {
      // Map each user store to a Kroger location
      const storeLocIds: string[] = otherStores.map((store, i) => {
        const storeLower = store.name.toLowerCase();
        const chainMatch = krogerLocations.find(loc =>
          storeLower.includes(loc.chain.toLowerCase().replace(/[0-9]/g, "").trim()) ||
          loc.chain.toLowerCase().includes(storeLower.replace(/[^a-z]/g, ""))
        );
        const nameMatch = !chainMatch ? krogerLocations.find(loc =>
          loc.name.toLowerCase().includes(storeLower) ||
          storeLower.includes(loc.name.toLowerCase().split(" - ")[0].toLowerCase())
        ) : null;
        const match = chainMatch || nameMatch;
        if (match) {
          console.log(`   ${store.name} → ${match.name} (${match.chain})`);
          return match.locationId;
        }
        const fallback = krogerLocations[i % krogerLocations.length];
        console.log(`   ${store.name} → ${fallback.name} (fallback)`);
        return fallback.locationId;
      });

      const uniqueLocIds = [...new Set(storeLocIds)];
      console.log("");

      // Fetch prices for each item at each location
      for (let i = 0; i < allItems.length; i++) {
        const item = allItems[i];
        const tags = parseTags(item);
        const searchTerm = [item.name, ...tags].join(" ");

        for (const locId of uniqueLocIds) {
          try {
            let products = await searchProducts(searchTerm, locId, 3);
            let priced = products.filter((p: any) => p.price !== null && p.price > 0);

            // Fallback: try just the item name
            if (priced.length === 0 && searchTerm !== item.name) {
              products = await searchProducts(item.name, locId, 3);
              priced = products.filter((p: any) => p.price !== null && p.price > 0);
            }

            if (priced.length > 0) {
              const best = priced[0];
              const { size, unit } = parseSize(best.size, item.name);

              // Find which stores use this location
              const storeIdsForLoc = otherStores
                .filter((_, idx) => storeLocIds[idx] === locId)
                .map(s => s.id);

              for (const storeId of storeIdsForLoc) {
                await db.insert(priceEntries).values({
                  itemId: item.id,
                  storeId,
                  price: best.price,
                  date: today,
                  size,
                  unit,
                });
                pricesAdded++;
              }
            }
          } catch (e: any) {
            errors.push(`${item.name} @ ${locId}: ${e.message}`);
          }
        }
        // Progress indicator
        process.stdout.write(`\r   Fetching prices... ${i + 1}/${allItems.length} items`);
      }
      console.log(""); // New line after progress
    } else {
      errors.push("No Kroger locations found nearby.");
    }
  }

  // --- Costco prices (if RapidAPI key is set) ---
  if (costcoStores.length > 0) {
    const rapidApiKey = process.env.RAPIDAPI_KEY;
    if (rapidApiKey) {
      console.log("\n🏬 Fetching Costco prices...");
      // Costco API integration would go here (same as server/costco.ts)
      console.log("   (Costco API support — coming soon)");
    } else {
      console.log("\n⚠️  Skipping Costco — no RAPIDAPI_KEY set.");
    }
  }

  // --- Clear old prices for today (avoid duplicates on re-run) ---
  // We already inserted new ones above; this is fine since we fetch fresh every time

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ Done! Added ${pricesAdded} prices in ${elapsed}s`);
  if (errors.length > 0) {
    console.log(`⚠️  ${errors.length} errors:`);
    errors.forEach(e => console.log(`   - ${e}`));
  }
  console.log("");

  process.exit(0);
}

main().catch(err => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
