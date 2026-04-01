/**
 * Live Data Tests — verifies the real data collected by the Raspberry Pi
 * 
 * Tests the actual Turso database with 1,204+ products from Kroger/Ralphs.
 * Run with: npx tsx test/live-data.test.ts
 * Requires dev server on port 5000 connected to Turso.
 */

const BASE = "http://localhost:5000";
let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    failures.push(message);
    console.log(`  ❌ ${message}`);
  }
}

async function api(method: string, path: string) {
  const res = await fetch(`${BASE}${path}`, { method });
  const data = await res.json();
  return { status: res.status, data };
}

// ============================================================
// PRODUCT VOLUME — verify the Pi collected enough data
// ============================================================
async function testProductVolume() {
  console.log("\n📊 PRODUCT VOLUME");

  const { data } = await api("GET", "/api/products?limit=1");
  assert(data.total >= 1000, `At least 1,000 products collected (got ${data.total})`);

  // Check each category has products
  const categories = ["Dairy", "Produce", "Meat", "Bakery", "Frozen", "Beverages", "Snacks", "Pantry", "Household"];
  for (const cat of categories) {
    const { data: catData } = await api("GET", `/api/products?category=${cat}&limit=1`);
    assert(catData.total > 0, `${cat}: ${catData.total} products`);
  }
}

// ============================================================
// SEARCH QUALITY — common grocery items should be findable
// ============================================================
async function testSearchQuality() {
  console.log("\n🔍 SEARCH QUALITY");

  const commonItems = [
    "milk", "eggs", "bread", "chicken", "cheese",
    "butter", "yogurt", "rice", "pasta", "cereal",
    "banana", "apple", "orange", "potato", "onion",
    "coffee", "water", "juice", "chips", "cookies",
  ];

  let found = 0;
  let missing: string[] = [];

  for (const item of commonItems) {
    const { data } = await api("GET", `/api/products?search=${encodeURIComponent(item)}&limit=1`);
    if (data.total > 0) {
      found++;
    } else {
      missing.push(item);
    }
  }

  assert(found >= 18, `${found}/${commonItems.length} common items found (need 18+)`);
  if (missing.length > 0) {
    console.log(`     Missing: ${missing.join(", ")}`);
  }
}

// ============================================================
// PRICE DATA INTEGRITY — prices should be reasonable
// ============================================================
async function testPriceIntegrity() {
  console.log("\n💰 PRICE DATA INTEGRITY");

  // Get a sample of products and their prices
  const { data: productData } = await api("GET", "/api/products?limit=20");
  const products = productData.products;

  let pricesChecked = 0;
  let allPositive = true;
  let allReasonable = true;
  let productsWithPrices = 0;

  for (const product of products) {
    const { data: prices } = await api("GET", `/api/products/${product.id}/prices`);
    if (prices.length > 0) {
      productsWithPrices++;
      for (const p of prices) {
        pricesChecked++;
        if (p.price <= 0) allPositive = false;
        if (p.price > 500) allReasonable = false; // no single grocery item costs $500
      }
    }
  }

  assert(productsWithPrices > 0, `${productsWithPrices}/${products.length} sample products have prices`);
  assert(allPositive, `All ${pricesChecked} prices are positive`);
  assert(allReasonable, `All ${pricesChecked} prices are under $500 (reasonable for groceries)`);

  // Check that prices have today's date
  const { data: firstPrices } = await api("GET", `/api/products/${products[0].id}/prices`);
  if (firstPrices.length > 0) {
    const priceDate = firstPrices[0].date;
    // Date should be recent (within last 2 days to handle timezone differences)
    const priceDateObj = new Date(priceDate);
    const now = new Date();
    const diffHours = (now.getTime() - priceDateObj.getTime()) / (1000 * 60 * 60);
    assert(diffHours < 48, `Price date is recent: ${priceDate} (${diffHours.toFixed(0)}h ago)`);
  }
}

// ============================================================
// STORE CONFIGURATION — verify stores match collectors
// ============================================================
async function testStoreConfig() {
  console.log("\n🏪 STORE CONFIGURATION");

  const { data: storeList } = await api("GET", "/api/stores");
  assert(storeList.length >= 1, `${storeList.length} stores configured`);

  // Check Ralphs exists (Kroger collector target)
  const ralphs = storeList.find((s: any) => s.name.toLowerCase().includes("ralphs"));
  assert(!!ralphs, "Ralphs store exists");
  assert(ralphs?.chain === "kroger", "Ralphs has chain='kroger'");

  // Check store names are reasonable
  const allHaveNames = storeList.every((s: any) => s.name && s.name.length > 0);
  assert(allHaveNames, "All stores have names");
}

