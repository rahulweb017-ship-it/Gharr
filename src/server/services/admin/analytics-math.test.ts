import { test } from "node:test";
import assert from "node:assert/strict";
import { averagePaise, dayKeys, fillDaily, istDayKey, parseRange, rangeStart, ratio } from "./analytics-math";

test("istDayKey uses the IST calendar day", () => {
  // 19:00 UTC on 1 Sep is 00:30 IST on 2 Sep.
  assert.equal(istDayKey(new Date("2026-09-01T19:00:00Z")), "2026-09-02");
  assert.equal(istDayKey(new Date("2026-09-01T18:00:00Z")), "2026-09-01");
});

test("rangeStart opens at IST midnight, days-1 days back", () => {
  const now = new Date("2026-09-25T10:00:00+05:30");
  assert.equal(rangeStart(1, now).toISOString(), "2026-09-24T18:30:00.000Z");
  assert.equal(rangeStart(7, now).toISOString(), "2026-09-18T18:30:00.000Z");
});

test("dayKeys lists every day oldest first", () => {
  const now = new Date("2026-09-25T10:00:00+05:30");
  const keys = dayKeys(rangeStart(7, now), 7);
  assert.equal(keys.length, 7);
  assert.equal(keys[0], "2026-09-19");
  assert.equal(keys[6], "2026-09-25");
});

test("fillDaily zero-fills missing days", () => {
  const out = fillDaily(["a", "b", "c"], [{ day: "b", n: 2 }], [{ day: "c", paise: 500 }]);
  assert.deepEqual(out, [
    { day: "a", orders: 0, gmvPaise: 0 },
    { day: "b", orders: 2, gmvPaise: 0 },
    { day: "c", orders: 0, gmvPaise: 500 },
  ]);
});

test("ratio and average are null on a zero denominator", () => {
  assert.equal(ratio(1, 0), null);
  assert.equal(ratio(1, 4), 0.25);
  assert.equal(averagePaise(0, 0), null);
  assert.equal(averagePaise(1001, 2), 501);
});

test("parseRange falls back to 30", () => {
  assert.equal(parseRange("7"), 7);
  assert.equal(parseRange("90"), 90);
  assert.equal(parseRange("45"), 30);
  assert.equal(parseRange(undefined), 30);
});
