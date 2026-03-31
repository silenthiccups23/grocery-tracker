// Size parsing utilities for Kroger and Costco product data

// Units that are always measured in liquid volumes — bare "oz" should become "fl oz"
const LIQUID_UNITS = new Set(["fl oz", "gal", "L"]);
// Units that are always counts — ignore weight-based matches entirely
const COUNT_UNITS = new Set(["ct"]);

// Helper to parse Kroger's size strings like "1 gal", "1/2 Gallon", "64 fl oz"
// Uses the item's defaultUnit to disambiguate: if the item is a liquid (defaultUnit = "fl oz"),
// bare "oz" is treated as "fl oz". If the item is counted (defaultUnit = "ct"),
// weight-based matches (oz, lb) are skipped.
export function parseKrogerSize(sizeStr: string, defaultUnit: string | null): { size: number | null; unit: string | null } {
  if (!sizeStr) return { size: null, unit: defaultUnit };
  const s = sizeStr.toLowerCase().trim();
  const isLiquid = LIQUID_UNITS.has(defaultUnit || "");
  const isCount = COUNT_UNITS.has(defaultUnit || "");

  const patterns: Array<{ regex: RegExp; handler: (m: RegExpMatchArray) => { size: number; unit: string } | null }> = [
    { regex: /^(\d+\.?\d*)\s*gal/i, handler: m => ({ size: parseFloat(m[1]) * 128, unit: "fl oz" }) },
    { regex: /^1\/2\s*gal/i, handler: () => ({ size: 64, unit: "fl oz" }) },
    { regex: /^half\s*gal/i, handler: () => ({ size: 64, unit: "fl oz" }) },
    { regex: /^(\d+\.?\d*)\s*fl\.?\s*oz/i, handler: m => ({ size: parseFloat(m[1]), unit: "fl oz" }) },
    // Bare "oz": for liquids → fl oz; for count items → skip
    { regex: /^(\d+\.?\d*)\s*oz/i, handler: m => {
      if (isCount) return null; // skip oz for count-based items like eggs
      return { size: parseFloat(m[1]), unit: isLiquid ? "fl oz" : "oz" };
    }},
    // "lb": skip for liquids and count items
    { regex: /^(\d+\.?\d*)\s*lb/i, handler: m => {
      if (isLiquid || isCount) return null;
      return { size: parseFloat(m[1]), unit: "lb" };
    }},
    { regex: /^(\d+\.?\d*)\s*ct/i, handler: m => ({ size: parseFloat(m[1]), unit: "ct" }) },
    { regex: /^(\d+\.?\d*)\s*count/i, handler: m => ({ size: parseFloat(m[1]), unit: "ct" }) },
    { regex: /^(\d+\.?\d*)\s*l(?:iter)?/i, handler: m => ({ size: parseFloat(m[1]), unit: "L" }) },
  ];

  for (const { regex, handler } of patterns) {
    const match = s.match(regex);
    if (match) {
      const result = handler(match);
      if (result) return result;
    }
  }

  return { size: null, unit: defaultUnit };
}

// Helper to parse Costco size strings. Costco product names often include sizes like
// "Kirkland Signature Organic Whole Milk, 1 Gallon, 2-count"
// Same category-awareness as parseKrogerSize.
export function parseCostcoSize(sizeStr: string, defaultUnit: string | null): { size: number | null; unit: string | null } {
  if (!sizeStr) return { size: null, unit: defaultUnit };
  const s = sizeStr.toLowerCase();
  const isLiquid = LIQUID_UNITS.has(defaultUnit || "");
  const isCount = COUNT_UNITS.has(defaultUnit || "");

  const patterns: Array<{ regex: RegExp; handler: (m: RegExpMatchArray) => { size: number; unit: string } | null }> = [
    // "2 x 1 gallon", "2-count, 1 gallon" etc.
    { regex: /(\d+)\s*x\s*(\d+\.?\d*)\s*gal/i, handler: m => ({ size: parseInt(m[1]) * parseFloat(m[2]) * 128, unit: "fl oz" }) },
    { regex: /(\d+\.?\d*)\s*gal/i, handler: m => ({ size: parseFloat(m[1]) * 128, unit: "fl oz" }) },
    { regex: /half\s*gal/i, handler: () => ({ size: 64, unit: "fl oz" }) },
    { regex: /1\/2\s*gal/i, handler: () => ({ size: 64, unit: "fl oz" }) },
    { regex: /(\d+\.?\d*)\s*fl\.?\s*oz/i, handler: m => ({ size: parseFloat(m[1]), unit: "fl oz" }) },
    { regex: /(\d+\.?\d*)\s*oz/i, handler: m => {
      if (isCount) return null;
      return { size: parseFloat(m[1]), unit: isLiquid ? "fl oz" : "oz" };
    }},
    { regex: /(\d+\.?\d*)\s*lb/i, handler: m => {
      if (isLiquid || isCount) return null;
      return { size: parseFloat(m[1]), unit: "lb" };
    }},
    { regex: /(\d+\.?\d*)\s*ct|count/i, handler: m => ({ size: parseFloat(m[1]), unit: "ct" }) },
    { regex: /(\d+\.?\d*)\s*l(?:iter)?(?:s)?\b/i, handler: m => ({ size: parseFloat(m[1]), unit: "L" }) },
    { regex: /(\d+\.?\d*)\s*kg/i, handler: m => {
      if (isLiquid || isCount) return null;
      return { size: parseFloat(m[1]) * 2.205, unit: "lb" };
    }},
  ];

  for (const { regex, handler } of patterns) {
    const match = s.match(regex);
    if (match) {
      const result = handler(match);
      if (result) return result;
    }
  }

  return { size: null, unit: defaultUnit };
}

