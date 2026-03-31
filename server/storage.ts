import {
  type Store, type InsertStore, stores,
  type Product, type InsertProduct, products,
  type CollectedPrice, type InsertCollectedPrice, collectedPrices,
  type WatchlistItem, type InsertWatchlistItem, watchlist,
  type PriceAlert, type InsertPriceAlert, priceAlerts,
  type CollectorRun, type InsertCollectorRun, collectorRuns,
  // Legacy
  type Item, type InsertItem, items,
  type PriceEntry, type InsertPriceEntry, priceEntries,
  settings,
} from "@shared/schema";
import { eq, and, desc, like, or, sql } from "drizzle-orm";
import { drizzle as drizzleLibsql } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";

// Connect to Turso (cloud) if TURSO_DATABASE_URL is set, otherwise fall back to local file
const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;

const client = createClient(
  tursoUrl
    ? { url: tursoUrl, authToken: tursoToken }
    : { url: "file:./data.db" }
);

export const db = drizzleLibsql(client);

export interface IStorage {
  // Settings
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;

  // Stores
  getStores(): Promise<Store[]>;
  getStore(id: number): Promise<Store | undefined>;
  createStore(store: InsertStore): Promise<Store>;
  updateStore(id: number, data: Partial<InsertStore>): Promise<Store>;
  deleteStore(id: number): Promise<void>;

  // Products (collected by Pi)
  getProducts(options?: { chain?: string; category?: string; search?: string; limit?: number; offset?: number }): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  getProductCount(options?: { chain?: string; category?: string; search?: string }): Promise<number>;
  upsertProduct(product: InsertProduct): Promise<Product>;
  bulkUpsertProducts(productList: InsertProduct[]): Promise<number>;

  // Collected Prices
  getLatestPrices(productId: number): Promise<CollectedPrice[]>;
  getLatestPricesForProducts(productIds: number[], storeIds?: number[]): Promise<CollectedPrice[]>;
  createCollectedPrice(price: InsertCollectedPrice): Promise<CollectedPrice>;
  bulkCreateCollectedPrices(prices: InsertCollectedPrice[]): Promise<number>;
  cleanOldPrices(keepDays: number): Promise<number>;

  // Watchlist
  getWatchlist(): Promise<WatchlistItem[]>;
  createWatchlistItem(item: InsertWatchlistItem): Promise<WatchlistItem>;
  deleteWatchlistItem(id: number): Promise<void>;

  // Price Alerts
  getPriceAlerts(): Promise<PriceAlert[]>;
  getPriceAlertsByWatchlistItem(watchlistId: number): Promise<PriceAlert[]>;
  createPriceAlert(alert: InsertPriceAlert): Promise<PriceAlert>;
  updatePriceAlert(id: number, data: Partial<InsertPriceAlert & { lastTriggered: string | null }>): Promise<PriceAlert>;
  deletePriceAlert(id: number): Promise<void>;

  // Collector Runs
  createCollectorRun(run: InsertCollectorRun): Promise<CollectorRun>;
  updateCollectorRun(id: number, data: Partial<InsertCollectorRun>): Promise<CollectorRun>;
  getLatestCollectorRuns(): Promise<CollectorRun[]>;

