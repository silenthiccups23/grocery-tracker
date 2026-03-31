import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertStoreSchema, insertItemSchema, insertPriceEntrySchema, insertPriceAlertSchema, parseTags } from "@shared/schema";
import {
  setKrogerCredentials, getKrogerCredentials, hasKrogerCredentials,
  searchProducts, searchLocations, fetchPricesForItem,
  type KrogerProduct,
} from "./kroger";
import {
  setRapidApiKey, getRapidApiKey, hasRapidApiKey,
  searchCostcoProducts, type CostcoProduct,
} from "./costco";
import { geocodeZip, searchStoresNearby, type FoundStore } from "./storeSearch";
import { parseKrogerSize, parseCostcoSize, inferDefaultSize } from "./sizeParser";

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

  // === PRODUCTS (collected by Pi) ===
  app.get("/api/products", async (req, res) => {
    const { chain, category, search, limit, offset } = req.query;
    const products = await storage.getProducts({
      chain: chain as string,
      category: category as string,
      search: search as string,
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0,
    });
    const total = await storage.getProductCount({
      chain: chain as string,
      category: category as string,
      search: search as string,
    });
    res.json({ products, total });
  });

  app.get("/api/products/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const product = await storage.getProduct(id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  });

  app.get("/api/products/:id/prices", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const prices = await storage.getLatestPrices(id);
    res.json(prices);
  });

  // === COLLECTOR STATUS ===
  app.get("/api/collector/status", async (_req, res) => {
    const runs = await storage.getLatestCollectorRuns();
    res.json(runs);
  });

  // === WATCHLIST ===
  app.get("/api/watchlist", async (_req, res) => {
    const list = await storage.getWatchlist();
    res.json(list);
  });

  app.post("/api/watchlist", async (req, res) => {
    const { productName, category, tags, defaultUnit } = req.body;
    if (!productName?.trim()) return res.status(400).json({ error: "Product name is required" });
    const item = await storage.createWatchlistItem({
      productName: productName.trim(),
      category: category || null,
      tags: tags || null,
      defaultUnit: defaultUnit || null,
    });
    res.status(201).json(item);
  });

  app.delete("/api/watchlist/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    await storage.deleteWatchlistItem(id);
    res.status(204).send();
  });

  // === ITEMS (legacy) ===
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

  // Bulk create items
  app.post("/api/items/bulk", async (req, res) => {
    const itemsData: Array<{ name: string; category: string | null; tags: string | null; defaultUnit: string | null }> = req.body.items;
    if (!Array.isArray(itemsData) || itemsData.length === 0) {
      return res.status(400).json({ error: "No items provided." });
    }
    const created: any[] = [];
    for (const data of itemsData) {
      if (!data.name?.trim()) continue;
      const item = await storage.createItem({
        name: data.name.trim(),
        category: data.category || null,
        tags: data.tags || null,
        defaultUnit: data.defaultUnit || null,
      });
      created.push(item);
    }
    res.status(201).json(created);
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

  // === PRICE ALERTS ===
  app.get("/api/alerts", async (_req, res) => {
    const alerts = await storage.getPriceAlerts();
    res.json(alerts);
  });

  app.get("/api/alerts/item/:itemId", async (req, res) => {
    const itemId = parseInt(req.params.itemId);
    if (isNaN(itemId)) return res.status(400).json({ error: "Invalid ID" });
    const alerts = await storage.getPriceAlertsByWatchlistItem(itemId);
    res.json(alerts);
  });

  app.post("/api/alerts", async (req, res) => {
    const parsed = insertPriceAlertSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message });
    }
    const alert = await storage.createPriceAlert(parsed.data);
    res.status(201).json(alert);
  });

  app.patch("/api/alerts/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    try {
      const updated = await storage.updatePriceAlert(id, req.body);
      res.json(updated);
    } catch {
      res.status(404).json({ error: "Alert not found" });
    }
  });

  app.delete("/api/alerts/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    await storage.deletePriceAlert(id);
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
          // Smart store-to-location mapping
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
            if (match) return match.locationId;
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

          const results = await Promise.allSettled(
            taskList.map(async ({ locId, term }) => {
              let products = await searchProducts(term, locId, 3);
              let priced = products.filter(p => p.price !== null && p.price > 0);

              // Fallback: if no results, try just the item name without tags
              if (priced.length === 0) {
                const matchingItem = allItems.find((_, idx) => itemSearchTerms[idx] === term);
                if (matchingItem) {
                  const nameOnly = matchingItem.name;
                  if (nameOnly !== term) {
                    products = await searchProducts(nameOnly, locId, 3);
                    priced = products.filter(p => p.price !== null && p.price > 0);
                  }
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
                const matchingItem = allItems.find((_, idx) => itemSearchTerms[idx] === term);
                const defaultUnit = matchingItem?.defaultUnit || null;
                let sizeInfo = parseKrogerSize(product.size, defaultUnit);
                if (!sizeInfo.size && product.description) {
                  sizeInfo = parseKrogerSize(product.description, defaultUnit);
                }
                if (!sizeInfo.size && defaultUnit) {
                  const defaults = inferDefaultSize(matchingItem?.name || "", defaultUnit);
                  sizeInfo = { size: defaults.size, unit: defaults.unit || defaultUnit };
                }
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
        const uniqueTerms = [...new Set(itemSearchTerms)];
        const costcoCache = new Map<string, { price: number; size: number | null; unit: string | null }>();

        const costcoResults = await Promise.allSettled(
          uniqueTerms.map(async (term) => {
            const products = await searchCostcoProducts(term);
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
