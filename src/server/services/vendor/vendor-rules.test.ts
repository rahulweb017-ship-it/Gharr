import { test } from "node:test";
import assert from "node:assert/strict";
import { GSTIN_PATTERN, buildSearchText, checkUpload, slugify, sniffMatches, VENDOR_DOCUMENT_TYPES } from "./vendor-rules";

test("slugify makes URL-safe vendor slugs", () => {
  assert.equal(slugify("  Sri Lakshmi Cement & Steel  "), "sri-lakshmi-cement-steel");
  assert.equal(slugify("ABC—Traders!!"), "abc-traders");
});

test("GSTIN pattern accepts a real-shaped number and rejects junk", () => {
  assert.ok(GSTIN_PATTERN.test("36AAKFK1234L1Z5"));
  assert.ok(!GSTIN_PATTERN.test("36aakfk1234l1z5"));
  assert.ok(!GSTIN_PATTERN.test("36AAKFK1234L1X5"));
});

test("uploads are limited to documents, by type and size", () => {
  assert.deepEqual(checkUpload({ type: "application/pdf", size: 1000 }), { ok: true, ext: "pdf" });
  assert.equal(checkUpload({ type: "text/html", size: 1000 }).ok, false);
  assert.equal(checkUpload({ type: "image/png", size: 6 * 1024 * 1024 }).ok, false);
  assert.equal(checkUpload({ type: "image/png", size: 0 }).ok, false);
});

test("magic bytes must match the declared type", () => {
  assert.ok(sniffMatches("pdf", new TextEncoder().encode("%PDF-1.7")));
  assert.ok(!sniffMatches("pdf", new TextEncoder().encode("<html>")));
  assert.ok(sniffMatches("jpg", new Uint8Array([0xff, 0xd8, 0xff, 0xe0])));
});

test("suppliers upload exactly the vendor verification documents", () => {
  assert.deepEqual(VENDOR_DOCUMENT_TYPES, ["GST", "SHOP_LICENSE", "BANK_PROOF"]);
});

test("search text is lowercased and whitespace-collapsed", () => {
  assert.equal(buildSearchText({ name: "OPC 53  Cement", brand: null, category: "Cement", short: "50 kg" }), "opc 53 cement cement 50 kg");
});
