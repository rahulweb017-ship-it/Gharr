import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CreateTicketInput,
  TicketUpdateInput,
  resolvedAtFor,
  statusAfterCustomerReply,
  statusAfterStaffReply,
  ticketAge,
} from "./support";

test("customer reply reopens a resolved ticket only", () => {
  assert.equal(statusAfterCustomerReply("RESOLVED"), "OPEN");
  assert.equal(statusAfterCustomerReply("IN_PROGRESS"), "IN_PROGRESS");
  assert.equal(statusAfterCustomerReply("OPEN"), "OPEN");
  assert.equal(statusAfterCustomerReply("CLOSED"), "CLOSED");
});

test("staff reply picks up an open ticket", () => {
  assert.equal(statusAfterStaffReply("OPEN"), "IN_PROGRESS");
  assert.equal(statusAfterStaffReply("RESOLVED"), "RESOLVED");
});

test("resolvedAt is set once, kept on close, cleared on reopen", () => {
  const now = new Date("2026-09-25T10:00:00Z");
  const earlier = new Date("2026-09-20T10:00:00Z");
  assert.equal(resolvedAtFor("RESOLVED", null, now), now);
  assert.equal(resolvedAtFor("CLOSED", earlier, now), earlier);
  assert.equal(resolvedAtFor("OPEN", earlier, now), null);
  assert.equal(resolvedAtFor("IN_PROGRESS", null, now), null);
});

test("ticketAge escalates tone with age", () => {
  const now = new Date("2026-09-25T10:00:00Z");
  const ago = (h: number) => new Date(now.getTime() - h * 3_600_000);
  assert.deepEqual(ticketAge(ago(0.5), now), { label: "30m", tone: "neutral" });
  assert.deepEqual(ticketAge(ago(5), now), { label: "5h", tone: "neutral" });
  assert.deepEqual(ticketAge(ago(30), now), { label: "30h", tone: "warning" });
  assert.deepEqual(ticketAge(ago(72), now), { label: "3d", tone: "danger" });
});

test("create input trims and blanks optional ids", () => {
  const parsed = CreateTicketInput.parse({ subject: "  Late delivery ", message: "Cement did not arrive today", orderId: "" });
  assert.equal(parsed.subject, "Late delivery");
  assert.equal(parsed.orderId, undefined);
  assert.equal(parsed.category, "OTHER");
});

test("update input needs at least one field", () => {
  assert.equal(TicketUpdateInput.safeParse({}).success, false);
  assert.equal(TicketUpdateInput.safeParse({ assignedToId: null }).success, true);
});