/**
 * Infer a reasonable default size for a product when the API doesn't provide one.
 * Based on common grocery product sizes.
 */
export function inferDefaultSize(productName: string, defaultUnit: string): { size: number | null; unit: string | null } {
  const lower = productName.toLowerCase();

  const defaults: Array<{ keywords: string[]; size: number; unit: string }> = [
    // Dairy liquids
    { keywords: ["milk"], size: 128, unit: "fl oz" },         // 1 gallon
    { keywords: ["cream", "creamer"], size: 32, unit: "fl oz" }, // 1 quart
    { keywords: ["yogurt"], size: 32, unit: "oz" },            // 32 oz tub
    // Eggs
    { keywords: ["eggs", "egg"], size: 12, unit: "ct" },       // 1 dozen
    // Cheese
    { keywords: ["cheese"], size: 8, unit: "oz" },             // 8 oz block/bag
    { keywords: ["butter"], size: 16, unit: "oz" },            // 1 lb
    // Produce
    { keywords: ["bananas", "banana"], size: 1, unit: "lb" },
    { keywords: ["apples", "apple"], size: 1, unit: "lb" },
    { keywords: ["oranges", "orange"], size: 1, unit: "lb" },
    { keywords: ["tomato"], size: 1, unit: "lb" },
    { keywords: ["potato"], size: 5, unit: "lb" },
    { keywords: ["onion"], size: 1, unit: "lb" },
    // Meat
    { keywords: ["chicken breast", "chicken thigh"], size: 1, unit: "lb" },
    { keywords: ["ground beef", "ground turkey"], size: 1, unit: "lb" },
    { keywords: ["steak"], size: 1, unit: "lb" },
    { keywords: ["bacon"], size: 16, unit: "oz" },
    { keywords: ["hot dog"], size: 8, unit: "ct" },
    { keywords: ["sausage"], size: 16, unit: "oz" },
    { keywords: ["salmon", "tilapia", "shrimp"], size: 1, unit: "lb" },
    // Bakery
    { keywords: ["bread"], size: 20, unit: "oz" },
    { keywords: ["tortilla"], size: 10, unit: "ct" },
    { keywords: ["bagel"], size: 6, unit: "ct" },
    { keywords: ["bun"], size: 8, unit: "ct" },
    // Beverages
    { keywords: ["water"], size: 128, unit: "fl oz" },         // 1 gallon
    { keywords: ["juice", "orange juice", "apple juice"], size: 64, unit: "fl oz" }, // half gallon
    { keywords: ["soda", "cola"], size: 144, unit: "fl oz" },  // 12-pack
    { keywords: ["coffee"], size: 12, unit: "oz" },
    // Pantry
    { keywords: ["rice"], size: 32, unit: "oz" },              // 2 lb bag
    { keywords: ["pasta", "spaghetti"], size: 16, unit: "oz" }, // 1 lb box
    { keywords: ["beans"], size: 15, unit: "oz" },             // standard can
    { keywords: ["cereal"], size: 18, unit: "oz" },
    { keywords: ["soup"], size: 10.75, unit: "oz" },           // standard can
    { keywords: ["peanut butter"], size: 16, unit: "oz" },
    { keywords: ["olive oil", "cooking oil"], size: 16, unit: "fl oz" },
    { keywords: ["flour"], size: 80, unit: "oz" },             // 5 lb
    { keywords: ["sugar"], size: 64, unit: "oz" },             // 4 lb
    // Snacks
    { keywords: ["chips"], size: 10, unit: "oz" },
    { keywords: ["crackers"], size: 8, unit: "oz" },
    { keywords: ["cookies"], size: 13, unit: "oz" },
    { keywords: ["popcorn"], size: 8, unit: "oz" },
    // Household
    { keywords: ["paper towel"], size: 6, unit: "ct" },
    { keywords: ["toilet paper"], size: 12, unit: "ct" },
    { keywords: ["trash bag"], size: 40, unit: "ct" },
    { keywords: ["dish soap"], size: 22, unit: "fl oz" },
    { keywords: ["detergent"], size: 100, unit: "fl oz" },
  ];

  for (const d of defaults) {
    if (d.keywords.some(kw => lower.includes(kw))) {
      return { size: d.size, unit: d.unit };
    }
  }

  return { size: null, unit: defaultUnit };
}
