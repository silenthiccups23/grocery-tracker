/**
 * Kroger Collector
 * 
 * Uses the Kroger API (free) to collect products from multiple Kroger-family locations.
 * Each location (Ralphs, Food 4 Less, etc.) may have different prices for the same product.
 * 
 * Strategy:
 *   1. Find all Kroger locations near the user's zip code
 *   2. For each location, search common product terms across categories
 *   3. Return products tagged with which store they came from
 *   4. The main runner maps these to the user's stores in the database
 */

import type { Browser } from "playwright";
import type { StoreCollector, CollectorResult, CollectedProduct } from "./types.js";

const KROGER_API_BASE = "https://api.kroger.com/v1";

// Common grocery search terms organized by category
const CATEGORY_SEARCHES: Record<string, string[]> = {
  Dairy: [
    "milk", "whole milk", "2% milk", "oat milk", "almond milk",
    "eggs", "large eggs", "cheese", "shredded cheese", "cream cheese",
    "yogurt", "greek yogurt", "butter", "sour cream", "cottage cheese",
    "heavy cream", "half and half", "coffee creamer",
  ],
  Produce: [
    "bananas", "apples", "oranges", "strawberries", "blueberries", "grapes",
    "avocado", "tomatoes", "onions", "potatoes", "lettuce", "spinach",
    "broccoli", "carrots", "bell pepper", "garlic", "lemons", "limes",
    "cilantro", "celery", "cucumber", "mushrooms", "corn",
  ],
  Meat: [
    "chicken breast", "chicken thighs", "ground beef", "ground turkey",
    "steak", "pork chops", "bacon", "sausage", "hot dogs",
    "salmon", "shrimp", "tilapia", "deli turkey", "deli ham",
    "whole chicken", "ribs",
  ],
  Bakery: [
    "bread", "whole wheat bread", "tortillas", "hamburger buns",
    "hot dog buns", "bagels", "english muffins", "croissants",
    "rolls", "pita bread", "sourdough",
  ],
  Frozen: [
    "frozen pizza", "ice cream", "frozen vegetables", "frozen fruit",
    "frozen chicken", "frozen waffles", "frozen burritos",
    "frozen fish", "frozen meals", "frozen fries",
  ],
  Beverages: [
    "water", "orange juice", "apple juice", "soda", "coca cola", "pepsi",
    "coffee", "tea", "sports drink", "energy drink",
    "sparkling water", "lemonade",
  ],
  Snacks: [
    "chips", "crackers", "cookies", "nuts", "popcorn", "pretzels",
    "granola bars", "trail mix", "dried fruit", "rice cakes",
  ],
  Pantry: [
    "cereal", "oatmeal", "pasta", "rice", "beans", "canned tomatoes",
    "soup", "broth", "pasta sauce", "olive oil", "peanut butter",
    "flour", "sugar", "honey", "jelly", "ketchup", "mustard",
    "salt", "pepper", "spices",
  ],
  Household: [
    "paper towels", "toilet paper", "trash bags", "dish soap",
    "laundry detergent", "all purpose cleaner", "sponges",
    "aluminum foil", "plastic wrap", "zip bags",
  ],
};

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

  if (!res.ok) throw new Error(`Kroger auth failed: ${res.status}`);

  const data = (await res.json()) as any;
  accessToken = data.access_token;
  tokenExpiry = Date.now() + ((data.expires_in || 1800) - 60) * 1000;
  return accessToken;
}

