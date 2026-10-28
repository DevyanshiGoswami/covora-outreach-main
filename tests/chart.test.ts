import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ActivityChart } from "../src/components/chart";
import type { Daily } from "../src/lib/model";

test("sparse chart points preserve elapsed calendar time instead of equal record spacing", () => {
  const daily = ["2026-10-01", "2026-10-02", "2026-10-30"].map((day) => ({
    day,
    campaign_id: "a",
    sent: 20,
    contacted: 10,
    new_contacted: 5,
    unique_replies: 2,
    auto_replies: 0,
    opportunities: 0,
  })) satisfies Daily[];
  const html = renderToStaticMarkup(
    createElement(ActivityChart, { daily, range: "all", now: "2026-10-30" }),
  );
  const charts = [...html.matchAll(/<svg\b[^>]*>([\s\S]*?)<\/svg>/g)];
  assert.equal(charts.length, 2, "Both wide and narrow layouts preserve calendar spacing");
  for (const [, chart] of charts) {
    const xs = [...chart.matchAll(/<circle[^>]*cx="([\d.]+)"/g)].map((m) => Number(m[1]));
    assert.equal(xs.length, 3);
    assert.ok(Math.abs((xs[1] - xs[0]) / (xs[2] - xs[0]) - 1 / 29) < 0.00001);
  }
});
