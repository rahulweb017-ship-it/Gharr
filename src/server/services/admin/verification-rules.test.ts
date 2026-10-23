import { test } from "node:test";
import assert from "node:assert/strict";
import { blockingMessage, evaluateRequirements } from "./verification-rules";

/** The required-documents rule gates who can sell and who is shown as verified. */

test("vendor with GST + licence but no bank proof cannot be verified", () => {
  const s = evaluateRequirements("vendor", [
    { type: "GST", status: "VERIFIED" },
    { type: "SHOP_LICENSE", status: "VERIFIED" },
  ]);
  assert.equal(s.canVerify, false);
  assert.equal(s.required, 3);
  assert.equal(s.uploaded, 2);
  assert.equal(s.verified, 2);
  assert.deepEqual(s.missing.map((m) => m.key), ["BANK_PROOF"]);
  assert.match(blockingMessage(s), /Bank account proof \(not uploaded\)/);
});

test("vendor with all three verified can be verified", () => {
  const s = evaluateRequirements("vendor", [
    { type: "GST", status: "VERIFIED" },
    { type: "SHOP_LICENSE", status: "VERIFIED" },
    { type: "BANK_PROOF", status: "VERIFIED" },
  ]);
  assert.equal(s.canVerify, true);
  assert.equal(s.blocking.length, 0);
});

test("pending uploads count as uploaded but still block", () => {
  const s = evaluateRequirements("worker", [
    { type: "PHOTO_ID", status: "PENDING" },
    { type: "AADHAAR", status: "PENDING" },
  ]);
  assert.equal(s.uploaded, 2);
  assert.equal(s.verified, 0);
  assert.equal(s.canVerify, false);
  assert.deepEqual(s.missing, []);
});

test("worker needs photo ID plus either Aadhaar or PAN", () => {
  assert.equal(
    evaluateRequirements("worker", [
      { type: "PHOTO_ID", status: "VERIFIED" },
      { type: "PAN", status: "VERIFIED" },
    ]).canVerify,
    true,
  );
  assert.equal(
    evaluateRequirements("worker", [
      { type: "AADHAAR", status: "VERIFIED" },
      { type: "PAN", status: "VERIFIED" },
    ]).canVerify,
    false,
  );
});

test("a verified alternative outranks a rejected one", () => {
  const s = evaluateRequirements("worker", [
    { type: "PHOTO_ID", status: "VERIFIED" },
    { type: "PAN", status: "REJECTED" },
    { type: "AADHAAR", status: "VERIFIED" },
  ]);
  assert.equal(s.canVerify, true);
});

test("a rejected-only requirement is blocking but not 'missing' and not uploaded", () => {
  const s = evaluateRequirements("worker", [
    { type: "PHOTO_ID", status: "REJECTED" },
    { type: "AADHAAR", status: "VERIFIED" },
  ]);
  assert.equal(s.canVerify, false);
  assert.equal(s.items[0].state, "REJECTED");
  assert.equal(s.uploaded, 1);
  assert.deepEqual(s.missing, []);
  assert.match(blockingMessage(s), /Photo ID \(rejected\)/);
});

test("irrelevant document types do not satisfy anything", () => {
  const s = evaluateRequirements("vendor", [{ type: "TRADE_CERT", status: "VERIFIED" }]);
  assert.equal(s.verified, 0);
  assert.equal(s.missing.length, 3);
});
