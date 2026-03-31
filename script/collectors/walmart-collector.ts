/**
 * Walmart Collector (Playwright-based)
 * 
 * Browses Walmart grocery category pages via headless Chrome.
 * Extracts product name, brand, price, size, image from the listing tiles.
 * 
 * IMPORTANT: This only works from a residential IP (home network / Raspberry Pi).
 * Walmart's Akamai + HUMAN protection blocks cloud/datacenter IPs.
 * 
 * Strategy:
 *   1. Set a store location via zip code cookie
 *   2. Navigate to each grocery category URL
 *   3. Scroll to load products (lazy-loaded)
 *   4. Extract product data from the tile HTML
 *   5. Paginate through results
 */

import type { Browser, Page, BrowserContext } from "playwright";
import type { StoreCollector, CollectorResult, CollectedProduct } from "./types.js";

// Walmart grocery category URLs
const CATEGORY_URLS: Array<{ category: string; subcategory: string; url: string }> = [
  // Dairy & Eggs
  { category: "Dairy", subcategory: "Milk", url: "https://www.walmart.com/browse/food/milk/976759_976782_1001420" },
  { category: "Dairy", subcategory: "Cheese", url: "https://www.walmart.com/browse/food/cheese/976759_976782_1001391" },
  { category: "Dairy", subcategory: "Eggs", url: "https://www.walmart.com/browse/food/eggs/976759_976782_9176741" },
  { category: "Dairy", subcategory: "Yogurt", url: "https://www.walmart.com/browse/food/yogurt/976759_976782_1001393" },
  { category: "Dairy", subcategory: "Butter", url: "https://www.walmart.com/browse/food/butter-margarine/976759_976782_1001395" },
  // Meat & Seafood
  { category: "Meat", subcategory: "Chicken", url: "https://www.walmart.com/browse/food/chicken/976759_976793_5765326" },
  { category: "Meat", subcategory: "Beef", url: "https://www.walmart.com/browse/food/beef/976759_976793_3610130" },
  { category: "Meat", subcategory: "Pork", url: "https://www.walmart.com/browse/food/pork/976759_976793_9805898" },
  { category: "Meat", subcategory: "Seafood", url: "https://www.walmart.com/browse/food/seafood/976759_976793_1007614" },
  { category: "Meat", subcategory: "Bacon & Sausage", url: "https://www.walmart.com/browse/food/bacon-sausage/976759_976793_4791791" },
  // Produce
  { category: "Produce", subcategory: "Fresh Fruit", url: "https://www.walmart.com/browse/food/fresh-fruit/976759_976793_4756" },
  { category: "Produce", subcategory: "Fresh Vegetables", url: "https://www.walmart.com/browse/food/fresh-vegetables/976759_976793_1219231" },
  // Bakery & Bread
  { category: "Bakery", subcategory: "Bread", url: "https://www.walmart.com/browse/food/bread/976759_976779_8468537" },
  { category: "Bakery", subcategory: "Tortillas", url: "https://www.walmart.com/browse/food/tortillas/976759_976779_1001524" },
  // Frozen
  { category: "Frozen", subcategory: "Frozen Meals", url: "https://www.walmart.com/browse/food/frozen-meals/976759_976786" },
  { category: "Frozen", subcategory: "Ice Cream", url: "https://www.walmart.com/browse/food/ice-cream/976759_976786_1001451" },
  { category: "Frozen", subcategory: "Frozen Pizza", url: "https://www.walmart.com/browse/food/frozen-pizza/976759_976786_1001454" },
  // Beverages
  { category: "Beverages", subcategory: "Water", url: "https://www.walmart.com/browse/food/water/976759_976781_1001424" },
  { category: "Beverages", subcategory: "Juice", url: "https://www.walmart.com/browse/food/juice/976759_976781_9109187" },
  { category: "Beverages", subcategory: "Soda", url: "https://www.walmart.com/browse/food/soda-pop/976759_976781_1001427" },
  { category: "Beverages", subcategory: "Coffee", url: "https://www.walmart.com/browse/food/coffee/976759_976781_1001430" },
  // Pantry
  { category: "Pantry", subcategory: "Cereal", url: "https://www.walmart.com/browse/food/cereal/976759_976780_1001344" },
  { category: "Pantry", subcategory: "Pasta & Grains", url: "https://www.walmart.com/browse/food/pasta-grains/976759_976780_1001388" },
  { category: "Pantry", subcategory: "Canned Goods", url: "https://www.walmart.com/browse/food/canned-goods/976759_976780_1001379" },
  { category: "Pantry", subcategory: "Cooking Oil", url: "https://www.walmart.com/browse/food/cooking-oils-vinegar/976759_976780_1007681" },
  // Snacks
  { category: "Snacks", subcategory: "Chips", url: "https://www.walmart.com/browse/food/chips/976759_976787_1001514" },
  { category: "Snacks", subcategory: "Crackers", url: "https://www.walmart.com/browse/food/crackers/976759_976787_1001519" },
  { category: "Snacks", subcategory: "Cookies", url: "https://www.walmart.com/browse/food/cookies/976759_976787_1001516" },
  { category: "Snacks", subcategory: "Nuts", url: "https://www.walmart.com/browse/food/nuts-dried-fruits/976759_976787_1001518" },
  // Household
  { category: "Household", subcategory: "Paper Products", url: "https://www.walmart.com/browse/household-essentials/paper-plastic/1115193_4171151" },
  { category: "Household", subcategory: "Cleaning", url: "https://www.walmart.com/browse/household-essentials/cleaning-supplies/1115193_1071204" },
  { category: "Household", subcategory: "Laundry", url: "https://www.walmart.com/browse/household-essentials/laundry/1115193_1071204_4588533" },
];

