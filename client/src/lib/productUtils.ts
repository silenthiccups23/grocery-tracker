/**
 * Clean up product names from the Kroger API.
 * 
 * Raw names look like:
 *   "100% COLOMBIAN COFFEE - KROGER - 11 OZ"
 *   "ALL FREE CLEAR Laundry Detergent"
 *   "ARM & HAMMER Plus OxiClean Fresh Scent Liquid Laundry Detergent"
 * 
 * This function converts to title case and removes redundant info.
 */
export function cleanProductName(name: string, brand?: string | null): string {
  let cleaned = name;

  // If the name is ALL CAPS (or mostly caps), convert to title case
  const upperCount = (cleaned.match(/[A-Z]/g) || []).length;
  const letterCount = (cleaned.match(/[a-zA-Z]/g) || []).length;
  if (letterCount > 0 && upperCount / letterCount > 0.6) {
    cleaned = toTitleCase(cleaned);
  }

  // Remove trailing size info like "- 11 OZ", "- 1 GAL", "- 12 CT"
  cleaned = cleaned.replace(/\s*-\s*\d+\.?\d*\s*(oz|fl oz|lb|ct|gal|l|ml|pt|qt|count|pack|pk)\s*$/i, "");

  // Remove trailing brand if it's redundant with the brand field
  // e.g. "100% Colombian Coffee - Kroger" when brand is "Kroger"
  if (brand) {
    const brandPattern = new RegExp(`\\s*-\\s*${escapeRegex(brand)}\\s*$`, "i");
    cleaned = cleaned.replace(brandPattern, "");
  }

  // Remove ® and ™ symbols
  cleaned = cleaned.replace(/[®™©]/g, "");

  // Clean up extra whitespace
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  // Remove leading "2# " or "3# " (weight prefixes from Kroger)
  cleaned = cleaned.replace(/^\d+#\s+/, "");

  return cleaned;
}

function toTitleCase(str: string): string {
  // Words that should stay lowercase (unless first word)
  const lowercaseWords = new Set(["a", "an", "the", "and", "but", "or", "for", "nor", "on", "at", "to", "by", "in", "of", "with"]);

  return str
    .toLowerCase()
    .split(/\s+/)
    .map((word, i) => {
      if (i === 0 || !lowercaseWords.has(word)) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
      return word;
    })
    .join(" ");
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Get the latest price per store from a list of price entries.
 * Deduplicates by storeId, keeping only the most recent date.
 */
export function getLatestPricePerStore(
  prices: Array<{ storeId: number; price: number; date: string; [key: string]: any }>
): Array<{ storeId: number; price: number; date: string; [key: string]: any }> {
  const latestByStore = new Map<number, typeof prices[0]>();

  for (const p of prices) {
    const existing = latestByStore.get(p.storeId);
    if (!existing || p.date > existing.date) {
      latestByStore.set(p.storeId, p);
    }
  }

  return Array.from(latestByStore.values());
}