async function searchLocations(zipCode: string): Promise<Array<{ locationId: string; name: string; chain: string }>> {
  const token = await getAccessToken();
  const res = await fetch(
    `${KROGER_API_BASE}/locations?filter.zipCode.near=${zipCode}&filter.radiusInMiles=25&filter.limit=20`,
    { headers: { Accept: "application/json", Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`Location search failed: ${res.status}`);
  const data = (await res.json()) as any;
  return (data.data || []).map((loc: any) => ({
    locationId: loc.locationId,
    name: loc.name,
    chain: loc.chain,
  }));
}

async function searchProducts(term: string, locationId: string, limit: number = 10): Promise<any[]> {
  const token = await getAccessToken();
  const res = await fetch(
    `${KROGER_API_BASE}/products?filter.term=${encodeURIComponent(term)}&filter.locationId=${locationId}&filter.limit=${limit}`,
    { headers: { Accept: "application/json", Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return [];
  const data = (await res.json()) as any;
  return data.data || [];
}

function parseApiProduct(apiProduct: any, category: string, storeName: string): CollectedProduct | null {
  const item = apiProduct.items?.[0];
  if (!item) return null;

  const price = item.price?.regular || item.price?.promo || null;
  if (!price || price <= 0) return null;

  const name = apiProduct.description || "";
  if (!name) return null;

  const brand = apiProduct.brand || null;
  const sizeStr = item.size || "";
  const imageUrl = apiProduct.images?.[0]?.sizes?.find((s: any) => s.size === "medium")?.url
    || apiProduct.images?.[0]?.sizes?.[0]?.url || null;
  const promoPrice = item.price?.promo && item.price.promo > 0 && item.price.promo < price
    ? item.price.promo : undefined;

  return {
    name,
    brand,
    category,
    size: sizeStr || undefined,
    imageUrl: imageUrl || undefined,
    price: promoPrice || price,
    promoPrice: promoPrice,
    storeProductUrl: `https://www.kroger.com/p/${apiProduct.productId}`,
    storeName,
  };
}

// Maps store names to Kroger chain identifiers
const KROGER_CHAIN_MAP: Record<string, string[]> = {
  "Ralphs": ["RALPHS"],
  "Food 4 Less": ["FOOD4LESS", "FOOD 4 LESS"],
  "Kroger": ["KROGER"],
  "Fry's": ["FRYS", "FRY'S"],
  "Fred Meyer": ["FRED MEYER", "FREDMEYER"],
  "King Soopers": ["KING SOOPERS"],
  "Smith's": ["SMITHS", "SMITH'S"],
};

export class KrogerCollector implements StoreCollector {
  chain = "kroger";
  name = "Kroger";
  private locations: Array<{ locationId: string; name: string; chain: string; storeName: string }> = [];
  private zipCode = "";

  async init(options: { browser?: Browser; zipCode: string }) {
    this.zipCode = options.zipCode;

    console.log(`   Finding Kroger locations near ${this.zipCode}...`);
    const allLocations = await searchLocations(this.zipCode);
    if (allLocations.length === 0) {
      throw new Error("No Kroger locations found nearby");
    }

    // Find one location per chain type (Ralphs, Food 4 Less, etc.)
    const seenChains = new Set<string>();
    for (const loc of allLocations) {
      const chainUpper = loc.chain.toUpperCase();
      // Map to a friendly store name
      let storeName = loc.chain;
      for (const [friendly, matchers] of Object.entries(KROGER_CHAIN_MAP)) {
        if (matchers.some(m => chainUpper.includes(m))) {
          storeName = friendly;
          break;
        }
      }

      if (!seenChains.has(storeName)) {
        seenChains.add(storeName);
        this.locations.push({ ...loc, storeName });
        console.log(`   📍 ${storeName}: ${loc.name} (${loc.chain})`);
      }
    }

    console.log(`   Using ${this.locations.length} location(s)`);
  }

  async collectAll(): Promise<CollectorResult> {
    const allProducts: CollectedProduct[] = [];
    const errors: string[] = [];

    const categories = Object.entries(CATEGORY_SEARCHES);
    const totalSearches = categories.reduce((sum, [, terms]) => sum + terms.length, 0);

    // Collect from each location separately
    for (const location of this.locations) {
      console.log(`\n   🏪 Collecting from ${location.storeName}...`);
      const seen = new Set<string>();
      let completed = 0;
      let locationProducts = 0;

      for (const [category, searchTerms] of categories) {
        for (const term of searchTerms) {
          try {
            const apiProducts = await searchProducts(term, location.locationId, 10);

            for (const ap of apiProducts) {
              const parsed = parseApiProduct(ap, category, location.storeName);
              if (parsed && !seen.has(parsed.name.toLowerCase())) {
                seen.add(parsed.name.toLowerCase());
                allProducts.push(parsed);
                locationProducts++;
              }
            }
          } catch (err: any) {
            errors.push(`${location.storeName}/${category}/${term}: ${err.message}`);
          }

          completed++;
          process.stdout.write(`\r   Progress: ${completed}/${totalSearches} searches, ${locationProducts} products`);

          await new Promise(r => setTimeout(r, 150));
        }
      }

      console.log(`\r   ${location.storeName}: ${locationProducts} products found${" ".repeat(20)}`);
    }

    return { chain: this.chain, products: allProducts, errors };
  }

  async cleanup() {
    // Nothing to clean up for API-based collector
  }
}
