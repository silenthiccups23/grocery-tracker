/**
 * Kroger API Client
 * 
 * Provides real-time grocery product prices from Kroger-family stores
 * (Kroger, Ralphs, Vons, Albertsons, etc. — though Kroger API specifically
 * covers Kroger-owned banners).
 * 
 * Free tier: 10,000 product API calls/day, 1,600 location API calls/day.
 * Register at https://developer.kroger.com to get client_id and client_secret.
 */

const KROGER_API_BASE = "https://api.kroger.com/v1";
const KROGER_TOKEN_URL = "https://api.kroger.com/v1/connect/oauth2/token";
const KROGER_PRODUCT_BASE = "https://www.kroger.com";

// In-memory credential + token storage
// Credentials are loaded from environment variables (KROGER_CLIENT_ID, KROGER_CLIENT_SECRET)
// or can be set manually via setKrogerCredentials()
let krogerClientId = process.env.KROGER_CLIENT_ID || "";
let krogerClientSecret = process.env.KROGER_CLIENT_SECRET || "";
let accessToken = "";
let tokenExpiry = 0;

export function setKrogerCredentials(clientId: string, clientSecret: string) {
  krogerClientId = clientId;
  krogerClientSecret = clientSecret;
  accessToken = "";
  tokenExpiry = 0;
}

export function getKrogerCredentials() {
  return { clientId: krogerClientId, clientSecret: krogerClientSecret };
}

export function hasKrogerCredentials(): boolean {
  return !!(krogerClientId && krogerClientSecret);
}

// Get OAuth access token using client credentials grant
async function getAccessToken(): Promise<string> {
  if (accessToken && Date.now() < tokenExpiry) {
    return accessToken;
  }
  if (!krogerClientId || !krogerClientSecret) {
    throw new Error("Kroger API credentials not configured. Go to Settings to add them.");
  }

  const credentials = Buffer.from(`${krogerClientId}:${krogerClientSecret}`).toString("base64");
  const res = await fetch(KROGER_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${credentials}`,
    },
    body: "grant_type=client_credentials&scope=product.compact",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to authenticate with Kroger API: ${body}`);
  }

  const data = await res.json() as any;
  accessToken = data.access_token;
  // Token usually lasts 1800 seconds (30 min); refresh 60s early
  tokenExpiry = Date.now() + ((data.expires_in || 1800) - 60) * 1000;
  return accessToken;
}

// --- Location API ---

export interface KrogerLocation {
  locationId: string;
  name: string;
  chain: string;
  address: {
    addressLine1: string;
    city: string;
    state: string;
    zipCode: string;
  };
}

export async function searchLocations(zipCode: string, radiusMiles: number = 10): Promise<KrogerLocation[]> {
  const token = await getAccessToken();
  const url = `${KROGER_API_BASE}/locations?filter.zipCode.near=${zipCode}&filter.radiusInMiles=${radiusMiles}&filter.limit=10`;
  const res = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Kroger location search failed: ${res.status}`);
  }
  const data = await res.json() as any;
  return (data.data || []).map((loc: any) => ({
    locationId: loc.locationId,
    name: loc.name,
    chain: loc.chain,
    address: {
      addressLine1: loc.address?.addressLine1 || "",
      city: loc.address?.city || "",
      state: loc.address?.state || "",
      zipCode: loc.address?.zipCode || "",
    },
  }));
}

// --- Product API ---

export interface KrogerProduct {
  productId: string;
  upc: string;
  brand: string;
  description: string;
  category: string;
  size: string;
  price: number | null;
  promoPrice: number | null;
  inStock: boolean;
  imageUrl: string;
  productUrl: string;
}

export async function searchProducts(
  term: string,
  locationId?: string,
  limit: number = 10
): Promise<KrogerProduct[]> {
  const token = await getAccessToken();
  let url = `${KROGER_API_BASE}/products?filter.term=${encodeURIComponent(term)}&filter.limit=${limit}`;
  if (locationId) {
    url += `&filter.locationId=${locationId}`;
  }

  const res = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Kroger product search failed: ${res.status} - ${body}`);
  }

  const data = await res.json() as any;
  return (data.data || []).map((product: any) => {
    const item = product.items?.[0] || {};
    const price = item.price || {};
    const images = product.images || [];
    const frontImage = images.find((img: any) => img.perspective === "front") || images[0] || {};
    const imageUrl = frontImage?.sizes?.find((s: any) => s.size === "medium")?.url
      || frontImage?.sizes?.find((s: any) => s.size === "small")?.url
      || "";

    return {
      productId: product.productId || "",
      upc: product.upc || "",
      brand: product.brand || "",
      description: product.description || "",
      category: (product.categories || [])[0] || "",
      size: item.size || "",
      price: price.regular || null,
      promoPrice: price.promo || null,
      inStock: item.inventory?.stockLevel !== "TEMPORARILY_OUT_OF_STOCK",
      imageUrl,
      productUrl: product.productPageURI
        ? `${KROGER_PRODUCT_BASE}${product.productPageURI}`
        : "",
    };
  });
}

// --- Fetch prices for an item at a specific store ---

export async function fetchPricesForItem(
  searchTerm: string,
  locationId: string,
  limit: number = 5
): Promise<KrogerProduct[]> {
  return searchProducts(searchTerm, locationId, limit);
}
