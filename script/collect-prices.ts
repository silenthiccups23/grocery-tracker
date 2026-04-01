/**
 * Nightly Price Collector
 * 
 * Runs on the Raspberry Pi daily. Launches Playwright, runs each store
 * collector plugin, and writes all discovered products + prices to Turso.
 * 
 * Usage:
 *   npx tsx script/collect-prices.ts
 * 
 * Cron (daily at 3 AM):
 *   0 3 * * * cd /path/to/grocery-tracker && npx tsx script/collect-prices.ts >> collect.log 2>&1
 * 
 * Required env vars:
 *   KROGER_CLIENT_ID, KROGER_CLIENT_SECRET (for Kroger collector)
 *   TURSO_DATABASE_URL, TURSO_AUTH_TOKEN (for cloud DB)
 *   FETCH_ZIP_CODE (default: 92154)
 */

import "dotenv/config";
import { chromium, type Browser } from "playwright";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq, and } from "drizzle-orm";
import {
  stores, products, collectedPrices, collectorRuns, priceAlerts, watchlist,
  type InsertProduct, type InsertCollectedPrice,
} from "../shared/schema.js";
import type { StoreCollector, CollectedProduct } from "./collectors/types.js";

// --- Database connection ---
const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;

if (tursoUrl) {
  console.log("📡 Connected to Turso cloud database");
} else {
  console.log("📁 Using local SQLite database (data.db)");
}

const client = createClient(
  tursoUrl
    ? { url: tursoUrl, authToken: tursoToken }
    : { url: "file:./data.db" }
);
const db = drizzle(client);

// --- Import collectors ---
// Each collector is loaded dynamically so we can add new ones easily
async function loadCollectors(): Promise<StoreCollector[]> {
  const collectors: StoreCollector[] = [];

  // Kroger (API-based — no Playwright needed)
  if (process.env.KROGER_CLIENT_ID && process.env.KROGER_CLIENT_SECRET) {
    const { KrogerCollector } = await import("./collectors/kroger-collector.js");
    collectors.push(new KrogerCollector());
  } else {
    console.log("⚠️  Skipping Kroger — no API credentials set");
  }

  // Walmart (Playwright-based) — disabled until tested
  // To enable: uncomment and run `npx playwright install chromium` on the Pi
  // try {
  //   const { WalmartCollector } = await import("./collectors/walmart-collector.js");
  //   collectors.push(new WalmartCollector());
  // } catch (e: any) {
  //   console.log("⚠️  Skipping Walmart:", e.message);
  // }

  // Albertsons/Vons (Playwright-based) — disabled until tested
  // try {
  //   const { AlbertsonsCollector } = await import("./collectors/albertsons-collector.js");
  //   collectors.push(new AlbertsonsCollector());
  // } catch (e: any) {
  //   console.log("⚠️  Skipping Albertsons:", e.message);
  // }

  return collectors;
}