// ============================================================
// COLLECTOR RUNS — verify the Pi ran successfully
// ============================================================
async function testCollectorRuns() {
  console.log("\n🤖 COLLECTOR RUNS");

  const { data: runs } = await api("GET", "/api/collector/status");
  assert(runs.length >= 1, `${runs.length} collector run(s) recorded`);

  // Find the Kroger run (the one that actually collected data)
  const krogerRun = runs.find((r: any) => r.chain === "kroger" && r.productsFound > 0);
  assert(!!krogerRun, "Kroger collector run exists with data");
  assert(krogerRun.status === "completed", `Kroger run status: ${krogerRun.status}`);
  assert(krogerRun.productsFound > 0, `Kroger run found ${krogerRun.productsFound} products`);
  assert(krogerRun.pricesCollected > 0, `Kroger run collected ${krogerRun.pricesCollected} prices`);
  assert(krogerRun.errors === 0 || krogerRun.errors < 10, `Kroger run had ${krogerRun.errors} errors (acceptable)`);

  // Verify timing
  assert(!!krogerRun.startedAt, "Run has start time");
  assert(!!krogerRun.finishedAt, "Run has finish time");
}

// ============================================================
// SPECIFIC PRODUCT SEARCHES — spot-check real data
// ============================================================
async function testSpecificProducts() {
  console.log("\n🛒 SPECIFIC PRODUCT SPOT CHECKS");

  // Search for milk and verify it has expected fields
  const { data: milkData } = await api("GET", "/api/products?search=milk&limit=5");
  assert(milkData.products.length > 0, "Milk products found");

  const milk = milkData.products[0];
  assert(!!milk.name, `Milk name: "${milk.name}"`);
  assert(milk.chain === "kroger", "Milk from Kroger chain");
  assert(!!milk.category, `Milk category: ${milk.category}`);
  assert(!!milk.lastSeen, `Milk last seen: ${milk.lastSeen}`);

  // Search for eggs
  const { data: eggData } = await api("GET", "/api/products?search=eggs&limit=5");
  assert(eggData.products.length > 0, `Eggs: ${eggData.total} products found`);

  // Search for chicken
  const { data: chickenData } = await api("GET", "/api/products?search=chicken&limit=5");
  assert(chickenData.products.length > 0, `Chicken: ${chickenData.total} products found`);

  // Verify prices exist for these products
  const { data: milkPrices } = await api("GET", `/api/products/${milk.id}/prices`);
  assert(milkPrices.length > 0, `Milk has ${milkPrices.length} price entries`);

  const milkPrice = milkPrices[0].price;
  assert(milkPrice > 0.50 && milkPrice < 20, `Milk price is reasonable: $${milkPrice.toFixed(2)}`);
}

// ============================================================
// CATEGORY DISTRIBUTION — data shouldn't be lopsided
// ============================================================
async function testCategoryDistribution() {
  console.log("\n📂 CATEGORY DISTRIBUTION");

  const categories = ["Dairy", "Produce", "Meat", "Bakery", "Frozen", "Beverages", "Snacks", "Pantry", "Household"];
  const counts: Record<string, number> = {};

  for (const cat of categories) {
    const { data } = await api("GET", `/api/products?category=${cat}&limit=1`);
    counts[cat] = data.total;
  }

  // Log distribution
  for (const [cat, count] of Object.entries(counts)) {
    console.log(`     ${cat}: ${count} products`);
  }

  // Each category should have at least 20 products
  const allAboveMin = Object.values(counts).every(c => c >= 20);
  assert(allAboveMin, "Every category has 20+ products");

  // No single category should be more than 40% of total
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const maxPercent = Math.max(...Object.values(counts)) / total * 100;
  assert(maxPercent < 40, `No category dominates (max: ${maxPercent.toFixed(1)}%)`);
}

// ============================================================
// PAGINATION — verify large dataset pagination works
// ============================================================
async function testPagination() {
  console.log("\n📄 PAGINATION");

  const { data: page1 } = await api("GET", "/api/products?limit=50&offset=0");
  const { data: page2 } = await api("GET", "/api/products?limit=50&offset=50");
  const { data: page3 } = await api("GET", "/api/products?limit=50&offset=100");

  assert(page1.products.length === 50, "Page 1: 50 products");
  assert(page2.products.length === 50, "Page 2: 50 products");
  assert(page3.products.length === 50, "Page 3: 50 products");

  // No overlap between pages
  const ids1 = new Set(page1.products.map((p: any) => p.id));
  const ids2 = new Set(page2.products.map((p: any) => p.id));
  const overlap = [...ids1].filter(id => ids2.has(id));
  assert(overlap.length === 0, "No duplicate products between pages");

  // Total should be consistent
  assert(page1.total === page2.total, "Total count is consistent across pages");

  // Can paginate through all products
  const totalPages = Math.ceil(page1.total / 50);
  assert(totalPages >= 20, `${totalPages} pages of 50 (enough to browse)`);
}

// ============================================================
// RUN ALL
// ============================================================
async function main() {
  console.log("🧪 GroceryTrack Live Data Tests (Turso + Pi Collection)");
  console.log("=".repeat(55));

  try {
    await testProductVolume();
    await testSearchQuality();
    await testPriceIntegrity();
    await testStoreConfig();
    await testCollectorRuns();
    await testSpecificProducts();
    await testCategoryDistribution();
    await testPagination();
  } catch (err: any) {
    console.error("\n💥 Unexpected error:", err.message);
    failed++;
  }

  console.log("\n" + "=".repeat(55));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log("\n❌ Failures:");
    failures.forEach(f => console.log(`   - ${f}`));
  }
  process.exit(failed > 0 ? 1 : 0);
}

main();
