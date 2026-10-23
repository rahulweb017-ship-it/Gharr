import { test } from "node:test";
import assert from "node:assert/strict";
import { changedFields, variantEditErrors } from "./catalog-admin-rules";

const ok = { pricePaise: 41_500, mrpPaise: 45_000, quantityAvailable: 120, lowStockThreshold: 10 };
const fields = (errors: Array<{ field: string }>) => errors.map((e) => e.field);

test("a valid variant edit has no errors; MRP equal to price is allowed", () => {
  assert.deepEqual(variantEditErrors(ok), []);
  assert.deepEqual(variantEditErrors({ ...ok, mrpPaise: 41_500 }), []);
  assert.deepEqual(variantEditErrors({ ...ok, quantityAvailable: 0, lowStockThreshold: 0 }), []);
  assert.deepEqual(variantEditErrors({ ...ok, quantityAvailable: 12.5 }), []);
});

test("price must be whole positive paise and never above MRP", () => {
  assert.deepEqual(fields(variantEditErrors({ ...ok, pricePaise: 0 })), ["pricePaise"]);
  assert.deepEqual(fields(variantEditErrors({ ...ok, pricePaise: 415.5 })), ["pricePaise"]);
  assert.deepEqual(fields(variantEditErrors({ ...ok, mrpPaise: 40_000 })), ["mrpPaise"]);
});

test("stock and threshold cannot be negative", () => {
  assert.deepEqual(fields(variantEditErrors({ ...ok, quantityAvailable: -1, lowStockThreshold: -2 })), [
    "quantityAvailable",
    "lowStockThreshold",
  ]);
});

test("count units need whole stock; measured units allow fractions", () => {
  assert.deepEqual(fields(variantEditErrors({ ...ok, quantityAvailable: 12.5, allowsFraction: false })), ["quantityAvailable"]);
  assert.deepEqual(variantEditErrors({ ...ok, quantityAvailable: 12.5, allowsFraction: true }), []);
});

test("changedFields keeps only fields that differ", () => {
  const before = { pricePaise: 100, mrpPaise: 120, isActive: true };
  assert.deepEqual(changedFields(before, { pricePaise: 90, mrpPaise: 120, isActive: undefined }), {
    before: { pricePaise: 100 },
    after: { pricePaise: 90 },
    changed: true,
  });
  assert.equal(changedFields(before, { isActive: true }).changed, false);
});
