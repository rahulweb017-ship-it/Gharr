import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeEstimate,
  deriveUnitPricePaise,
  MissingPriceError,
  packsForQuantity,
  roundUpQuantity,
  type EstimatePriceInput,
  type EstimateRuleInput,
} from "./estimate";
import { measuresFor } from "./contracts/estimate";

/**
 * Estimate maths. Totals here are shown to customers as money, so each case is
 * worked by hand in the comments and asserted to the paisa.
 */

const rule = (r: Partial<EstimateRuleInput> & Pick<EstimateRuleInput, "itemKey" | "basis" | "quantityPerBasis">): EstimateRuleInput => ({
  label: r.itemKey,
  bucket: "MATERIALS",
  unit: "BAG",
  wastagePercent: 0,
  sortOrder: 0,
  ...r,
});

const price = (itemKey: string, unitPricePaise: number, packCoverage = 1): EstimatePriceInput => ({
  itemKey,
  unitPricePaise,
  productId: null,
  packCoverage,
});

const house = measuresFor({
  mode: "NEW_BUILD",
  title: "Test",
  city: "Hyderabad",
  tier: "STANDARD",
  plotSqft: 1200,
  builtUpSqft: 1200,
  floors: 1,
  rooms: 3,
  bathrooms: 2,
});

test("measures: wall area uses the 2.8 wall factor", () => {
  assert.equal(house.floorSqft, 1200);
  assert.equal(house.wallSqft, 3360);
});

test("hand-worked 1,200 sq ft standard build", () => {
  const result = computeEstimate(
    house,
    [
      // 1200 × 0.4 = 480 bags × ₹379 = ₹1,81,920
      rule({ itemKey: "cement", basis: "BUILTUP_SQFT", quantityPerBasis: 0.4, sortOrder: 1 }),
      // 1200 × 1 × 1.08 = 1296 sq ft × ₹42.50 = ₹55,080
      rule({ itemKey: "tiles", basis: "FLOOR_SQFT", quantityPerBasis: 1, unit: "SQFT", wastagePercent: 8, sortOrder: 2 }),
      // 2 bathrooms × 1 WC × ₹6,500 = ₹13,000
      rule({ itemKey: "wc", basis: "PER_BATHROOM", quantityPerBasis: 1, unit: "PIECE", sortOrder: 3 }),
      // 1200 × ₹480 = ₹5,76,000
      rule({ itemKey: "labour", basis: "BUILTUP_SQFT", quantityPerBasis: 1, unit: "SQFT", bucket: "LABOUR", sortOrder: 4 }),
      // 10% of (1,81,920 + 55,080 + 13,000 + 5,76,000 = 8,26,000) = ₹82,600
      rule({ itemKey: "contingency", basis: "PERCENT_OF_SUBTOTAL", quantityPerBasis: 10, unit: null, bucket: "OTHER", sortOrder: 5 }),
    ],
    [price("cement", 37_900), price("tiles", 4_250, 16), price("wc", 650_000), price("labour", 48_000)],
  );

  const byKey = Object.fromEntries(result.lines.map((l) => [l.itemKey, l]));
  assert.equal(byKey.cement.quantity, 480);
  assert.equal(byKey.cement.amountPaise, 18_192_000);
  assert.equal(byKey.tiles.quantity, 1296);
  assert.equal(byKey.tiles.amountPaise, 5_508_000);
  assert.equal(byKey.wc.amountPaise, 1_300_000);
  assert.equal(byKey.contingency.unitPricePaise, 82_600_000);
  assert.equal(byKey.contingency.amountPaise, 8_260_000);

  assert.equal(result.materialsPaise, 25_000_000);
  assert.equal(result.labourPaise, 57_600_000);
  assert.equal(result.otherPaise, 8_260_000);
  assert.equal(result.totalPaise, 90_860_000);
  assert.deepEqual(result.lines.map((l) => l.itemKey), ["cement", "tiles", "wc", "labour", "contingency"]);
});

test("quantities round up, never down, per unit precision", () => {
  assert.equal(roundUpQuantity(480.01, "BAG"), 481);
  assert.equal(roundUpQuantity(12.000000001, "BAG"), 12);
  assert.equal(roundUpQuantity(98.41, "TONNE"), 98.5);
  assert.equal(roundUpQuantity(3.35, "LITRE"), 3.4);
});

test("wastage is applied before rounding", () => {
  // 1200 × 0.4 × 1.05 = 504 exactly; 1201 × 0.4 × 1.05 = 504.42 → 505
  const r = [rule({ itemKey: "cement", basis: "BUILTUP_SQFT", quantityPerBasis: 0.4, wastagePercent: 5 })];
  const p = [price("cement", 100)];
  assert.equal(computeEstimate(house, r, p).lines[0].quantity, 504);
  assert.equal(computeEstimate({ ...house, builtUpSqft: 1201 }, r, p).lines[0].quantity, 505);
});

