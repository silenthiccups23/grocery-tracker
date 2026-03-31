/**
 * API Integration Tests for GroceryTrack
 * 
 * Tests all CRUD endpoints: stores, items, prices.
 * Run with: npx tsx test/api.test.ts
 * Requires the dev server running on port 5000.
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
// STORES
// ============================================================
async function testStores() {
  console.log("\n📦 STORES CRUD");

  // GET all stores
  const { status: listStatus, data: storeList } = await api("GET", "/api/stores");
  assert(listStatus === 200, "GET /api/stores returns 200");
  assert(Array.isArray(storeList), "GET /api/stores returns an array");

  // POST create store
  const { status: createStatus, data: newStore } = await api("POST", "/api/stores", {
    name: "Test Store",
    location: "Test City",
    address: "123 Test St",
  });
  assert(createStatus === 201, "POST /api/stores returns 201");
  assert(newStore.name === "Test Store", "Created store has correct name");
  assert(newStore.id > 0, "Created store has an ID");
  const testStoreId = newStore.id;

  // POST with missing name (should fail)
  const { status: badStatus } = await api("POST", "/api/stores", {
    location: "No Name City",
  });
  assert(badStatus === 400, "POST /api/stores without name returns 400");

  // PATCH update store
  const { status: patchStatus, data: updatedStore } = await api("PATCH", `/api/stores/${testStoreId}`, {
    location: "Updated City",
    address: "456 Updated Ave",
  });
  assert(patchStatus === 200, "PATCH /api/stores/:id returns 200");
  assert(updatedStore.location === "Updated City", "Store location was updated");
  assert(updatedStore.address === "456 Updated Ave", "Store address was updated");

  // PATCH nonexistent store
  const { status: patchMissing } = await api("PATCH", "/api/stores/99999", {
    location: "Nowhere",
  });
  assert(patchMissing === 404, "PATCH nonexistent store returns 404");

  // DELETE store
  const { status: deleteStatus } = await api("DELETE", `/api/stores/${testStoreId}`);
  assert(deleteStatus === 204, "DELETE /api/stores/:id returns 204");

  // Verify delete
  const { data: afterDelete } = await api("GET", "/api/stores");
  const found = afterDelete.find((s: any) => s.id === testStoreId);
  assert(!found, "Deleted store no longer appears in list");

  // DELETE invalid ID
  const { status: badDelete } = await api("DELETE", "/api/stores/abc");
  assert(badDelete === 400, "DELETE /api/stores/abc returns 400 (invalid ID)");

  // Bulk add
  const { status: bulkStatus, data: bulkStores } = await api("POST", "/api/stores/bulk", {
    stores: [
      { name: "Bulk Store A", address: "111 A St" },
      { name: "Bulk Store B", address: "222 B St" },
    ],
  });
  assert(bulkStatus === 201, "POST /api/stores/bulk returns 201");
  assert(Array.isArray(bulkStores) && bulkStores.length === 2, "Bulk add creates 2 stores");

  // Clean up bulk stores
  for (const s of bulkStores) {
    await api("DELETE", `/api/stores/${s.id}`);
  }
}

// ============================================================
// ITEMS
// ============================================================
async function testItems() {
  console.log("\n🛒 ITEMS CRUD");

  // GET all items
  const { status: listStatus, data: itemList } = await api("GET", "/api/items");
  assert(listStatus === 200, "GET /api/items returns 200");
  assert(Array.isArray(itemList), "GET /api/items returns an array");

  // POST create item
  const { status: createStatus, data: newItem } = await api("POST", "/api/items", {
    name: "Test Milk",
    category: "Dairy",
    tags: '["2%","Organic"]',
    defaultUnit: "fl oz",
  });
  assert(createStatus === 201, "POST /api/items returns 201");
  assert(newItem.name === "Test Milk", "Created item has correct name");
  assert(newItem.category === "Dairy", "Created item has correct category");
  assert(newItem.defaultUnit === "fl oz", "Created item has correct unit");
  const testItemId = newItem.id;

  // POST with missing name
  const { status: badItem } = await api("POST", "/api/items", {
    category: "Dairy",
  });
  assert(badItem === 400, "POST /api/items without name returns 400");

  // PATCH update item
  const { status: patchStatus, data: updatedItem } = await api("PATCH", `/api/items/${testItemId}`, {
    name: "Updated Milk",
    category: "Dairy",
    tags: '["Whole"]',
    defaultUnit: "gal",
  });
  assert(patchStatus === 200, "PATCH /api/items/:id returns 200");
  assert(updatedItem.name === "Updated Milk", "Item name was updated");
  assert(updatedItem.tags === '["Whole"]', "Item tags were updated");

  // PATCH nonexistent item
  const { status: patchMissing } = await api("PATCH", "/api/items/99999", {
    name: "Ghost",
  });
  assert(patchMissing === 404, "PATCH nonexistent item returns 404");

  // Bulk add items
  const { status: bulkStatus, data: bulkItems } = await api("POST", "/api/items/bulk", {
    items: [
      { name: "Bulk Eggs", category: "Dairy", tags: null, defaultUnit: "ct" },
      { name: "Bulk Rice", category: "Pantry", tags: null, defaultUnit: "lb" },
      { name: "", category: null, tags: null, defaultUnit: null }, // empty name — should be skipped
    ],
  });
  assert(bulkStatus === 201, "POST /api/items/bulk returns 201");
  assert(Array.isArray(bulkItems) && bulkItems.length === 2, "Bulk add creates 2 items (skips empty name)");

  // DELETE item
  const { status: deleteStatus } = await api("DELETE", `/api/items/${testItemId}`);
  assert(deleteStatus === 204, "DELETE /api/items/:id returns 204");

  // Clean up bulk items
  for (const i of bulkItems) {
    await api("DELETE", `/api/items/${i.id}`);
  }
}

// ============================================================
// PRICES
// ============================================================
async function testPrices() {
  console.log("\n💰 PRICES CRUD");

  // Create a store and item for price testing
  const { data: store } = await api("POST", "/api/stores", {
    name: "Price Test Store",
    location: null,
    address: null,
  });
  const { data: item } = await api("POST", "/api/items", {
    name: "Price Test Milk",
    category: "Dairy",
    tags: null,
    defaultUnit: "fl oz",
  });

  // GET all prices
  const { status: listStatus, data: priceList } = await api("GET", "/api/prices");
  assert(listStatus === 200, "GET /api/prices returns 200");
  assert(Array.isArray(priceList), "GET /api/prices returns an array");

  // POST create price
  const { status: createStatus, data: newPrice } = await api("POST", "/api/prices", {
    itemId: item.id,
    storeId: store.id,
    price: 4.99,
    date: "2026-03-30",
    size: 128,
    unit: "fl oz",
  });
  assert(createStatus === 201, "POST /api/prices returns 201");
  assert(newPrice.price === 4.99, "Created price has correct value");
  assert(newPrice.size === 128, "Created price has correct size");
  assert(newPrice.unit === "fl oz", "Created price has correct unit");
  assert(newPrice.itemId === item.id, "Created price linked to correct item");
  assert(newPrice.storeId === store.id, "Created price linked to correct store");

  // GET prices by item
  const { status: byItemStatus, data: itemPrices } = await api("GET", `/api/prices/item/${item.id}`);
  assert(byItemStatus === 200, "GET /api/prices/item/:id returns 200");
  assert(itemPrices.length >= 1, "Found at least 1 price for the item");

  // Create a second price (different store, same item)
  const { data: store2 } = await api("POST", "/api/stores", {
    name: "Price Test Store 2",
    location: null,
    address: null,
  });
  await api("POST", "/api/prices", {
    itemId: item.id,
    storeId: store2.id,
    price: 3.49,
    date: "2026-03-30",
    size: 64,
    unit: "fl oz",
  });

  const { data: itemPrices2 } = await api("GET", `/api/prices/item/${item.id}`);
  assert(itemPrices2.length >= 2, "Item has prices from 2 stores");

  // DELETE price
  const { status: deletePrice } = await api("DELETE", `/api/prices/${newPrice.id}`);
  assert(deletePrice === 204, "DELETE /api/prices/:id returns 204");

  // Clean up
  await api("DELETE", `/api/stores/${store.id}`);
  await api("DELETE", `/api/stores/${store2.id}`);
  await api("DELETE", `/api/items/${item.id}`);
}

// ============================================================
// EDGE CASES
// ============================================================
async function testEdgeCases() {
  console.log("\n🔧 EDGE CASES");

  // Invalid IDs
  const { status: s1 } = await api("GET", "/api/prices/item/abc");
  assert(s1 === 400, "GET /api/prices/item/abc returns 400");

  const { status: s2 } = await api("PATCH", "/api/stores/abc", { location: "X" });
  assert(s2 === 400, "PATCH /api/stores/abc returns 400");

  const { status: s3 } = await api("DELETE", "/api/items/abc");
  assert(s3 === 400, "DELETE /api/items/abc returns 400");

  // Empty bulk operations
  const { status: s4 } = await api("POST", "/api/stores/bulk", { stores: [] });
  assert(s4 === 400, "Bulk add with empty array returns 400");

  const { status: s5 } = await api("POST", "/api/items/bulk", { items: [] });
  assert(s5 === 400, "Bulk items with empty array returns 400");

  // Price with invalid body
  const { status: s6 } = await api("POST", "/api/prices", { price: "not a number" });
  assert(s6 === 400, "POST /api/prices with invalid body returns 400");

  // Nonexistent routes
  const res = await fetch(`${BASE}/api/nonexistent`);
  assert(res.status === 404 || res.status === 200, "Unknown route doesn't crash the server");
}

// ============================================================
// RUN ALL
// ============================================================
async function main() {
  console.log("🧪 GroceryTrack API Tests");
  console.log("=".repeat(50));

  try {
    await testStores();
    await testItems();
    await testPrices();
    await testEdgeCases();
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