// --- Main ---
async function main() {
  const startTime = Date.now();
  const zipCode = process.env.FETCH_ZIP_CODE || "92154";
  const today = new Date().toISOString().split("T")[0];

  console.log(`\n🛒 GroceryTrack Nightly Collector`);
  console.log(`📍 ZIP code: ${zipCode}`);
  console.log(`📅 Date: ${today}`);
  console.log(`⏰ Time: ${new Date().toLocaleString()}\n`);

  // Load user's stores
  const allStores = await db.select().from(stores);
  if (allStores.length === 0) {
    console.log("⚠️  No stores in database. Add stores through the app first.");
    process.exit(0);
  }
  console.log(`🏪 Stores: ${allStores.map(s => s.name).join(", ")}\n`);

  // Load collectors
  const collectors = await loadCollectors();
  if (collectors.length === 0) {
    console.log("❌ No collectors available. Check your environment variables.");
    process.exit(1);
  }

  // Launch Playwright (shared browser for all Playwright-based collectors)
  let browser: Browser | undefined;
  const needsBrowser = collectors.some(c => c.chain !== "kroger"); // Kroger uses API, others use browser
  if (needsBrowser) {
    console.log("🌐 Launching browser...");
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    console.log("   Browser ready\n");
  }

  let totalProducts = 0;
  let totalPrices = 0;
  let totalErrors = 0;

  // Run each collector
  for (const collector of collectors) {
    console.log(`\n${"=".repeat(50)}`);
    console.log(`🔍 Running ${collector.name} collector...`);
    console.log(`${"=".repeat(50)}`);

    // Create a run log entry
    const runRows = await db.insert(collectorRuns).values({
      chain: collector.chain,
      startedAt: new Date().toISOString(),
      status: "running",
    }).returning();
    const runId = runRows[0].id;

    try {
      // Initialize
      await collector.init({ browser, zipCode });

      // Collect
      const result = await collector.collectAll();

      console.log(`\n   Found ${result.products.length} products`);

      // Find matching stores for this chain
      const chainStores = allStores.filter(s => {
        const name = s.name.toLowerCase();
        const chainKey = collector.chain;
        // Match store names to chain
        if (chainKey === "kroger") return ["kroger", "ralphs", "fry", "fred meyer", "king soopers", "smith", "food 4 less"].some(k => name.includes(k));
        if (chainKey === "walmart") return name.includes("walmart");
        if (chainKey === "albertsons") return ["albertsons", "vons", "safeway", "pavilions", "jewel", "shaw", "acme"].some(k => name.includes(k));
        return false;
      });

      if (chainStores.length === 0) {
        console.log(`   ⚠️  No stores match chain "${collector.chain}" — skipping price storage`);
        result.errors.push(`No stores match chain "${collector.chain}"`);
      }

      // Upsert products and store prices
      let productsStored = 0;
      let pricesStored = 0;

      for (const cp of result.products) {
        try {
          // Upsert the product
          const productData: InsertProduct = {
            name: cp.name,
            brand: cp.brand || null,
            category: cp.category || null,
            subcategory: cp.subcategory || null,
            size: cp.size || null,
            sizeNum: cp.sizeNum || null,
            sizeUnit: cp.sizeUnit || null,
            imageUrl: cp.imageUrl || null,
            chain: collector.chain,
            storeProductUrl: cp.storeProductUrl || null,
            lastSeen: today,
          };

          // Find or create product
          const existing = await db.select().from(products).where(
            and(
              eq(products.name, cp.name),
              eq(products.chain, collector.chain),
            )
          );

          let productId: number;
          if (existing.length > 0) {
            await db.update(products).set(productData).where(eq(products.id, existing[0].id));
            productId = existing[0].id;
          } else {
            const rows = await db.insert(products).values(productData).returning();
            productId = rows[0].id;
          }
          productsStored++;

          // Store price at the matching store
          // If the product has a storeName (e.g. "Ralphs", "Food 4 Less"), match it specifically
          // Otherwise, store at all chain stores
          const matchingStores = cp.storeName
            ? chainStores.filter(s => s.name.toLowerCase().includes(cp.storeName!.toLowerCase()) ||
                cp.storeName!.toLowerCase().includes(s.name.toLowerCase()))
            : chainStores;

          for (const store of (matchingStores.length > 0 ? matchingStores : chainStores.slice(0, 1))) {
            await db.insert(collectedPrices).values({
              productId,
              storeId: store.id,
              price: cp.price,
              promoPrice: cp.promoPrice || null,
              date: today,
            });
            pricesStored++;
          }
        } catch (err: any) {
          result.errors.push(`${cp.name}: ${err.message}`);
        }

        // Progress
        if (productsStored % 50 === 0) {
          process.stdout.write(`\r   Storing... ${productsStored}/${result.products.length} products`);
        }
      }
      if (result.products.length > 0) console.log(`\r   Stored ${productsStored} products, ${pricesStored} prices`);

      totalProducts += productsStored;
      totalPrices += pricesStored;
      totalErrors += result.errors.length;

      // Update run log
      await db.update(collectorRuns).set({
        finishedAt: new Date().toISOString(),
        productsFound: productsStored,
        pricesCollected: pricesStored,
        errors: result.errors.length,
        status: "completed",
      }).where(eq(collectorRuns.id, runId));

      if (result.errors.length > 0) {
        console.log(`   ⚠️  ${result.errors.length} errors:`);
        result.errors.slice(0, 5).forEach(e => console.log(`      - ${e}`));
        if (result.errors.length > 5) console.log(`      ... and ${result.errors.length - 5} more`);
      }

    } catch (err: any) {
      console.error(`   ❌ Collector failed: ${err.message}`);
      totalErrors++;
      await db.update(collectorRuns).set({
        finishedAt: new Date().toISOString(),
        status: "failed",
        errors: 1,
      }).where(eq(collectorRuns.id, runId));
    }

    // Cleanup
    await collector.cleanup();
  }

  // Close browser
  if (browser) {
    await browser.close();
  }

  // --- Check price alerts ---
  const activeAlerts = await db.select().from(priceAlerts).where(eq(priceAlerts.active, 1));
  if (activeAlerts.length > 0) {
    console.log(`\n🔔 Checking ${activeAlerts.length} price alert${activeAlerts.length === 1 ? '' : 's'}...`);
    const watchlistItems = await db.select().from(watchlist);
    let triggeredCount = 0;

    for (const alert of activeAlerts) {
      const watchItem = watchlistItems.find(w => w.id === alert.watchlistId);
      if (!watchItem) continue;

      // Search for matching products by name
      const matchingProducts = await db.select().from(products)
        .where(eq(products.name, watchItem.productName));
      
      if (matchingProducts.length === 0) continue;

      // Check today's prices for these products
      for (const product of matchingProducts) {
        const todaysPrices = await db.select().from(collectedPrices).where(
          and(
            eq(collectedPrices.productId, product.id),
            eq(collectedPrices.date, today),
          )
        );

        for (const price of todaysPrices) {
          if (price.price <= alert.targetPrice) {
            const store = allStores.find(s => s.id === price.storeId);
            triggeredCount++;
            console.log(`   🎉 ${product.name} is $${price.price.toFixed(2)} at ${store?.name || 'unknown'} (target: $${alert.targetPrice.toFixed(2)})`);
            await db.update(priceAlerts).set({ lastTriggered: today }).where(eq(priceAlerts.id, alert.id));
            break; // Only trigger once per alert
          }
        }
      }
    }

    if (triggeredCount === 0) {
      console.log("   No alerts triggered today.");
    } else {
      console.log(`   ${triggeredCount} alert${triggeredCount === 1 ? '' : 's'} triggered!`);
    }
  }

  // --- Clean old prices (keep 30 days) ---
  // TODO: enable this once collection is stable
  // const cleaned = await db.delete(collectedPrices).where(sql`date < date('now', '-30 days')`);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n${"=".repeat(50)}`);
  console.log(`✅ Done! ${totalProducts} products, ${totalPrices} prices in ${elapsed}s`);
  if (totalErrors > 0) {
    console.log(`⚠️  ${totalErrors} total errors`);
  }
  console.log("");

  process.exit(0);
}

main().catch(err => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