  // Legacy
  getItems(): Promise<Item[]>;
  getItem(id: number): Promise<Item | undefined>;
  createItem(item: InsertItem): Promise<Item>;
  updateItem(id: number, data: Partial<InsertItem>): Promise<Item>;
  deleteItem(id: number): Promise<void>;
  getPriceEntries(): Promise<PriceEntry[]>;
  getPriceEntriesByItem(itemId: number): Promise<PriceEntry[]>;
  createPriceEntry(entry: InsertPriceEntry): Promise<PriceEntry>;
  deletePriceEntry(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Settings
  async getSetting(key: string): Promise<string | null> {
    const rows = await db.select().from(settings).where(eq(settings.key, key));
    return rows[0]?.value ?? null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    const rows = await db.select().from(settings).where(eq(settings.key, key));
    if (rows.length > 0) {
      await db.update(settings).set({ value }).where(eq(settings.key, key));
    } else {
      await db.insert(settings).values({ key, value });
    }
  }

  // Stores
  async getStores(): Promise<Store[]> {
    return db.select().from(stores);
  }

  async getStore(id: number): Promise<Store | undefined> {
    const rows = await db.select().from(stores).where(eq(stores.id, id));
    return rows[0];
  }

  async createStore(store: InsertStore): Promise<Store> {
    const rows = await db.insert(stores).values(store).returning();
    return rows[0];
  }

  async updateStore(id: number, data: Partial<InsertStore>): Promise<Store> {
    const rows = await db.update(stores).set(data).where(eq(stores.id, id)).returning();
    return rows[0];
  }

  async deleteStore(id: number): Promise<void> {
    await db.delete(stores).where(eq(stores.id, id));
    await db.delete(collectedPrices).where(eq(collectedPrices.storeId, id));
    // Legacy cleanup
    await db.delete(priceEntries).where(eq(priceEntries.storeId, id));
  }

  // Products
  async getProducts(options?: { chain?: string; category?: string; search?: string; limit?: number; offset?: number }): Promise<Product[]> {
    let query = db.select().from(products);
    const conditions = [];
    if (options?.chain) conditions.push(eq(products.chain, options.chain));
    if (options?.category) conditions.push(eq(products.category, options.category));
    if (options?.search) {
      conditions.push(like(products.name, `%${options.search}%`));
    }
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    query = query.orderBy(products.name) as any;
    if (options?.limit) query = query.limit(options.limit) as any;
    if (options?.offset) query = query.offset(options.offset) as any;
    return query;
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const rows = await db.select().from(products).where(eq(products.id, id));
    return rows[0];
  }

  async getProductCount(options?: { chain?: string; category?: string; search?: string }): Promise<number> {
    const conditions = [];
    if (options?.chain) conditions.push(eq(products.chain, options.chain));
    if (options?.category) conditions.push(eq(products.category, options.category));
    if (options?.search) conditions.push(like(products.name, `%${options.search}%`));

    const result = await db.select({ count: sql<number>`count(*)` }).from(products)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    return result[0]?.count ?? 0;
  }

  async upsertProduct(product: InsertProduct): Promise<Product> {
    // Try to find existing by name + chain + size
    const existing = await db.select().from(products)
      .where(and(
        eq(products.name, product.name),
        eq(products.chain, product.chain),
        product.size ? eq(products.size, product.size) : sql`${products.size} IS NULL`
      ));

    if (existing.length > 0) {
      const rows = await db.update(products)
        .set({ ...product, id: undefined })
        .where(eq(products.id, existing[0].id))
        .returning();
      return rows[0];
    }
    const rows = await db.insert(products).values(product).returning();
    return rows[0];
  }

  async bulkUpsertProducts(productList: InsertProduct[]): Promise<number> {
    let count = 0;
    for (const p of productList) {
      await this.upsertProduct(p);
      count++;
    }
    return count;
  }

  // Collected Prices
  async getLatestPrices(productId: number): Promise<CollectedPrice[]> {
    return db.select().from(collectedPrices)
      .where(eq(collectedPrices.productId, productId))
      .orderBy(desc(collectedPrices.date));
  }

  async getLatestPricesForProducts(productIds: number[], storeIds?: number[]): Promise<CollectedPrice[]> {
    if (productIds.length === 0) return [];
    const conditions = [
      sql`${collectedPrices.productId} IN (${sql.join(productIds.map(id => sql`${id}`), sql`,`)})`,
    ];
    if (storeIds && storeIds.length > 0) {
      conditions.push(
        sql`${collectedPrices.storeId} IN (${sql.join(storeIds.map(id => sql`${id}`), sql`,`)})`
      );
    }
    return db.select().from(collectedPrices)
      .where(and(...conditions))
      .orderBy(desc(collectedPrices.date));
  }

  async createCollectedPrice(price: InsertCollectedPrice): Promise<CollectedPrice> {
    const rows = await db.insert(collectedPrices).values(price).returning();
    return rows[0];
  }

  async bulkCreateCollectedPrices(prices: InsertCollectedPrice[]): Promise<number> {
    if (prices.length === 0) return 0;
    // Batch insert in chunks of 100
    let count = 0;
    for (let i = 0; i < prices.length; i += 100) {
      const chunk = prices.slice(i, i + 100);
      await db.insert(collectedPrices).values(chunk);
      count += chunk.length;
    }
    return count;
  }

  async cleanOldPrices(keepDays: number): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - keepDays);
    const cutoffStr = cutoff.toISOString().split("T")[0];
    const result = await db.delete(collectedPrices)
      .where(sql`${collectedPrices.date} < ${cutoffStr}`);
    return (result as any).changes ?? 0;
  }

  // Watchlist
  async getWatchlist(): Promise<WatchlistItem[]> {
    return db.select().from(watchlist);
  }

  async createWatchlistItem(item: InsertWatchlistItem): Promise<WatchlistItem> {
    const rows = await db.insert(watchlist).values(item).returning();
    return rows[0];
  }

  async deleteWatchlistItem(id: number): Promise<void> {
    await db.delete(watchlist).where(eq(watchlist.id, id));
    await db.delete(priceAlerts).where(eq(priceAlerts.watchlistId, id));
  }

  // Price Alerts
  async getPriceAlerts(): Promise<PriceAlert[]> {
    return db.select().from(priceAlerts);
  }

  async getPriceAlertsByWatchlistItem(watchlistId: number): Promise<PriceAlert[]> {
    return db.select().from(priceAlerts).where(eq(priceAlerts.watchlistId, watchlistId));
  }

  async createPriceAlert(alert: InsertPriceAlert): Promise<PriceAlert> {
    const rows = await db.insert(priceAlerts).values(alert).returning();
    return rows[0];
  }

  async updatePriceAlert(id: number, data: Partial<InsertPriceAlert & { lastTriggered: string | null }>): Promise<PriceAlert> {
    const updates: any = {};
    if (data.targetPrice !== undefined) updates.targetPrice = data.targetPrice;
    if (data.active !== undefined) updates.active = data.active;
    if (data.lastTriggered !== undefined) updates.lastTriggered = data.lastTriggered;
    if (data.watchlistId !== undefined) updates.watchlistId = data.watchlistId;
    const rows = await db.update(priceAlerts).set(updates).where(eq(priceAlerts.id, id)).returning();
    return rows[0];
  }

  async deletePriceAlert(id: number): Promise<void> {
    await db.delete(priceAlerts).where(eq(priceAlerts.id, id));
  }

  // Collector Runs
  async createCollectorRun(run: InsertCollectorRun): Promise<CollectorRun> {
    const rows = await db.insert(collectorRuns).values(run).returning();
    return rows[0];
  }

  async updateCollectorRun(id: number, data: Partial<InsertCollectorRun>): Promise<CollectorRun> {
    const rows = await db.update(collectorRuns).set(data).where(eq(collectorRuns.id, id)).returning();
    return rows[0];
  }

  async getLatestCollectorRuns(): Promise<CollectorRun[]> {
    return db.select().from(collectorRuns).orderBy(desc(collectorRuns.startedAt)).limit(20);
  }

  // ---- Legacy methods (kept for backwards compatibility) ----
  async getItems(): Promise<Item[]> {
    return db.select().from(items);
  }

  async getItem(id: number): Promise<Item | undefined> {
    const rows = await db.select().from(items).where(eq(items.id, id));
    return rows[0];
  }

  async createItem(item: InsertItem): Promise<Item> {
    const rows = await db.insert(items).values(item).returning();
    return rows[0];
  }

  async updateItem(id: number, data: Partial<InsertItem>): Promise<Item> {
    const updates: any = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.category !== undefined) updates.category = data.category;
    if (data.tags !== undefined) updates.tags = data.tags;
    if (data.defaultUnit !== undefined) updates.defaultUnit = data.defaultUnit;
    const rows = await db.update(items).set(updates).where(eq(items.id, id)).returning();
    return rows[0];
  }

  async deleteItem(id: number): Promise<void> {
    await db.delete(items).where(eq(items.id, id));
    await db.delete(priceEntries).where(eq(priceEntries.itemId, id));
  }

  async getPriceEntries(): Promise<PriceEntry[]> {
    return db.select().from(priceEntries).orderBy(desc(priceEntries.date));
  }

  async getPriceEntriesByItem(itemId: number): Promise<PriceEntry[]> {
    return db.select().from(priceEntries)
      .where(eq(priceEntries.itemId, itemId))
      .orderBy(desc(priceEntries.date));
  }

  async createPriceEntry(entry: InsertPriceEntry): Promise<PriceEntry> {
    const rows = await db.insert(priceEntries).values(entry).returning();
    return rows[0];
  }

  async deletePriceEntry(id: number): Promise<void> {
    await db.delete(priceEntries).where(eq(priceEntries.id, id));
  }
}

export const storage = new DatabaseStorage();