test("percentages apply to the itemised subtotal only, not to each other", () => {
  const rules = [
    rule({ itemKey: "cement", basis: "FIXED", quantityPerBasis: 100, sortOrder: 1 }),
    rule({ itemKey: "design", basis: "PERCENT_OF_SUBTOTAL", quantityPerBasis: 5, unit: null, bucket: "OTHER", sortOrder: 2 }),
    rule({ itemKey: "contingency", basis: "PERCENT_OF_SUBTOTAL", quantityPerBasis: 10, unit: null, bucket: "OTHER", sortOrder: 3 }),
  ];
  const result = computeEstimate(house, rules, [price("cement", 10_000)]);
  // Subtotal ₹10,000 → design ₹500, contingency ₹1,000 (not 10% of ₹10,500).
  assert.equal(result.otherPaise, 150_000);
  assert.equal(result.totalPaise, 1_150_000);
});

test("a missing price is an error, never a silent ₹0", () => {
  assert.throws(
    () =>
      computeEstimate(
        house,
        [rule({ itemKey: "cement", basis: "FIXED", quantityPerBasis: 1 }), rule({ itemKey: "steel", basis: "FIXED", quantityPerBasis: 1 })],
        [price("cement", 100)],
      ),
    (error: unknown) => error instanceof MissingPriceError && error.itemKeys.join() === "steel",
  );
});

test("renovation: bathroom scope has one bathroom and wall area from floor area", () => {
  const m = measuresFor({ mode: "RENOVATION", title: "Bath", city: "Hyderabad", tier: "BASIC", scope: "BATHROOM", areaSqft: 40 });
  assert.equal(m.bathrooms, 1);
  assert.equal(m.wallSqft, 112);

  const result = computeEstimate(
    m,
    [
      rule({ itemKey: "wc", basis: "PER_BATHROOM", quantityPerBasis: 1, unit: "PIECE" }),
      rule({ itemKey: "floor_tiles", basis: "FLOOR_SQFT", quantityPerBasis: 1, unit: "SQFT", wastagePercent: 8 }),
    ],
    [price("wc", 650_000), price("floor_tiles", 4_389, 9)],
  );
  // 40 × 1.08 = 43.2 → 44 sq ft × ₹43.89 = ₹1,931.16, quoted as ₹1,931
  assert.equal(result.lines.find((l) => l.itemKey === "floor_tiles")!.amountPaise, 193_100);
  assert.equal(result.totalPaise, 650_000 + 193_100);
});

test("zero-count bases drop the line instead of showing a ₹0 row", () => {
  const result = computeEstimate(
    { ...house, bathrooms: 0 },
    [rule({ itemKey: "wc", basis: "PER_BATHROOM", quantityPerBasis: 1, unit: "PIECE" })],
    [price("wc", 650_000)],
  );
  assert.equal(result.lines.length, 0);
  assert.equal(result.totalPaise, 0);
});

test("lines are whole rupees and the total is their exact sum", () => {
  const result = computeEstimate(
    house,
    [
      rule({ itemKey: "tiles", basis: "FIXED", quantityPerBasis: 486, unit: "SQFT", sortOrder: 1 }),
      rule({ itemKey: "contingency", basis: "PERCENT_OF_SUBTOTAL", quantityPerBasis: 8, unit: null, bucket: "OTHER", sortOrder: 2 }),
    ],
    [price("tiles", 4_333)],
  );
  // 486 × ₹43.33 = ₹21,058.38 → ₹21,058; 8% of ₹21,058 = ₹1,684.64 → ₹1,685
  assert.deepEqual(result.lines.map((l) => l.amountPaise), [2_105_800, 168_500]);
  assert.ok(result.lines.every((l) => l.amountPaise % 100 === 0));
  assert.equal(result.totalPaise, 2_274_300);
});

test("packs cover the estimate: 1,296 sq ft in 16 sq ft boxes is 81 boxes", () => {
  assert.equal(packsForQuantity(1296, 16), 81);
  assert.equal(packsForQuantity(1297, 16), 82);
  assert.equal(packsForQuantity(480, 1), 480);
});

test("unit price from a pack: ₹640 box of 16 sq ft is ₹40 per sq ft", () => {
  assert.equal(deriveUnitPricePaise(64_000, 16), 4_000);
  // ₹415 bag priced per bag (coverage 1) is unchanged.
  assert.equal(deriveUnitPricePaise(41_500, 1), 41_500);
  // ₹999 / 9 = 111 paise exactly; ₹1,000 / 3 = 33,333.33 → 33,333 (nearest paisa).
  assert.equal(deriveUnitPricePaise(99_900, 9), 11_100);
  assert.equal(deriveUnitPricePaise(100_000, 3), 33_333);
  // Half a paisa rounds up, like the seed always did.
  assert.equal(deriveUnitPricePaise(5, 2), 3);
  // Fractional coverage (a 2.5 L tin) is allowed.
  assert.equal(deriveUnitPricePaise(50_000, 2.5), 20_000);
});

test("unit price never rounds a paid pack to free, and rejects bad coverage", () => {
  assert.equal(deriveUnitPricePaise(1, 1000), 1);
  assert.equal(deriveUnitPricePaise(0, 16), 0);
  assert.throws(() => deriveUnitPricePaise(64_000, 0), RangeError);
  assert.throws(() => deriveUnitPricePaise(64_000, -4), RangeError);
  assert.throws(() => deriveUnitPricePaise(64_000, Number.NaN), RangeError);
  assert.throws(() => deriveUnitPricePaise(-100, 4), RangeError);
});
