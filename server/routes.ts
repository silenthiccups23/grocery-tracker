import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertStoreSchema, insertItemSchema, insertPriceEntrySchema, parseTags } from "@shared/schema";
import {
  setKrogerCredentials, getKrogerCredentials, hasKrogerCredentials,
  searchProducts, searchLocations, fetchPricesForItem,
  type KrogerProduct,
} from "./kroger";
import {
  setRapidApiKey, getRapidApiKey, hasRapidApiKey,
  searchCostcoProducts, type CostcoProduct,
} from "./costco";

// ---- Geocoding & Store Search Helpers ----

interface FoundStore {
  name: string;
  address: string;
  lat: number;
  lon: number;
}

// Major US grocery chains with 10+ stores nationwide.
// Matches against store name OR OSM brand tag (case-insensitive, partial match).
const CHAIN_KEYWORDS: string[] = [
  // Big-box / wholesale
  "walmart", "target", "costco", "sam's club", "bj's wholesale",
  // Major supermarket chains
  "kroger", "ralphs", "fry's", "fred meyer", "king soopers", "smith's",
  "albertsons", "safeway", "vons", "pavilions", "jewel-osco", "acme",
  "shaw's", "star market", "randalls", "tom thumb",
  "publix", "h-e-b", "heb", "meijer", "hy-vee",
  "stop & shop", "giant", "giant eagle", "food lion", "hannaford",
  "harris teeter", "wegmans", "market basket",
  // Value / discount
  "aldi", "lidl", "food 4 less", "grocery outlet", "save-a-lot",
  "winco", "price chopper", "shoprite", "price rite", "piggly wiggly",
  "food bazaar", "food city", "stater bros",
  // Natural / specialty
  "whole foods", "trader joe's", "sprouts", "natural grocers",
  "fresh market", "earth fare", "fresh thyme",
  // Warehouse / smart
  "smart & final", "restaurant depot",
  // Asian / international chains (10+ US locations)
  "h mart", "99 ranch", "mitsuwa", "marukai", "tokyo central",
  "ranch 99", "seafood city", "cardenas", "el super",
  "fiesta mart", "northgate", "vallarta",
  // Other large chains
  "winn-dixie", "bi-lo", "ingles", "harveys",
  "lucky", "nob hill", "raley's", "bel air",
  "gelson's", "bristol farms",
];

function isChainStore(name: string, brand: string): boolean {
  const lower = `${name} ${brand}`.toLowerCase();
  return CHAIN_KEYWORDS.some(kw => lower.includes(kw));
}

async function geocodeZip(zip: string): Promise<{ lat: number; lon: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(zip)}&country=US&format=json&limit=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": "GroceryTracker/1.0 (student-project)" },
  });
  if (!res.ok) return null;
  const data = await res.json() as any[];
  if (!data || data.length === 0) return null;
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}

