/**
 * Unit Tests for extracted modules
 * 
 * Tests: sizeParser, priceUtils, constants, schema helpers
 * Run with: npx tsx test/unit.test.ts
 */

import { parseKrogerSize, parseCostcoSize, inferDefaultSize } from "../server/sizeParser.js";
import { parseTags, computeUnitPrice, formatUnitPrice, formatSize, TAG_OPTIONS, UNITS, DEFAULT_UNITS, CATEGORY_ICONS, CATEGORY_UNITS } from "../shared/schema.js";

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

function assertEq(actual: any, expected: any, message: string) {
  const match = JSON.stringify(actual) === JSON.stringify(expected);
  if (!match) {
    message += ` (got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)})`;
  }
  assert(match, message);
}

// ============================================================
// SIZE PARSER — KROGER
// ============================================================
function testKrogerSizeParser() {
  console.log("\n📏 KROGER SIZE PARSER");

  // Gallons
  assertEq(parseKrogerSize("1 gal", null), { size: 128, unit: "fl oz" }, "1 gal → 128 fl oz");
  assertEq(parseKrogerSize("1/2 gal", null), { size: 64, unit: "fl oz" }, "1/2 gal → 64 fl oz");
  assertEq(parseKrogerSize("half gallon", null), { size: 64, unit: "fl oz" }, "half gallon → 64 fl oz");

  // Fluid ounces
  assertEq(parseKrogerSize("64 fl oz", null), { size: 64, unit: "fl oz" }, "64 fl oz parsed correctly");
  assertEq(parseKrogerSize("32 fl. oz", null), { size: 32, unit: "fl oz" }, "32 fl. oz parsed correctly");

  // Bare oz — depends on item type
  assertEq(parseKrogerSize("16 oz", "fl oz"), { size: 16, unit: "fl oz" }, "16 oz + liquid item → fl oz");
  assertEq(parseKrogerSize("16 oz", "oz"), { size: 16, unit: "oz" }, "16 oz + weight item → oz");
  assertEq(parseKrogerSize("16 oz", "ct"), { size: null, unit: "ct" }, "16 oz + count item → skipped");

  // Pounds
  assertEq(parseKrogerSize("5 lb", "lb"), { size: 5, unit: "lb" }, "5 lb parsed correctly");
  assertEq(parseKrogerSize("5 lb", "fl oz"), { size: null, unit: "fl oz" }, "5 lb + liquid item → skipped");

  // Count
  assertEq(parseKrogerSize("12 ct", "ct"), { size: 12, unit: "ct" }, "12 ct parsed correctly");
  assertEq(parseKrogerSize("24 count", null), { size: 24, unit: "ct" }, "24 count → ct");

  // Liters
  assertEq(parseKrogerSize("2 liter", null), { size: 2, unit: "L" }, "2 liter parsed correctly");

  // Empty/missing
  assertEq(parseKrogerSize("", "oz"), { size: null, unit: "oz" }, "Empty string returns defaultUnit");
  assertEq(parseKrogerSize("unknown format", null), { size: null, unit: null }, "Unknown format returns null");
}

// ============================================================
// SIZE PARSER — COSTCO
// ============================================================
function testCostcoSizeParser() {
  console.log("\n📏 COSTCO SIZE PARSER");

  assertEq(parseCostcoSize("1 gal", null), { size: 128, unit: "fl oz" }, "Costco 1 gal → 128 fl oz");
  assertEq(parseCostcoSize("2 x 1 gal", null), { size: 256, unit: "fl oz" }, "Costco 2 x 1 gal → 256 fl oz");
  assertEq(parseCostcoSize("64 fl oz", null), { size: 64, unit: "fl oz" }, "Costco 64 fl oz");
  assertEq(parseCostcoSize("3 kg", "lb"), { size: 3 * 2.205, unit: "lb" }, "Costco 3 kg → lb");
  assertEq(parseCostcoSize("3 kg", "fl oz"), { size: null, unit: "fl oz" }, "Costco 3 kg + liquid → skipped");
}

// ============================================================
// DEFAULT SIZE INFERENCE
// ============================================================
function testInferDefaultSize() {
  console.log("\n🔮 DEFAULT SIZE INFERENCE");

  assertEq(inferDefaultSize("Milk", "fl oz"), { size: 128, unit: "fl oz" }, "Milk defaults to 1 gallon");
  assertEq(inferDefaultSize("Eggs", "ct"), { size: 12, unit: "ct" }, "Eggs defaults to 12 count");
  assertEq(inferDefaultSize("Chicken Breast", "lb"), { size: 1, unit: "lb" }, "Chicken Breast defaults to 1 lb");
  assertEq(inferDefaultSize("Bread", "oz"), { size: 20, unit: "oz" }, "Bread defaults to 20 oz");
  assertEq(inferDefaultSize("Paper Towels", "ct"), { size: 6, unit: "ct" }, "Paper Towels defaults to 6 ct");
  assertEq(inferDefaultSize("Unknown Product XYZ", "oz"), { size: null, unit: "oz" }, "Unknown product returns null size");
}

