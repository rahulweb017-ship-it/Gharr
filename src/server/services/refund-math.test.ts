import { test } from "node:test";
import assert from "node:assert/strict";
import { refundOutcome, refundableRemaining } from "./refund-math";

/** Refund arithmetic decides what money goes back, so each edge is pinned. */

test("refundOutcome: nothing refunded leaves the payment captured", () => {
  assert.equal(refundOutcome(10_000, 0), "CAPTURED");
});

test("refundOutcome: part refunded is partial", () => {
  assert.equal(refundOutcome(10_000, 1), "PARTIALLY_REFUNDED");
  assert.equal(refundOutcome(10_000, 9_999), "PARTIALLY_REFUNDED");
});

test("refundOutcome: the full amount (or more) is fully refunded", () => {
  assert.equal(refundOutcome(10_000, 10_000), "REFUNDED");
  assert.equal(refundOutcome(10_000, 10_001), "REFUNDED");
});

test("refundOutcome: negative input is treated as nothing refunded", () => {
  assert.equal(refundOutcome(10_000, -5), "CAPTURED");
});

test("refundableRemaining: whole payment when no part is given", () => {
  assert.equal(refundableRemaining({ capturedPaise: 50_000, paymentRefundedPaise: 12_000 }), 38_000);
});

test("refundableRemaining: an order is capped by its own total within a group payment", () => {
  // ₹500 captured for two vendors; this order is ₹200 of it.
  assert.equal(
    refundableRemaining({ capturedPaise: 50_000, paymentRefundedPaise: 0, partTotalPaise: 20_000 }),
    20_000,
  );
  // ₹150 of it already went back.
  assert.equal(
    refundableRemaining({ capturedPaise: 50_000, paymentRefundedPaise: 15_000, partTotalPaise: 20_000, partRefundedPaise: 15_000 }),
    5_000,
  );
});

test("refundableRemaining: the payment's remainder caps the part when siblings drained it", () => {
  // Other orders in the group took ₹450 of ₹500 back; this ₹200 order can get ₹50.
  assert.equal(
    refundableRemaining({ capturedPaise: 50_000, paymentRefundedPaise: 45_000, partTotalPaise: 20_000 }),
    5_000,
  );
});

test("refundableRemaining: never negative", () => {
  assert.equal(refundableRemaining({ capturedPaise: 10_000, paymentRefundedPaise: 12_000 }), 0);
  assert.equal(
    refundableRemaining({ capturedPaise: 10_000, paymentRefundedPaise: 0, partTotalPaise: 5_000, partRefundedPaise: 6_000 }),
    0,
  );
});
