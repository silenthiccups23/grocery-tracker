/**
 * Collector Plugin Interface
 * 
 * Each store chain implements this interface.
 * The main runner calls init() → collectAll() → cleanup() for each plugin.
 */

import type { Browser } from "playwright";

export interface CollectedProduct {
  name: string;
  brand?: string;
  category?: string;
  subcategory?: string;
  size?: string;          // raw size text e.g. "1 gal", "12 ct"
  sizeNum?: number;       // parsed numeric e.g. 128
  sizeUnit?: string;      // parsed unit e.g. "fl oz"
  imageUrl?: string;
  storeProductUrl?: string;
  price: number;
  promoPrice?: number;
}

export interface CollectorResult {
  chain: string;
  products: CollectedProduct[];
  errors: string[];
}

export interface StoreCollector {
  /** Which chain this collector handles */
  chain: string;
  
  /** Human-readable name */
  name: string;

  /** 
   * Initialize the collector. Called once before collectAll.
   * For Playwright-based collectors, receives a shared browser instance.
   * For API-based collectors, browser may be null.
   */
  init(options: { browser?: Browser; zipCode: string }): Promise<void>;

  /**
   * Collect ALL products across all categories.
   * Returns a flat list of products with prices.
   */
  collectAll(): Promise<CollectorResult>;

  /**
   * Clean up resources (close pages, etc.)
   */
  cleanup(): Promise<void>;
}
