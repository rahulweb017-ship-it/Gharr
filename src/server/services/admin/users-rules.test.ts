import { test } from "node:test";
import assert from "node:assert/strict";
import { applyRoleChange, assertNotSelf } from "./users-rules";

const ids = { actorId: "admin", targetId: "other" };

test("grant and revoke staff roles", () => {
  assert.deepEqual(applyRoleChange(["CUSTOMER"], "SUPPORT", true, ids), ["CUSTOMER", "SUPPORT"]);
  assert.deepEqual(applyRoleChange(["CUSTOMER", "ADMIN"], "ADMIN", false, ids), ["CUSTOMER"]);
  // Idempotent grant.
  assert.deepEqual(applyRoleChange(["CUSTOMER", "SUPPORT"], "SUPPORT", true, ids), ["CUSTOMER", "SUPPORT"]);
});

test("revoking the last role leaves CUSTOMER", () => {
  assert.deepEqual(applyRoleChange(["SUPPORT"], "SUPPORT", false, ids), ["CUSTOMER"]);
});

test("an admin cannot remove their own ADMIN role", () => {
  assert.throws(
    () => applyRoleChange(["ADMIN"], "ADMIN", false, { actorId: "a", targetId: "a" }),
    /own administrator role/,
  );
  // …but may add SUPPORT to themselves.
  assert.deepEqual(applyRoleChange(["ADMIN"], "SUPPORT", true, { actorId: "a", targetId: "a" }), ["SUPPORT", "ADMIN"]);
});

test("non-staff roles are refused", () => {
  assert.throws(() => applyRoleChange(["CUSTOMER"], "VENDOR" as never, true, ids), /Only ADMIN and SUPPORT/);
});

test("assertNotSelf", () => {
  assert.throws(() => assertNotSelf("a", "a", "suspend"), /can't suspend your own account/);
  assert.doesNotThrow(() => assertNotSelf("a", "b", "suspend"));
});
