/**
 * Albertsons/Vons Collector (Playwright-based)
 * 
 * Browses Albertsons-family store category pages via headless Chrome.
 * Covers: Albertsons, Vons, Safeway, Pavilions, Jewel-Osco, Shaw's, Acme
 * 
 * IMPORTANT: This only works from a residential IP (home network / Raspberry Pi).
 * 
 * Strategy:
 *   1. Navigate to the Albertsons/Vons grocery browse pages
 *   2. Each category page shows ~40 products per page
 *   3. Extract product name, price, size, image from tiles
 *   4. Paginate through results
 * 
 * The Albertsons family sites share the same frontend code, so Vons and Safeway
 * use identical HTML structure. We use Vons URLs by default (Southern CA).
 */

import type { Browser, Page, BrowserContext } from "playwright";
import type { StoreCollector, CollectorResult, CollectedProduct } from "./types.js";

// Vons (Albertsons family) category URLs
// These use the same structure across all Albertsons banners
const CATEGORY_URLS: Array<{ category: string; subcategory: string; url: string }> = [
  // Dairy
  { category: "Dairy", subcategory: "Milk", url: "https://www.vons.com/shop/aisles/dairy/milk.html" },
  { category: "Dairy", subcategory: "Cheese", url: "https://www.vons.com/shop/aisles/dairy/cheese.html" },
  { category: "Dairy", subcategory: "Eggs", url: "https://www.vons.com/shop/aisles/dairy/eggs.html" },
  { category: "Dairy", subcategory: "Yogurt", url: "https://www.vons.com/shop/aisles/dairy/yogurt.html" },
  { category: "Dairy", subcategory: "Butter & Margarine", url: "https://www.vons.com/shop/aisles/dairy/butter-margarine.html" },
  // Meat & Seafood
  { category: "Meat", subcategory: "Beef", url: "https://www.vons.com/shop/aisles/meat-seafood/beef.html" },
  { category: "Meat", subcategory: "Chicken", url: "https://www.vons.com/shop/aisles/meat-seafood/chicken.html" },
  { category: "Meat", subcategory: "Pork", url: "https://www.vons.com/shop/aisles/meat-seafood/pork.html" },
  { category: "Meat", subcategory: "Seafood", url: "https://www.vons.com/shop/aisles/meat-seafood/seafood.html" },
  // Produce
  { category: "Produce", subcategory: "Fresh Fruit", url: "https://www.vons.com/shop/aisles/produce/fresh-fruit.html" },
  { category: "Produce", subcategory: "Fresh Vegetables", url: "https://www.vons.com/shop/aisles/produce/fresh-vegetables.html" },
  // Bakery
  { category: "Bakery", subcategory: "Bread", url: "https://www.vons.com/shop/aisles/bakery/bread.html" },
  { category: "Bakery", subcategory: "Tortillas & Wraps", url: "https://www.vons.com/shop/aisles/bakery/tortillas-wraps.html" },
  // Frozen
  { category: "Frozen", subcategory: "Frozen Meals", url: "https://www.vons.com/shop/aisles/frozen/frozen-meals.html" },
  { category: "Frozen", subcategory: "Ice Cream", url: "https://www.vons.com/shop/aisles/frozen/ice-cream.html" },
  { category: "Frozen", subcategory: "Frozen Pizza", url: "https://www.vons.com/shop/aisles/frozen/frozen-pizza.html" },
  // Beverages
  { category: "Beverages", subcategory: "Water", url: "https://www.vons.com/shop/aisles/beverages/water.html" },
  { category: "Beverages", subcategory: "Juice", url: "https://www.vons.com/shop/aisles/beverages/juice.html" },
  { category: "Beverages", subcategory: "Soda", url: "https://www.vons.com/shop/aisles/beverages/soda.html" },
  { category: "Beverages", subcategory: "Coffee", url: "https://www.vons.com/shop/aisles/beverages/coffee.html" },
  // Pantry
  { category: "Pantry", subcategory: "Cereal", url: "https://www.vons.com/shop/aisles/pantry/cereal.html" },
  { category: "Pantry", subcategory: "Pasta & Rice", url: "https://www.vons.com/shop/aisles/pantry/pasta-rice.html" },
  { category: "Pantry", subcategory: "Canned Goods", url: "https://www.vons.com/shop/aisles/pantry/canned-goods.html" },
  { category: "Pantry", subcategory: "Cooking Oil & Vinegar", url: "https://www.vons.com/shop/aisles/pantry/cooking-oil-vinegar.html" },
  // Snacks
  { category: "Snacks", subcategory: "Chips", url: "https://www.vons.com/shop/aisles/snacks/chips.html" },
  { category: "Snacks", subcategory: "Crackers", url: "https://www.vons.com/shop/aisles/snacks/crackers.html" },
  { category: "Snacks", subcategory: "Cookies", url: "https://www.vons.com/shop/aisles/snacks/cookies.html" },
  { category: "Snacks", subcategory: "Nuts & Seeds", url: "https://www.vons.com/shop/aisles/snacks/nuts-trail-mix.html" },
  // Household
  { category: "Household", subcategory: "Paper Products", url: "https://www.vons.com/shop/aisles/household/paper-products.html" },
  { category: "Household", subcategory: "Cleaning Supplies", url: "https://www.vons.com/shop/aisles/household/cleaning-supplies.html" },
  { category: "Household", subcategory: "Laundry", url: "https://www.vons.com/shop/aisles/household/laundry.html" },
];