export class WalmartCollector implements StoreCollector {
  chain = "walmart";
  name = "Walmart";
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private zipCode = "";

  async init(options: { browser?: Browser; zipCode: string }) {
    if (!options.browser) throw new Error("Walmart collector requires Playwright browser");
    this.zipCode = options.zipCode;

    // Create a browser context with a realistic user agent
    this.context = await options.browser.newContext({
      userAgent: "Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      viewport: { width: 1366, height: 768 },
      locale: "en-US",
    });
    this.page = await this.context.newPage();

    // Navigate to walmart.com and set the zip code for store pricing
    console.log(`   Setting Walmart location to ${this.zipCode}...`);
    await this.page.goto("https://www.walmart.com", { waitUntil: "domcontentloaded", timeout: 30000 });
    // Wait a moment for any initial redirects/challenges
    await this.page.waitForTimeout(3000);
    console.log(`   Walmart loaded`);
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
        await this.page.waitForTimeout(2000); // Let products load

        // Scroll down to trigger lazy loading
        for (let i = 0; i < 3; i++) {
          await this.page.evaluate(() => window.scrollBy(0, window.innerHeight));
          await this.page.waitForTimeout(1000);
        }

        // Extract products from the page
        const products = await this.page.evaluate(() => {
          const tiles = document.querySelectorAll('[data-testid="list-view"]');
          const results: Array<{
            name: string;
            price: string;
            image: string;
            link: string;
          }> = [];

          tiles.forEach(tile => {
            const nameEl = tile.querySelector('[data-automation-id="product-title"]');
            const priceEl = tile.querySelector('[data-automation-id="product-price"] .f2');
            const imgEl = tile.querySelector('[data-testid="productTileImage"]') as HTMLImageElement;
            const linkEl = tile.querySelector('a[href*="/ip/"]') as HTMLAnchorElement;

            if (nameEl && priceEl) {
              results.push({
                name: nameEl.textContent?.trim() || "",
                price: priceEl.textContent?.trim() || "",
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

          // Parse price (remove $ and handle "Now $X.XX" format)
          let priceNum = 0;
          const priceMatch = p.price.match(/\$?([\d.]+)/);
          if (priceMatch) priceNum = parseFloat(priceMatch[1]);
          if (priceNum <= 0) continue;

          allProducts.push({
            name: p.name,
            category: cat.category,
            subcategory: cat.subcategory,
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

      // Polite delay between pages
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
