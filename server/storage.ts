import {
  type Store, type InsertStore, stores,
  type Item, type InsertItem, items,
  type PriceEntry, type InsertPriceEntry, priceEntries,
  settings,
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
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
  updateStore(id: number, data: { location: string | null; address: string | null }): Promise<Store>;
  deleteStore(id: number): Promise<void>;

  // Items
  getItems(): Promise<Item[]>;
  getItem(id: number): Promise<Item | undefined>;
  createItem(item: InsertItem): Promise<Item>;
  updateItem(id: number, data: { name?: string; category?: string | null; tags?: string | null; defaultUnit?: string | null }): Promise<Item>;
  deleteItem(id: number): Promise<void>;

  // Price Entries
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

  async updateStore(id: number, data: { location: string | null; address: string | null }): Promise<Store> {
    const rows = await db.update(stores)
      .set({ location: data.location, address: data.address })
      .where(eq(stores.id, id))
      .returning();
    return rows[0];
  }

  async deleteStore(id: number): Promise<void> {
    await db.delete(stores).where(eq(stores.id, id));
    await db.delete(priceEntries).where(eq(priceEntries.storeId, id));
  }

  // Items
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

  async updateItem(id: number, data: { name?: string; category?: string | null; tags?: string | null; defaultUnit?: string | null }): Promise<Item> {
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

  // Price Entries
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
