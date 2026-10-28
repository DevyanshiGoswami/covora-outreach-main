import { test } from "node:test";
import assert from "node:assert/strict";
import {
  campaignTotals,
  chartDays,
  humanReplies,
  inRange,
  isCalendarDay,
  rangeStart,
  rate,
  shortDate,
} from "../src/lib/metrics";
import type { Campaign, Daily } from "../src/lib/model";

const now = "2026-10-02T23:59:00Z";
const daily = (day: string, replies: number, automatic = 0): Daily => ({
  campaign_id: "campaign-a",
  day,
  sent: 10,
  contacted: 9,
  new_contacted: 8,
  unique_replies: replies,
  auto_replies: automatic,
  opportunities: 1,
});

test("UTC date ranges include exactly 7 or 30 calendar days and reject future or invalid days", () => {
  assert.equal(rangeStart("7d", now), "2026-09-26");
  assert.equal(rangeStart("30d", now), "2026-09-03");
  assert.equal(rangeStart("all", now), null);
  assert.equal(inRange("2026-09-25", "7d", now), false);
  assert.equal(inRange("2026-09-26", "7d", now), true);
  assert.equal(inRange("2026-10-02", "7d", now), true);
  assert.equal(inRange("2026-10-03", "all", now), false);
  assert.equal(inRange("2026-02-30", "all", now), false);
  assert.equal(inRange("2026-10-02", "7d", "invalid"), false);
});

test("calendar validation handles leap days and never crashes display on malformed dates", () => {
  assert.equal(isCalendarDay("2024-02-29"), true);
  assert.equal(isCalendarDay("2026-02-29"), false);
  assert.equal(isCalendarDay("2026-13-01"), false);
  assert.equal(isCalendarDay(null), false);
  assert.equal(shortDate("not a date"), "—");
});

test("human reply rate subtracts canonical automatic total once and rejects missing or nonfinite counters", () => {
  assert.equal(
    humanReplies({ unique_replies: 15, unique_auto_replies: 5 }),
    10,
  );
  assert.equal(humanReplies({ unique_replies: 3, unique_auto_replies: 5 }), 0);
  assert.equal(rate(10, 100), 0.1);
  for (const [n, d] of [
    [undefined, 100],
    [NaN, 100],
    [Infinity, 100],
    [10, undefined],
    [10, 0],
    [-1, 100],
  ])
    assert.equal(rate(n, d), 0);
});

test("daily charts retain reported replies without inventing human-only semantics", () => {
  const points = chartDays(
    [
      daily("2026-09-25", 50),
      daily("2026-10-01", 5, 2),
      daily("2026-10-01", 3, 1),
      daily("2026-10-03", 100),
    ],
    "7d",
    now,
  );
  assert.deepEqual(points, [
    { day: "2026-10-01", sent: 20, replies: 8, contacted: 16 },
  ]);
});

test("campaign totals aggregate independently of the chart date range", () => {
  const campaign: Campaign = {
    id: "a",
    client_id: "client-a",
    name: "A",
    status: "active",
    schedule: {},
    synced_at: null,
    totals: {
      contacted: 100,
      unique_replies: 15,
      unique_auto_replies: 5,
      sent: 200,
    },
  };
  assert.equal(campaignTotals([campaign]).replies, 10);
  assert.equal(campaignTotals([campaign]).contacted, 100);
  assert.equal(campaignTotals([campaign]).positive_replies, 0);
});