// ============================================================
// SCHEMA HELPERS
// ============================================================
function testSchemaHelpers() {
  console.log("\n📐 SCHEMA HELPERS");

  // parseTags
  assertEq(parseTags({ id: 1, name: "Test", category: null, tags: '["2%","Organic"]', defaultUnit: null }), ["2%", "Organic"], "parseTags parses JSON array");
  assertEq(parseTags({ id: 1, name: "Test", category: null, tags: null, defaultUnit: null }), [], "parseTags returns [] for null");
  assertEq(parseTags({ id: 1, name: "Test", category: null, tags: "invalid json", defaultUnit: null }), [], "parseTags returns [] for bad JSON");

  // computeUnitPrice
  assertEq(computeUnitPrice(4.99, 128, "fl oz"), 4.99 / 128, "Unit price = price / size");
  assertEq(computeUnitPrice(4.99, null, "fl oz"), null, "Unit price null when no size");
  assertEq(computeUnitPrice(4.99, 128, null), null, "Unit price null when no unit");
  assertEq(computeUnitPrice(4.99, 0, "fl oz"), null, "Unit price null when size is 0");

  // formatUnitPrice
  const up = computeUnitPrice(4.99, 128, "fl oz")!;
  const formatted = formatUnitPrice(up, "fl oz");
  assert(formatted.includes("fl oz"), "formatUnitPrice includes unit");
  assert(formatted.includes("$") || formatted.includes("¢"), "formatUnitPrice includes currency");

  // formatSize
  // formatSize converts 128 fl oz to "1 gal" for readability
  const formatted128 = formatSize(128, "fl oz");
  assert(formatted128 === "1 gal" || formatted128 === "128 fl oz", "formatSize 128 fl oz → readable format");
  assertEq(formatSize(1, "lb"), "1 lb", "formatSize 1 lb");
  assertEq(formatSize(null, null), "", "formatSize null returns empty");
  assertEq(formatSize(null, "oz"), "", "formatSize null size returns empty");
}

// ============================================================
// CONSTANTS & SCHEMA EXPORTS
// ============================================================
function testConstants() {
  console.log("\n📋 CONSTANTS & EXPORTS");

  // TAG_OPTIONS should have entries for standard categories
  assert(Array.isArray(TAG_OPTIONS["Dairy"]), "TAG_OPTIONS has Dairy");
  assert(Array.isArray(TAG_OPTIONS["Produce"]), "TAG_OPTIONS has Produce");
  assert(Array.isArray(TAG_OPTIONS["Meat"]), "TAG_OPTIONS has Meat");
  assert(TAG_OPTIONS["Dairy"].length > 0, "Dairy has at least 1 tag option");

  // UNITS
  assert(Array.isArray(UNITS), "UNITS is an array");
  assert(UNITS.includes("fl oz"), "UNITS includes fl oz");
  assert(UNITS.includes("oz"), "UNITS includes oz");
  assert(UNITS.includes("lb"), "UNITS includes lb");
  assert(UNITS.includes("ct"), "UNITS includes ct");

  // DEFAULT_UNITS
  assert(typeof DEFAULT_UNITS === "object", "DEFAULT_UNITS is an object");
  assertEq(DEFAULT_UNITS["Dairy"], "fl oz", "Dairy defaults to fl oz");
  assertEq(DEFAULT_UNITS["Produce"], "lb", "Produce defaults to lb");

  // CATEGORY_ICONS
  assert(typeof CATEGORY_ICONS === "object", "CATEGORY_ICONS is an object");
  assert(typeof CATEGORY_ICONS["Dairy"] === "string", "Dairy has an icon");
  assert(typeof CATEGORY_ICONS["Produce"] === "string", "Produce has an icon");

  // CATEGORY_UNITS
  assert(typeof CATEGORY_UNITS === "object", "CATEGORY_UNITS is an object");
  assert(Array.isArray(CATEGORY_UNITS["Dairy"]), "Dairy has category-specific units");
}

// ============================================================
// RUN ALL
// ============================================================
function main() {
  console.log("🧪 GroceryTrack Unit Tests");
  console.log("=".repeat(50));

  testKrogerSizeParser();
  testCostcoSizeParser();
  testInferDefaultSize();
  testSchemaHelpers();
  testConstants();

  console.log("\n" + "=".repeat(50));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log("\n❌ Failures:");
    failures.forEach(f => console.log(`   - ${f}`));
  }
  process.exit(failed > 0 ? 1 : 0);
}

main();
