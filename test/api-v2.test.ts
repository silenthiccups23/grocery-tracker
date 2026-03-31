/**
 * API Tests for the new bulk-collection endpoints
 * 
 * Tests: /api/products, /api/watchlist, /api/collector/status
 * Run with: npx tsx test/api-v2.test.ts
 * Requires dev server on port 5000 + seeded data (run seed-sample-data.ts first)
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

async function api(method: string, path: string, body?: any) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

// ============================================================
// PRODUCTS (pre-collected)
// ============================================================
async function testProducts() {
  console.log("\n📦 PRODUCTS API");

  // GET all products (default limit 50)
  const { status: listStatus, data: listData } = await api("GET", "/api/products");
  assert(listStatus === 200, "GET /api/products returns 200");
  assert(typeof listData.total === "number", "Response includes total count");
  assert(Array.isArray(listData.products), "Response includes products array");
  assert(listData.total > 0, "Database has products (seeded data)");
  assert(listData.products.length > 0, "Products array is not empty");

  // Check product shape
  const firstProduct = listData.products[0];
  assert(typeof firstProduct.id === "number", "Product has id");
  assert(typeof firstProduct.name === "string", "Product has name");
  assert(typeof firstProduct.chain === "string", "Product has chain");
  assert(typeof firstProduct.lastSeen === "string", "Product has lastSeen date");

  // Search by name
  const { data: milkData } = await api("GET", "/api/products?search=milk");
  assert(milkData.products.length > 0, "Search 'milk' returns results");
  assert(milkData.products.every((p: any) => p.name.toLowerCase().includes("milk")), "All 'milk' results contain 'milk' in name");

  // Search by category
  const { data: dairyData } = await api("GET", "/api/products?category=Dairy");
  assert(dairyData.products.length > 0, "Filter by Dairy returns results");
  assert(dairyData.products.every((p: any) => p.category === "Dairy"), "All Dairy results have category=Dairy");

  // Search with no results
  const { data: noResults } = await api("GET", "/api/products?search=xyznonexistent");
  assert(noResults.products.length === 0, "Search for nonexistent term returns empty");
  assert(noResults.total === 0, "Total is 0 for no results");

  // Pagination
  const { data: page1 } = await api("GET", "/api/products?limit=5&offset=0");
  const { data: page2 } = await api("GET", "/api/products?limit=5&offset=5");
  assert(page1.products.length === 5, "Limit=5 returns 5 products");
  assert(page2.products.length > 0, "Offset=5 returns more products");
  assert(page1.products[0].id !== page2.products[0].id, "Page 1 and page 2 have different products");

  // Get single product
  const productId = firstProduct.id;
  const { status: getStatus, data: singleProduct } = await api("GET", `/api/products/${productId}`);
  assert(getStatus === 200, "GET /api/products/:id returns 200");
  assert(singleProduct.id === productId, "Single product has correct id");

  // Get nonexistent product
  const { status: notFound } = await api("GET", "/api/products/99999");
  assert(notFound === 404, "GET /api/products/99999 returns 404");

  // Invalid product ID
  const { status: badId } = await api("GET", "/api/products/abc");
  assert(badId === 400, "GET /api/products/abc returns 400");

  // Get product prices
  const { status: priceStatus, data: priceData } = await api("GET", `/api/products/${productId}/prices`);
  assert(priceStatus === 200, "GET /api/products/:id/prices returns 200");
  assert(Array.isArray(priceData), "Prices is an array");
  assert(priceData.length > 0, "Product has price data");
  assert(typeof priceData[0].price === "number", "Price entry has numeric price");
  assert(typeof priceData[0].storeId === "number", "Price entry has storeId");
  assert(typeof priceData[0].date === "string", "Price entry has date");
}

// ============================================================
// WATCHLIST
// ============================================================
async function testWatchlist() {
  console.log("\n⭐ WATCHLIST API");

  // GET watchlist (initially empty or whatever state)
  const { status: listStatus, data: watchlistBefore } = await api("GET", "/api/watchlist");
  assert(listStatus === 200, "GET /api/watchlist returns 200");
  assert(Array.isArray(watchlistBefore), "Watchlist is an array");

  // POST add to watchlist
  const { status: addStatus, data: newItem } = await api("POST", "/api/watchlist", {
    productName: "Milk",
    category: "Dairy",
    tags: '["2%"]',
    defaultUnit: "fl oz",
  });
  assert(addStatus === 201, "POST /api/watchlist returns 201");
  assert(newItem.productName === "Milk", "Watchlist item has correct name");
  assert(newItem.category === "Dairy", "Watchlist item has correct category");
  assert(newItem.id > 0, "Watchlist item has an id");

  // POST with missing name
  const { status: badAdd } = await api("POST", "/api/watchlist", {
    category: "Dairy",
  });
  assert(badAdd === 400, "POST /api/watchlist without name returns 400");

  // POST with empty name
  const { status: emptyAdd } = await api("POST", "/api/watchlist", {
    productName: "  ",
  });
  assert(emptyAdd === 400, "POST /api/watchlist with empty name returns 400");

  // GET watchlist again
  const { data: watchlistAfter } = await api("GET", "/api/watchlist");
  assert(watchlistAfter.length === watchlistBefore.length + 1, "Watchlist has one more item");

  // Add a second item
  const { data: item2 } = await api("POST", "/api/watchlist", {
    productName: "Eggs",
    category: "Dairy",
  });

  // DELETE watchlist item
  const { status: deleteStatus } = await api("DELETE", `/api/watchlist/${newItem.id}`);
  assert(deleteStatus === 204, "DELETE /api/watchlist/:id returns 204");

  // Verify delete
  const { data: watchlistFinal } = await api("GET", "/api/watchlist");
  const found = watchlistFinal.find((w: any) => w.id === newItem.id);
  assert(!found, "Deleted watchlist item is gone");

  // DELETE invalid ID
  const { status: badDelete } = await api("DELETE", "/api/watchlist/abc");
  assert(badDelete === 400, "DELETE /api/watchlist/abc returns 400");

  // Clean up
  await api("DELETE", `/api/watchlist/${item2.id}`);
}

// ============================================================
// COLLECTOR STATUS
// ============================================================
async function testCollectorStatus() {
  console.log("\n📊 COLLECTOR STATUS API");

  const { status, data } = await api("GET", "/api/collector/status");
  assert(status === 200, "GET /api/collector/status returns 200");
  assert(Array.isArray(data), "Collector runs is an array");
  assert(data.length > 0, "Has at least 1 collector run (from seed)");

  const run = data[0];
  assert(typeof run.chain === "string", "Run has chain");
  assert(typeof run.startedAt === "string", "Run has startedAt");
  assert(typeof run.status === "string", "Run has status");
  assert(run.status === "completed", "Seeded run has completed status");
  assert(typeof run.productsFound === "number", "Run has productsFound count");
  assert(typeof run.pricesCollected === "number", "Run has pricesCollected count");
}

// ============================================================
// CROSS-FEATURE: Prices + Products
// ============================================================
async function testProductPriceRelationship() {
  console.log("\n🔗 PRODUCT-PRICE RELATIONSHIPS");

  // Get a product and its prices
  const { data: productList } = await api("GET", "/api/products?search=milk&limit=1");
  assert(productList.products.length > 0, "Found a milk product");

  const product = productList.products[0];
  const { data: prices } = await api("GET", `/api/products/${product.id}/prices`);
  assert(prices.length > 0, "Milk product has prices");

  // Verify each price links to a valid store
  const { data: storeList } = await api("GET", "/api/stores");
  const storeIds = new Set(storeList.map((s: any) => s.id));
  const allPricesHaveValidStore = prices.every((p: any) => storeIds.has(p.storeId));
  assert(allPricesHaveValidStore, "All prices reference valid stores");

  // Verify prices are reasonable numbers
  const allPricesPositive = prices.every((p: any) => p.price > 0 && p.price < 1000);
  assert(allPricesPositive, "All prices are positive and reasonable");

  // Verify different stores can have different prices
  const uniquePrices = new Set(prices.map((p: any) => p.price));
  assert(uniquePrices.size >= 1, "Product has price data from stores");

  // Check that prices have dates
  const allHaveDates = prices.every((p: any) => /^\d{4}-\d{2}-\d{2}$/.test(p.date));
  assert(allHaveDates, "All prices have ISO date format");
}

// ============================================================
// RUN ALL
// ============================================================
async function main() {
  console.log("🧪 GroceryTrack V2 API Tests (Bulk Collection)");
  console.log("=".repeat(50));

  try {
    await testProducts();
    await testWatchlist();
    await testCollectorStatus();
    await testProductPriceRelationship();
  } catch (err: any) {
    console.error("\n💥 Unexpected error:", err.message);
    failed++;
  }

  console.log("\n" + "=".repeat(50));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log("\n❌ Failures:");
    failures.forEach(f => console.log(`   - ${f}`));
  }
  process.exit(failed > 0 ? 1 : 0);
}

main();
