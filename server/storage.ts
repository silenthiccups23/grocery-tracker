import {
  type Store, type InsertStore, stores,
  type Item, type InsertItem, items,
  type PriceEntry, type InsertPriceEntry, priceEntries,
  settings,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, and, desc } from "drizzle-orm";

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite);

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
    const row = db.select().from(settings).where(eq(settings.key, key)).get();
    return row?.value ?? null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    // Upsert
    const existing = db.select().from(settings).where(eq(settings.key, key)).get();
    if (existing) {
      db.update(settings).set({ value }).where(eq(settings.key, key)).run();
    } else {
      db.insert(settings).values({ key, value }).run();
    }
  }

  // Stores
  async getStores(): Promise<Store[]> {
    return db.select().from(stores).all();
  }

  async getStore(id: number): Promise<Store | undefined> {
    return db.select().from(stores).where(eq(stores.id, id)).get();
  }

  async createStore(store: InsertStore): Promise<Store> {
    return db.insert(stores).values(store).returning().get();
  }

  async updateStore(id: number, data: { location: string | null; address: string | null }): Promise<Store> {
    return db.update(stores)
      .set({ location: data.location, address: data.address })
      .where(eq(stores.id, id))
      .returning()
      .get();
  }

  async deleteStore(id: number): Promise<void> {
    db.delete(stores).where(eq(stores.id, id)).run();
    // Also delete related price entries
    db.delete(priceEntries).where(eq(priceEntries.storeId, id)).run();
  }

  // Items
  async getItems(): Promise<Item[]> {
    return db.select().from(items).all();
  }

  async getItem(id: number): Promise<Item | undefined> {
    return db.select().from(items).where(eq(items.id, id)).get();
  }

  async createItem(item: InsertItem): Promise<Item> {
    return db.insert(items).values(item).returning().get();
  }

  async updateItem(id: number, data: { name?: string; category?: string | null; tags?: string | null; defaultUnit?: string | null }): Promise<Item> {
    const updates: any = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.category !== undefined) updates.category = data.category;
    if (data.tags !== undefined) updates.tags = data.tags;
    if (data.defaultUnit !== undefined) updates.defaultUnit = data.defaultUnit;
    return db.update(items).set(updates).where(eq(items.id, id)).returning().get();
  }

  async deleteItem(id: number): Promise<void> {
    db.delete(items).where(eq(items.id, id)).run();
    // Also delete related price entries
    db.delete(priceEntries).where(eq(priceEntries.itemId, id)).run();
  }

  // Price Entries
  async getPriceEntries(): Promise<PriceEntry[]> {
    return db.select().from(priceEntries).orderBy(desc(priceEntries.date)).all();
  }

  async getPriceEntriesByItem(itemId: number): Promise<PriceEntry[]> {
    return db.select().from(priceEntries)
      .where(eq(priceEntries.itemId, itemId))
      .orderBy(desc(priceEntries.date))
      .all();
  }

  async createPriceEntry(entry: InsertPriceEntry): Promise<PriceEntry> {
    return db.insert(priceEntries).values(entry).returning().get();
  }

  async deletePriceEntry(id: number): Promise<void> {
    db.delete(priceEntries).where(eq(priceEntries.id, id)).run();
  }
}

export const storage = new DatabaseStorage();