async function searchStoresNearby(lat: number, lon: number, radiusMiles: number): Promise<FoundStore[]> {
  const radiusMeters = Math.round(radiusMiles * 1609.34);
  const query = `[out:json][timeout:25];(nwr["shop"="supermarket"](around:${radiusMeters},${lat},${lon});nwr["shop"="wholesale"](around:${radiusMeters},${lat},${lon}););out center;`;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) throw new Error("Store search service unavailable. Please try again.");
  const data = await res.json() as any;
  const elements: any[] = data.elements || [];

  const results: FoundStore[] = [];

  for (const el of elements) {
    const tags = el.tags || {};
    const name = tags.name || tags.brand || "Unknown Store";
    const brand = tags.brand || "";
    const elLat = el.lat ?? el.center?.lat;
    const elLon = el.lon ?? el.center?.lon;
    if (!elLat || !elLon) continue;

    // Only include recognized chain stores (10+ locations)
    if (!isChainStore(name, brand)) continue;

    // Build address from OSM tags only (no slow reverse geocoding)
    let address = "";
    const num = tags["addr:housenumber"] || "";
    const street = tags["addr:street"] || "";
    const city = tags["addr:city"] || "";
    const state = tags["addr:state"] || "";
    const postcode = tags["addr:postcode"] || "";
    if (street) {
      const parts: string[] = [];
      parts.push(num ? `${num} ${street}` : street);
      if (city) parts.push(city);
      if (state) parts.push(state);
      if (postcode) parts.push(postcode);
      address = parts.join(", ");
    }

    results.push({ name, address, lat: elLat, lon: elLon });
  }

  // Deduplicate by name+address (OSM sometimes has duplicate entries)
  const seen = new Set<string>();
  return results.filter(s => {
    const key = `${s.name.toLowerCase()}|${s.address.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // === STORES ===
  app.get("/api/stores", async (_req, res) => {
    const storeList = await storage.getStores();
    res.json(storeList);
  });

  app.post("/api/stores", async (req, res) => {
    const parsed = insertStoreSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message });
    }
    const store = await storage.createStore(parsed.data);
    res.status(201).json(store);
  });

  app.patch("/api/stores/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const store = await storage.getStore(id);
    if (!store) return res.status(404).json({ error: "Store not found" });
    const updated = await storage.updateStore(id, {
      location: req.body.location ?? store.location,
      address: req.body.address ?? store.address,
    });
    res.json(updated);
  });

  // Search for stores by zip code + radius
  app.get("/api/stores/search", async (req, res) => {
    const zip = (req.query.zip as string || "").trim();
    const radiusMiles = parseFloat(req.query.radius as string || "5");
    if (!zip || !/^\d{5}$/.test(zip)) {
      return res.status(400).json({ error: "Please enter a valid 5-digit zip code." });
    }
    if (isNaN(radiusMiles) || radiusMiles < 1 || radiusMiles > 25) {
      return res.status(400).json({ error: "Radius must be between 1 and 25 miles." });
    }
    try {
      const coords = await geocodeZip(zip);
      if (!coords) {
        return res.status(404).json({ error: `Could not find location for zip code ${zip}.` });
      }
      const found = await searchStoresNearby(coords.lat, coords.lon, radiusMiles);
      res.json({ stores: found, center: coords, zip, radiusMiles });
    } catch (err: any) {
      res.status(502).json({ error: err.message || "Search failed. Please try again." });
    }
  });

  // Bulk-add stores from search results
  app.post("/api/stores/bulk", async (req, res) => {
    const storesData: Array<{ name: string; address: string }> = req.body.stores;
    if (!Array.isArray(storesData) || storesData.length === 0) {
      return res.status(400).json({ error: "No stores provided." });
    }
    const created: any[] = [];
    for (const s of storesData) {
      const store = await storage.createStore({
        name: s.name,
        location: null,
        address: s.address || null,
      });
      created.push(store);
    }
    res.status(201).json(created);
  });

  app.delete("/api/stores/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    await storage.deleteStore(id);
    res.status(204).send();
  });

  // === ITEMS ===
  app.get("/api/items", async (_req, res) => {
    const itemList = await storage.getItems();
    res.json(itemList);
  });

  app.post("/api/items", async (req, res) => {
    const parsed = insertItemSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message });
    }
    const item = await storage.createItem(parsed.data);
    res.status(201).json(item);
  });

  app.patch("/api/items/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const item = await storage.getItem(id);
    if (!item) return res.status(404).json({ error: "Item not found" });
    const updated = await storage.updateItem(id, {
      name: req.body.name ?? item.name,
      category: req.body.category !== undefined ? req.body.category : item.category,
      tags: req.body.tags !== undefined ? req.body.tags : item.tags,
      defaultUnit: req.body.defaultUnit !== undefined ? req.body.defaultUnit : item.defaultUnit,
    });
    res.json(updated);
  });

  app.delete("/api/items/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    await storage.deleteItem(id);
    res.status(204).send();
  });

  // === PRICE ENTRIES ===
  app.get("/api/prices", async (_req, res) => {
    const entries = await storage.getPriceEntries();
    res.json(entries);
  });

  app.get("/api/prices/item/:itemId", async (req, res) => {
    const itemId = parseInt(req.params.itemId);
    if (isNaN(itemId)) return res.status(400).json({ error: "Invalid ID" });
    const entries = await storage.getPriceEntriesByItem(itemId);
    res.json(entries);
  });

  app.post("/api/prices", async (req, res) => {
    const parsed = insertPriceEntrySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message });
    }
    const entry = await storage.createPriceEntry(parsed.data);
    res.status(201).json(entry);
  });

  app.delete("/api/prices/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    await storage.deletePriceEntry(id);
    res.status(204).send();
  });

  // === KROGER PRODUCT SEARCH ===
  app.get("/api/kroger/products", async (req, res) => {
    if (!hasKrogerCredentials()) {
      // Try loading from DB
      const clientId = await storage.getSetting("kroger_client_id");
      const clientSecret = await storage.getSetting("kroger_client_secret");
      if (clientId && clientSecret) {
        setKrogerCredentials(clientId, clientSecret);
      } else {
        return res.status(400).json({ error: "Kroger API not configured. Go to Settings to add your credentials." });
      }
    }
    const term = req.query.term as string;
    const locationId = req.query.locationId as string;
    if (!term) return res.status(400).json({ error: "Search term is required." });
    try {
      const products = await searchProducts(term, locationId || undefined, 10);
      res.json(products);
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  // === FETCH & SAVE LIVE PRICES ===
  // Fetches real prices from Kroger API (+ Costco API for Costco stores) for all items.
  // Uses parallel requests to stay under 2 seconds.
  app.post("/api/prices/fetch-live", async (req, res) => {
    // Ensure at least one pricing API is configured
    if (!hasKrogerCredentials()) {
      const clientId = await storage.getSetting("kroger_client_id");
      const clientSecret = await storage.getSetting("kroger_client_secret");
      if (clientId && clientSecret) {
        setKrogerCredentials(clientId, clientSecret);
      }
    }
    if (!hasRapidApiKey()) {
      const dbKey = await storage.getSetting("rapidapi_key");
      if (dbKey) setRapidApiKey(dbKey);
    }

    if (!hasKrogerCredentials() && !hasRapidApiKey()) {
      return res.status(400).json({ error: "No pricing APIs configured. Go to Settings to add Kroger or Costco API credentials." });
    }

    try {
      const allItems = await storage.getItems();
      const allStores = await storage.getStores();
      const today = new Date().toISOString().split("T")[0];
      let pricesAdded = 0;
      const errors: string[] = [];

      // Separate Costco stores from non-Costco stores
      const costcoStores = allStores.filter(s => s.name.toLowerCase().includes("costco"));
      const otherStores = allStores.filter(s => !s.name.toLowerCase().includes("costco"));

      // Build search terms for all items
      const itemSearchTerms = allItems.map(item => {
        const tags = parseTags(item);
        return [item.name, ...tags].join(" ");
      });

      // --- Kroger prices for non-Costco stores ---
      if (otherStores.length > 0 && hasKrogerCredentials()) {
        const zipCode = req.body?.zipCode || "92154";
        let krogerLocations: Array<{ locationId: string; name: string; chain: string }> = [];
        try {
          const locations = await searchLocations(zipCode, 25);
          krogerLocations = locations;
        } catch {}

        if (krogerLocations.length > 0) {
          // Smart store-to-location mapping:
          // 1. Try to match by chain name (Ralphs → Ralphs location, Food 4 Less → Food4Less location)
          // 2. Fall back to round-robin across all available locations
          const storeLocIds: string[] = otherStores.map((store, i) => {
            const storeLower = store.name.toLowerCase();
            // Try to find a Kroger location matching this store's chain
            const chainMatch = krogerLocations.find(loc =>
              storeLower.includes(loc.chain.toLowerCase().replace(/[0-9]/g, "").trim()) ||
              loc.chain.toLowerCase().includes(storeLower.replace(/[^a-z]/g, ""))
            );
            // Also try matching by name (e.g. store "Ralphs" matches location name "Ralphs - Bonita")
            const nameMatch = !chainMatch ? krogerLocations.find(loc =>
              loc.name.toLowerCase().includes(storeLower) ||
              storeLower.includes(loc.name.toLowerCase().split(" - ")[0].toLowerCase())
            ) : null;
            const match = chainMatch || nameMatch;
            if (match) return match.locationId;
            // No match — assign a location round-robin so every store still gets prices
            return krogerLocations[i % krogerLocations.length].locationId;
          });
          const uniqueLocIds = [...new Set(storeLocIds)];

          const uniqueTasks = new Map<string, { itemIdxs: number[]; locId: string; term: string }>();
          for (let i = 0; i < allItems.length; i++) {
            for (const locId of uniqueLocIds) {
              const key = `${locId}|${itemSearchTerms[i]}`;
              if (!uniqueTasks.has(key)) {
                uniqueTasks.set(key, { itemIdxs: [i], locId, term: itemSearchTerms[i] });
              } else {
                uniqueTasks.get(key)!.itemIdxs.push(i);
              }
            }
          }

          const taskList = Array.from(uniqueTasks.values());
          const krogerCache = new Map<string, { price: number; size: number | null; unit: string | null }>();

          // Build fallback search terms for items whose names might not be recognized
          // e.g. "Winnies Organic" -> fallback to "sausage Organic" (using category as product type)
          const categoryFallbacks: Record<string, string> = {
            Meat: "meat", Dairy: "milk", Produce: "produce", Bakery: "bread",
            Frozen: "frozen", Beverages: "drink", Snacks: "snack", Pantry: "pantry",
            Household: "household", Other: "",
          };

          const results = await Promise.allSettled(
            taskList.map(async ({ locId, term }) => {
              let products = await searchProducts(term, locId, 3);
              let priced = products.filter(p => p.price !== null && p.price > 0);

              // Fallback: if no results, try just the item name without tags
              if (priced.length === 0) {
                const matchingItem = allItems.find((_, idx) => itemSearchTerms[idx] === term);
                if (matchingItem) {
                  // Try just the item name alone
                  const nameOnly = matchingItem.name;
                  if (nameOnly !== term) {
                    products = await searchProducts(nameOnly, locId, 3);
                    priced = products.filter(p => p.price !== null && p.price > 0);
                  }
                  // Still nothing? Try category + tags as a generic search
                  if (priced.length === 0 && matchingItem.category) {
                    const tags = parseTags(matchingItem);
                    const fallbackTerm = [matchingItem.category, ...tags].join(" ");
                    products = await searchProducts(fallbackTerm, locId, 3);
                    priced = products.filter(p => p.price !== null && p.price > 0);
                  }
                }
              }

              if (priced.length > 0) {
                const product = priced[0];
                const defaultUnit = allItems.find((_, idx) => itemSearchTerms[idx] === term)?.defaultUnit || null;
                const sizeInfo = parseKrogerSize(product.size, defaultUnit);
                const finalPrice = product.promoPrice && product.promoPrice > 0
                  ? product.promoPrice : product.price!;
                krogerCache.set(`${locId}|${term}`, { price: finalPrice, size: sizeInfo.size, unit: sizeInfo.unit });
              }
            })
          );

          for (const r of results) {
            if (r.status === "rejected") {
              errors.push(String(r.reason).substring(0, 100));
            }
          }

          // Save Kroger prices for non-Costco stores
          for (let i = 0; i < allItems.length; i++) {
            for (let s = 0; s < otherStores.length; s++) {
              const locId = storeLocIds[s];
              const cacheKey = `${locId}|${itemSearchTerms[i]}`;
              const result = krogerCache.get(cacheKey);
              if (result) {
                await storage.createPriceEntry({
                  itemId: allItems[i].id,
                  storeId: otherStores[s].id,
                  price: result.price,
                  date: today,
                  size: result.size,
                  unit: result.unit,
                });
                pricesAdded++;
              }
            }
          }
        } else if (otherStores.length > 0) {
          errors.push("No Kroger-family stores found near that area.");
        }
      }

      // --- Costco prices ---
      if (costcoStores.length > 0 && hasRapidApiKey()) {
        // Deduplicate search terms — one Costco API call per unique item term
        const uniqueTerms = [...new Set(itemSearchTerms)];
        const costcoCache = new Map<string, { price: number; size: number | null; unit: string | null }>();

        const costcoResults = await Promise.allSettled(
          uniqueTerms.map(async (term) => {
            const products = await searchCostcoProducts(term);
            // Find the first product with a price
            const priced = products.filter(p => p.price !== null && p.price > 0);
            if (priced.length > 0) {
              const product = priced[0];
              const defaultUnit = allItems.find((_, idx) => itemSearchTerms[idx] === term)?.defaultUnit || null;
              const sizeInfo = parseCostcoSize(product.size || product.name, defaultUnit);
              costcoCache.set(term, { price: product.price!, size: sizeInfo.size, unit: sizeInfo.unit });
            }
          })
        );

        for (const r of costcoResults) {
          if (r.status === "rejected") {
            errors.push("Costco: " + String(r.reason).substring(0, 80));
          }
        }

        // Save Costco prices for all Costco stores
        for (let i = 0; i < allItems.length; i++) {
          const result = costcoCache.get(itemSearchTerms[i]);
          if (result) {
            for (const costcoStore of costcoStores) {
              await storage.createPriceEntry({
                itemId: allItems[i].id,
                storeId: costcoStore.id,
                price: result.price,
                date: today,
                size: result.size,
                unit: result.unit,
              });
              pricesAdded++;
            }
          }
        }
      } else if (costcoStores.length > 0 && !hasRapidApiKey()) {
        errors.push("Costco store found but Costco API not configured. Go to Settings.");
      }

      res.json({ pricesAdded, errors: errors.length > 0 ? errors : undefined });
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  // Load API credentials on startup and pre-warm tokens
  (async () => {
    try {
      // Kroger
      const clientId = await storage.getSetting("kroger_client_id");
      const clientSecret = await storage.getSetting("kroger_client_secret");
      if (clientId && clientSecret) {
        setKrogerCredentials(clientId, clientSecret);
      }
      if (hasKrogerCredentials()) {
        await searchProducts("milk", undefined, 1).catch(() => {});
        console.log("Kroger API token pre-warmed.");
      }
      // Costco / RapidAPI
      const dbKey = await storage.getSetting("rapidapi_key");
      if (dbKey) {
        setRapidApiKey(dbKey);
        console.log("Costco API key loaded from DB.");
      }
    } catch {}
  })();

  return httpServer;
}

// Units that are always measured in liquid volumes — bare "oz" should become "fl oz"
const LIQUID_UNITS = new Set(["fl oz", "gal", "L"]);
// Units that are always counts — ignore weight-based matches entirely
const COUNT_UNITS = new Set(["ct"]);

// Helper to parse Kroger's size strings like "1 gal", "1/2 Gallon", "64 fl oz"
// Uses the item's defaultUnit to disambiguate: if the item is a liquid (defaultUnit = "fl oz"),
// bare "oz" is treated as "fl oz". If the item is counted (defaultUnit = "ct"),
// weight-based matches (oz, lb) are skipped.
function parseKrogerSize(sizeStr: string, defaultUnit: string | null): { size: number | null; unit: string | null } {
  if (!sizeStr) return { size: null, unit: defaultUnit };
  const s = sizeStr.toLowerCase().trim();
  const isLiquid = LIQUID_UNITS.has(defaultUnit || "");
  const isCount = COUNT_UNITS.has(defaultUnit || "");

  // Common patterns
  const patterns: Array<{ regex: RegExp; handler: (m: RegExpMatchArray) => { size: number; unit: string } | null }> = [
    { regex: /^(\d+\.?\d*)\s*gal/i, handler: m => ({ size: parseFloat(m[1]) * 128, unit: "fl oz" }) },
    { regex: /^1\/2\s*gal/i, handler: () => ({ size: 64, unit: "fl oz" }) },
    { regex: /^half\s*gal/i, handler: () => ({ size: 64, unit: "fl oz" }) },
    { regex: /^(\d+\.?\d*)\s*fl\.?\s*oz/i, handler: m => ({ size: parseFloat(m[1]), unit: "fl oz" }) },
    // Bare "oz": for liquids → fl oz; for count items → skip
    { regex: /^(\d+\.?\d*)\s*oz/i, handler: m => {
      if (isCount) return null; // skip oz for count-based items like eggs
      return { size: parseFloat(m[1]), unit: isLiquid ? "fl oz" : "oz" };
    }},
    // "lb": skip for liquids and count items
    { regex: /^(\d+\.?\d*)\s*lb/i, handler: m => {
      if (isLiquid || isCount) return null;
      return { size: parseFloat(m[1]), unit: "lb" };
    }},
    { regex: /^(\d+\.?\d*)\s*ct/i, handler: m => ({ size: parseFloat(m[1]), unit: "ct" }) },
    { regex: /^(\d+\.?\d*)\s*count/i, handler: m => ({ size: parseFloat(m[1]), unit: "ct" }) },
    { regex: /^(\d+\.?\d*)\s*l(?:iter)?/i, handler: m => ({ size: parseFloat(m[1]), unit: "L" }) },
  ];

  for (const { regex, handler } of patterns) {
    const match = s.match(regex);
    if (match) {
      const result = handler(match);
      if (result) return result;
    }
  }

  return { size: null, unit: defaultUnit };
}

// Helper to parse Costco size strings. Costco product names often include sizes like
// "Kirkland Signature Organic Whole Milk, 1 Gallon, 2-count"
// Same category-awareness as parseKrogerSize.
function parseCostcoSize(sizeStr: string, defaultUnit: string | null): { size: number | null; unit: string | null } {
  if (!sizeStr) return { size: null, unit: defaultUnit };
  const s = sizeStr.toLowerCase();
  const isLiquid = LIQUID_UNITS.has(defaultUnit || "");
  const isCount = COUNT_UNITS.has(defaultUnit || "");

  // Costco-specific patterns (often embedded in product names)
  const patterns: Array<{ regex: RegExp; handler: (m: RegExpMatchArray) => { size: number; unit: string } | null }> = [
    // "2 x 1 gallon", "2-count, 1 gallon" etc.
    { regex: /(\d+)\s*x\s*(\d+\.?\d*)\s*gal/i, handler: m => ({ size: parseInt(m[1]) * parseFloat(m[2]) * 128, unit: "fl oz" }) },
    { regex: /(\d+\.?\d*)\s*gal/i, handler: m => ({ size: parseFloat(m[1]) * 128, unit: "fl oz" }) },
    { regex: /half\s*gal/i, handler: () => ({ size: 64, unit: "fl oz" }) },
    { regex: /1\/2\s*gal/i, handler: () => ({ size: 64, unit: "fl oz" }) },
    { regex: /(\d+\.?\d*)\s*fl\.?\s*oz/i, handler: m => ({ size: parseFloat(m[1]), unit: "fl oz" }) },
    { regex: /(\d+\.?\d*)\s*oz/i, handler: m => {
      if (isCount) return null;
      return { size: parseFloat(m[1]), unit: isLiquid ? "fl oz" : "oz" };
    }},
    { regex: /(\d+\.?\d*)\s*lb/i, handler: m => {
      if (isLiquid || isCount) return null;
      return { size: parseFloat(m[1]), unit: "lb" };
    }},
    { regex: /(\d+\.?\d*)\s*ct|count/i, handler: m => ({ size: parseFloat(m[1]), unit: "ct" }) },
    { regex: /(\d+\.?\d*)\s*l(?:iter)?(?:s)?\b/i, handler: m => ({ size: parseFloat(m[1]), unit: "L" }) },
    { regex: /(\d+\.?\d*)\s*kg/i, handler: m => {
      if (isLiquid || isCount) return null;
      return { size: parseFloat(m[1]) * 2.205, unit: "lb" };
    }},
  ];

  for (const { regex, handler } of patterns) {
    const match = s.match(regex);
    if (match) {
      const result = handler(match);
      if (result) return result;
    }
  }

  return { size: null, unit: defaultUnit };
}
