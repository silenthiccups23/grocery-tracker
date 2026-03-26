/**
 * Costco API Client (via RapidAPI — OpenWeb Ninja Real-Time Costco Data)
 *
 * Provides real-time product search and pricing from Costco US & Canada.
 * Free tier: 100 requests/month.
 *
 * Get a free RapidAPI key at:
 * https://rapidapi.com/letscrape-6bRBa3QguO5/api/real-time-costco-data
 */

const COSTCO_API_HOST = "real-time-costco-data.p.rapidapi.com";
const COSTCO_API_BASE = `https://${COSTCO_API_HOST}`;

let rapidApiKey = process.env.RAPIDAPI_KEY || "";

export function setRapidApiKey(key: string) {
  rapidApiKey = key;
}

export function getRapidApiKey(): string {
  return rapidApiKey;
}

export function hasRapidApiKey(): boolean {
  return !!rapidApiKey;
}

export interface CostcoProduct {
  itemNumber: string;
  name: string;
  brand: string;
  price: number | null;
  salePrice: number | null;
  size: string;
  imageUrl: string;
  inStock: boolean;
  rating: number | null;
  url: string;
}

/**
 * Search for products on Costco.
 * Returns up to 24 products per query.
 */
export async function searchCostcoProducts(
  query: string,
  country: string = "US"
): Promise<CostcoProduct[]> {
  if (!rapidApiKey) {
    throw new Error("RapidAPI key not configured. Go to Settings to add it.");
  }

  const url = `${COSTCO_API_BASE}/search?query=${encodeURIComponent(query)}&country=${country}`;
  const res = await fetch(url, {
    headers: {
      "X-RapidAPI-Key": rapidApiKey,
      "X-RapidAPI-Host": COSTCO_API_HOST,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Costco API search failed: ${res.status} - ${body}`);
  }

  const data = (await res.json()) as any;
  const products: any[] = data.products || [];

  return products.map((p: any) => {
    // Price fields vary depending on API response structure
    const listPrice = parseFloat(p.item_location_pricing_listPrice) || null;
    const salePrice = parseFloat(p.item_location_pricing_salePrice) || null;
    const price = salePrice || listPrice;

    return {
      itemNumber: p.item_number || "",
      name: p.item_product_name || p.productName || "",
      brand: Array.isArray(p.Brand_attr) ? p.Brand_attr[0] || "" : p.Brand_attr || "",
      price,
      salePrice: salePrice !== listPrice ? salePrice : null,
      size: p.item_product_size || "",
      imageUrl: p.item_collateral_primaryimage || "",
      inStock: p.deliveryStatus === "in stock" || p.inventoryAvailable === true,
      rating: parseFloat(p.item_ratings) || null,
      url: p.seoUrl
        ? `https://www.costco.com${p.seoUrl}`
        : p.item_number
          ? `https://www.costco.com/CatalogSearch?dept=All&keyword=${p.item_number}`
          : "",
    };
  });
}
