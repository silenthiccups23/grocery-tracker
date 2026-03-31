// Geocoding & Store Search Helpers

export interface FoundStore {
  name: string;
  address: string;
  lat: number;
  lon: number;
}

// Major US grocery chains with 10+ stores nationwide.
// Matches against store name OR OSM brand tag (case-insensitive, partial match).
const CHAIN_KEYWORDS: string[] = [
  // Big-box / wholesale
  "walmart", "target", "costco", "sam's club", "bj's wholesale",
  // Major supermarket chains
  "kroger", "ralphs", "fry's", "fred meyer", "king soopers", "smith's",
  "albertsons", "safeway", "vons", "pavilions", "jewel-osco", "acme",
  "shaw's", "star market", "randalls", "tom thumb",
  "publix", "h-e-b", "heb", "meijer", "hy-vee",
  "stop & shop", "giant", "giant eagle", "food lion", "hannaford",
  "harris teeter", "wegmans", "market basket",
  // Value / discount
  "aldi", "lidl", "food 4 less", "grocery outlet", "save-a-lot",
  "winco", "price chopper", "shoprite", "price rite", "piggly wiggly",
  "food bazaar", "food city", "stater bros",
  // Natural / specialty
  "whole foods", "trader joe's", "sprouts", "natural grocers",
  "fresh market", "earth fare", "fresh thyme",
  // Warehouse / smart
  "smart & final", "restaurant depot",
  // Asian / international chains (10+ US locations)
  "h mart", "99 ranch", "mitsuwa", "marukai", "tokyo central",
  "ranch 99", "seafood city", "cardenas", "el super",
  "fiesta mart", "northgate", "vallarta",
  // Other large chains
  "winn-dixie", "bi-lo", "ingles", "harveys",
  "lucky", "nob hill", "raley's", "bel air",
  "gelson's", "bristol farms",
];

function isChainStore(name: string, brand: string): boolean {
  const lower = `${name} ${brand}`.toLowerCase();
  return CHAIN_KEYWORDS.some(kw => lower.includes(kw));
}

export async function geocodeZip(zip: string): Promise<{ lat: number; lon: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(zip)}&country=US&format=json&limit=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": "GroceryTracker/1.0 (student-project)" },
  });
  if (!res.ok) return null;
  const data = await res.json() as any[];
  if (!data || data.length === 0) return null;
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}

export async function searchStoresNearby(lat: number, lon: number, radiusMiles: number): Promise<FoundStore[]> {
  const radiusMeters = Math.round(radiusMiles * 1609.34);
  const query = `[out:json][timeout:25];(nwr["shop"="supermarket"](around:${radiusMeters},${lat},${lon});nwr["shop"="wholesale"](around:${radiusMeters},${lat},${lon}););out center;`;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) throw new Error("Store search service unavailable. Please try again.");
  const data = await res.json() as any;
  const elements: any[] = data.elements || [];

  const results: FoundStore[] = [];

  for (const el of elements) {
    const tags = el.tags || {};
    const name = tags.name || tags.brand || "Unknown Store";
    const brand = tags.brand || "";
    const elLat = el.lat ?? el.center?.lat;
    const elLon = el.lon ?? el.center?.lon;
    if (!elLat || !elLon) continue;

    // Only include recognized chain stores (10+ locations)
    if (!isChainStore(name, brand)) continue;

    // Build address from OSM tags only (no slow reverse geocoding)
    let address = "";
    const num = tags["addr:housenumber"] || "";
    const street = tags["addr:street"] || "";
    const city = tags["addr:city"] || "";
    const state = tags["addr:state"] || "";
    const postcode = tags["addr:postcode"] || "";
    if (street) {
      const parts: string[] = [];
      parts.push(num ? `${num} ${street}` : street);
      if (city) parts.push(city);
      if (state) parts.push(state);
      if (postcode) parts.push(postcode);
      address = parts.join(", ");
    }

    results.push({ name, address, lat: elLat, lon: elLon });
  }

  // Deduplicate by name+address (OSM sometimes has duplicate entries)
  const seen = new Set<string>();
  return results.filter(s => {
    const key = `${s.name.toLowerCase()}|${s.address.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