export class AlbertsonsCollector implements StoreCollector {
  chain = "albertsons";
  name = "Albertsons/Vons";
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  async init(options: { browser?: Browser; zipCode: string }) {
    if (!options.browser) throw new Error("Albertsons collector requires Playwright browser");

    this.context = await options.browser.newContext({
      userAgent: "Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      viewport: { width: 1366, height: 768 },
      locale: "en-US",
    });
    this.page = await this.context.newPage();

    // Load the Vons homepage to set up cookies
    console.log("   Loading Vons...");
    await this.page.goto("https://www.vons.com", { waitUntil: "domcontentloaded", timeout: 30000 });
    await this.page.waitForTimeout(3000);
    console.log("   Vons loaded");
  }

  async collectAll(): Promise<CollectorResult> {
    const allProducts: CollectedProduct[] = [];
    const errors: string[] = [];
    const seen = new Set<string>();

    if (!this.page) throw new Error("Not initialized");

    for (const cat of CATEGORY_URLS) {
      console.log(`\n   📂 ${cat.category} > ${cat.subcategory}`);

      try {
        await this.page.goto(cat.url, { waitUntil: "domcontentloaded", timeout: 30000 });
        await this.page.waitForTimeout(3000);

        // Scroll to load more products
        for (let i = 0; i < 3; i++) {
          await this.page.evaluate(() => window.scrollBy(0, window.innerHeight));
          await this.page.waitForTimeout(1000);
        }

        // Extract products from Albertsons/Vons product tiles
        const products = await this.page.evaluate(() => {
          // Albertsons uses .product-item-inner tiles
          const tiles = document.querySelectorAll(".product-item-inner, .product-card, [data-qa='product-tile']");
          const results: Array<{
            name: string;
            price: string;
            size: string;
            image: string;
            link: string;
          }> = [];

          tiles.forEach(tile => {
            const nameEl = tile.querySelector(".product-title, .product-card__title, [data-qa='product-title']");
            const priceEl = tile.querySelector(".product-price, .product-card__price, [data-qa='product-price']");
            const sizeEl = tile.querySelector(".product-qty, .product-card__qty, [data-qa='product-size']");
            const imgEl = tile.querySelector("img") as HTMLImageElement;
            const linkEl = tile.querySelector("a[href*='/product-details']") as HTMLAnchorElement;

            if (nameEl && priceEl) {
              results.push({
                name: nameEl.textContent?.trim() || "",
                price: priceEl.textContent?.trim() || "",
                size: sizeEl?.textContent?.trim() || "",
                image: imgEl?.src || "",
                link: linkEl?.href || "",
              });
            }
          });

          return results;
        });

        for (const p of products) {
          if (!p.name || !p.price || seen.has(p.name.toLowerCase())) continue;
          seen.add(p.name.toLowerCase());

          let priceNum = 0;
          const priceMatch = p.price.match(/\$?([\d.]+)/);
          if (priceMatch) priceNum = parseFloat(priceMatch[1]);
          if (priceNum <= 0) continue;

          allProducts.push({
            name: p.name,
            category: cat.category,
            subcategory: cat.subcategory,
            size: p.size || undefined,
            imageUrl: p.image || undefined,
            storeProductUrl: p.link || undefined,
            price: priceNum,
          });
        }

        console.log(`      ${products.length} items on page, ${allProducts.length} total unique`);
      } catch (err: any) {
        errors.push(`${cat.category}/${cat.subcategory}: ${err.message}`);
        console.log(`      ❌ ${err.message}`);
      }

      // Polite delay
      await this.page.waitForTimeout(2000);
    }

    return { chain: this.chain, products: allProducts, errors };
  }

  async cleanup() {
    if (this.context) await this.context.close().catch(() => {});
    this.context = null;
    this.page = null;
  }
}
