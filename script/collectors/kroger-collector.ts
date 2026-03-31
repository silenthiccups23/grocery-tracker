/**
 * Kroger Collector
 * 
 * Uses the Kroger API (free) to collect products by category.
 * Covers: Kroger, Ralphs, Fry's, Fred Meyer, King Soopers, Smith's, Food 4 Less
 * 
 * Strategy:
 *   1. Find Kroger locations near the user's zip code
 *   2. For each grocery category, search for common products
 *   3. Extract product name, brand, price, size from the API response
 * 
 * The Kroger API doesn't have a "browse all" endpoint, so we search
 * by common product terms within each category.
 */

import type { Browser } from "playwright";
import type { StoreCollector, CollectorResult, CollectedProduct } from "./types.js";

const KROGER_API_BASE = "https://api.kroger.com/v1";

// Common grocery search terms organized by category.
// Each term returns ~10 products, giving us broad coverage.
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
    `${KROGER_API_BASE}/locations?filter.zipCode.near=${zipCode}&filter.radiusInMiles=25&filter.limit=10`,
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

function parseApiProduct(apiProduct: any, category: string): CollectedProduct | null {
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
  };
}

export class KrogerCollector implements StoreCollector {
  chain = "kroger";
  name = "Kroger";
  private locationId = "";
  private zipCode = "";

  async init(options: { browser?: Browser; zipCode: string }) {
    this.zipCode = options.zipCode;
    
    // Find nearest location
    console.log(`   Finding Kroger locations near ${this.zipCode}...`);
    const locations = await searchLocations(this.zipCode);
    if (locations.length === 0) {
      throw new Error("No Kroger locations found nearby");
    }
    this.locationId = locations[0].locationId;
    console.log(`   Using: ${locations[0].name} (${locations[0].chain})`);
  }

  async collectAll(): Promise<CollectorResult> {
    const allProducts: CollectedProduct[] = [];
    const errors: string[] = [];
    const seen = new Set<string>(); // deduplicate by name

    const categories = Object.entries(CATEGORY_SEARCHES);
    let totalSearches = categories.reduce((sum, [, terms]) => sum + terms.length, 0);
    let completed = 0;

    for (const [category, searchTerms] of categories) {
      console.log(`\n   📂 ${category} (${searchTerms.length} searches)`);

      for (const term of searchTerms) {
        try {
          const apiProducts = await searchProducts(term, this.locationId, 10);

          for (const ap of apiProducts) {
            const parsed = parseApiProduct(ap, category);
            if (parsed && !seen.has(parsed.name.toLowerCase())) {
              seen.add(parsed.name.toLowerCase());
              allProducts.push(parsed);
            }
          }
        } catch (err: any) {
          errors.push(`${category}/${term}: ${err.message}`);
        }

        completed++;
        process.stdout.write(`\r   Progress: ${completed}/${totalSearches} searches, ${allProducts.length} products found`);

        // Small delay to stay within rate limits
        await new Promise(r => setTimeout(r, 200));
      }
    }

    console.log(""); // newline after progress

    return { chain: this.chain, products: allProducts, errors };
  }

  async cleanup() {
    // Nothing to clean up for API-based collector
  }
}
