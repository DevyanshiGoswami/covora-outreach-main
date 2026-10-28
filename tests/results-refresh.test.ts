import assert from "node:assert/strict";
import test from "node:test";
import { createResultsRefresher, pauseResultsRefresh, RESULTS_REFRESH_MS, refreshLiveResults } from "../src/lib/results-refresh";

test("every live result surface refreshes independently of campaign filtering, without refreshing inboxes or previews", () => {
  for (const view of ["overview", "campaigns", "linkedin"] as const) {
    assert.equal(refreshLiveResults(view, false, false), true);
    assert.equal(refreshLiveResults(view, true, false), false);
    assert.equal(refreshLiveResults(view, false, true), false);
  }
  assert.equal(refreshLiveResults("inbox", false, false), false);
});

test("results refresh runs once a minute only while visible and outside editing or dialogs", () => {
  assert.equal(RESULTS_REFRESH_MS, 60_000);
  assert.equal(pauseResultsRefresh(true, false), false);
  for (const [visible, editing] of [[false, false], [false, true], [true, true]]) assert.equal(pauseResultsRefresh(visible, editing), true);
});

test("timer and focus events share one pending route transition", () => {
  let calls = 0;
  const refresher = createResultsRefresher({ paused: () => false, refresh: () => { calls++; } });
  refresher.refresh(); refresher.refresh(); refresher.refresh();
  assert.equal(calls, 1);
  refresher.settle(); refresher.refresh();
  assert.equal(calls, 2);
});

test("hidden pages skip reads, visibility restoration resumes, and unmount makes future callbacks inert", () => {
  let visible = false, editing = false, calls = 0;
  const refresher = createResultsRefresher({ paused: () => pauseResultsRefresh(visible, editing), refresh: () => { calls++; } });
  refresher.refresh(); assert.equal(calls, 0);
  visible = true; editing = true; refresher.refresh(); assert.equal(calls, 0);
  editing = false; refresher.refresh(); assert.equal(calls, 1);
  visible = false; refresher.settle(); refresher.refresh(); assert.equal(calls, 1);
  visible = true; refresher.refresh(); assert.equal(calls, 2);
  refresher.dispose(); refresher.settle(); refresher.refresh(); assert.equal(calls, 2);
});

test("synchronous refresh failures release the lock for a later update", () => {
  let calls = 0;
  const refresher = createResultsRefresher({ paused: () => false, refresh: () => { calls++; if (calls === 1) throw new Error("unavailable"); } });
  refresher.refresh(); refresher.refresh(); assert.equal(calls, 2);
});
