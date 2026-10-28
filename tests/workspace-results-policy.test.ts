import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CampaignTable } from "../src/components/controls";
import type { Database } from "../src/lib/database.types";
import { EMPTY_DATA, parseSelection, type WorkspaceInfo } from "../src/lib/model";
import { showWorkspaceWelcome } from "../src/lib/overview";
import { readResults } from "../src/lib/results-reader";
import { reportedCampaignTotals } from "../src/lib/results-availability";
import { activeCampaignResults } from "../src/lib/workspace-results-policy";

const clientId = "6961ac6c-63ce-4e86-b02e-23656fef12bc";
const workspace: WorkspaceInfo = { clientId, clientName: "Example", enabled: true, role: "client_admin", clients: [] };
type Row = Record<string, unknown>;
function database(tables: Record<string, Row[]>) {
  const reads: { table: string; operations: unknown[][] }[] = [];
  class Query {
    operations: unknown[][] = [];
    filters: ((row: Row) => boolean)[] = [];
    start = 0;
    end = Infinity;
    head = false;
    constructor(readonly table: string) {}
    select(_columns: string, options?: { head?: boolean }) { this.head = Boolean(options?.head); return this; }
    eq(key: string, value: unknown) { this.operations.push(["eq", key, value]); this.filters.push(row => row[key] === value); return this; }
    is(key: string, value: unknown) { return this.eq(key, value); }
    in(key: string, values: unknown[]) { this.operations.push(["in", key, values]); this.filters.push(row => values.includes(row[key])); return this; }
    lte(key: string, value: string) { this.filters.push(row => String(row[key]) <= value); return this; }
    gte(key: string, value: string) { this.filters.push(row => String(row[key]) >= value); return this; }
    order() { return this; }
    range(start: number, end: number) { this.operations.push(["range", start, end]); this.start = start; this.end = end; return this; }
    then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
      reads.push({ table: this.table, operations: this.operations });
      const rows = (tables[this.table] ?? []).filter(row => this.filters.every(filter => filter(row)));
      return Promise.resolve({ data: this.head ? null : rows.slice(this.start, this.end + 1), count: rows.length, error: null }).then(resolve, reject);
    }
  }
  return { db: { from: (table: string) => new Query(table) } as unknown as SupabaseClient<Database>, reads };
}
const campaign = (id: string, status: string | null, owner = clientId): Row => ({ id, client_id: owner, name: id, status, totals: { contacted: 20, unique_replies: 5, unique_auto_replies: 1, opportunities: 2, positive_replies: 3 }, schedule: {}, synced_at: "2026-10-12T10:00:00Z" });
const daily = (id: string, owner = clientId): Row => ({ client_id: owner, campaign_id: id, day: "2026-10-01", sent: 10, contacted: 5, new_contacted: 5, unique_replies: 2, auto_replies: 1, opportunities: 1 });
const history = { id: "message", client_id: clientId, campaign_id: "paused", thread_key: "history", direction: "received", sent_at: "2026-10-01T10:00:00Z", body_text: "Keep this reply", client_read_at: null };

test("active results apply only to the exact configured workspace overview and campaigns", () => {
  for (const view of ["overview", "campaigns"] as const) assert.equal(activeCampaignResults(clientId, view), true);
  for (const view of ["inbox", "linkedin"] as const) assert.equal(activeCampaignResults(clientId, view), false);
  for (const id of [null, "other", clientId.toUpperCase(), `${clientId}0`]) assert.equal(activeCampaignResults(id, "overview"), false);
});

test("strict active filtering precedes pagination and daily activity matches the KPI campaign set", async () => {
  const drafts = Array.from({ length: 10_010 }, (_, index) => campaign(`draft-${index}`, "draft"));
  const excluded = ["paused", "completed", "unknown", "running", "ACTIVE", null].map((status, index) => campaign(`excluded-${index}`, status));
  const { db, reads } = database({
    client_outreach_campaigns: [...drafts, ...excluded, campaign("live-a", "active"), campaign("live-b", "active"), campaign("foreign", "active", "other")],
    client_outreach_campaign_daily: [...drafts.map(row => daily(String(row.id))), ...excluded.map(row => daily(String(row.id))), daily("live-a"), daily("live-b"), daily("foreign", "other")],
  });
  const data = await readResults(db, workspace, parseSelection({ range: "all" }));
  assert.deepEqual(data.campaigns.map(row => row.id), ["live-a", "live-b"]);
  assert.deepEqual(data.daily.map(row => row.campaign_id), ["live-a", "live-b"]);
  assert.deepEqual(reportedCampaignTotals(data.campaigns), { contacted: 40, replies: 8, positive_replies: 6, opportunities: 4 });
  assert.equal(data.truncated, false);
  for (const read of reads.filter(read => read.table === "client_outreach_campaigns" || read.table === "client_outreach_campaign_daily")) {
    const filterIndex = read.operations.findIndex(operation => operation[1] === (read.table === "client_outreach_campaigns" ? "status" : "campaign_id"));
    assert.ok(filterIndex >= 0 && filterIndex < read.operations.findIndex(operation => operation[0] === "range"));
  }
});

test("inactive campaign URLs cannot load analytics, sequences, schedules or campaign leads", async () => {
  for (const tab of ["analytics", "leads", "sequence", "schedule"]) {
    const { db, reads } = database({ client_outreach_campaigns: [campaign("paused", "paused"), campaign("live", "active")], client_outreach_messages: [history] });
    const data = await readResults(db, workspace, parseSelection({ view: "campaigns", campaign: "paused", tab }));
    assert.deepEqual(data.campaigns.map(row => row.id), ["live"]);
    assert.equal(data.unread, 1);
    assert.deepEqual([data.daily, data.steps, data.leads], [[], [], []]);
    assert.deepEqual(reads.map(read => read.table).sort(), ["client_outreach_campaigns", "client_outreach_messages"]);
  }
});

test("zero active campaigns skip daily reads and remain an active-campaign empty state", async () => {
  const { db, reads } = database({ client_outreach_campaigns: [campaign("draft", "draft")], client_outreach_campaign_daily: [daily("draft")] });
  const data = await readResults(db, workspace, parseSelection({}));
  assert.deepEqual(data, EMPTY_DATA);
  assert.equal(reads.some(read => read.table === "client_outreach_campaign_daily"), false);
  assert.equal(showWorkspaceWelcome(workspace, data), false);
  const html = renderToStaticMarkup(createElement(CampaignTable, { campaigns: [], selection: parseSelection({}), demo: false, activeOnly: true }));
  assert.match(html, /No active campaigns right now/);
  assert.match(html, /Previous conversations and verified leads remain available/);
  assert.doesNotMatch(html, /Campaign status|All statuses|Once your team connects/);
});

test("other workspaces retain every status and existing overview totals", async () => {
  const other = { ...workspace, clientId: "other" };
  const rows = ["active", "draft", "paused", "completed"].map(status => campaign(status, status, "other"));
  const { db, reads } = database({ client_outreach_campaigns: [...rows, campaign("target", "active")], client_outreach_campaign_daily: rows.map(row => daily(String(row.id), "other")) });
  const data = await readResults(db, other, parseSelection({ range: "all" }));
  assert.deepEqual(data.campaigns.map(row => row.status), ["active", "draft", "paused", "completed"]);
  assert.equal(data.daily.length, 4);
  assert.equal(reportedCampaignTotals(data.campaigns).contacted, 80);
  assert.equal(reads.some(read => read.operations.some(operation => operation[1] === "status" || operation[0] === "in")), false);
  assert.equal(showWorkspaceWelcome(other, EMPTY_DATA), true);
});

test("historical inbox campaigns, leads and messages stay available independently of result visibility", async () => {
  const { db, reads } = database({ client_outreach_campaigns: [campaign("paused", "paused"), campaign("live", "active")], client_outreach_messages: [history], client_outreach_leads: [{ id: "lead", client_id: clientId, campaign_id: "paused", email: "person@example.test", status: "replied" }] });
  const data = await readResults(db, workspace, parseSelection({ view: "inbox" }));
  assert.deepEqual(data.campaigns.map(row => row.id), ["paused", "live"]);
  assert.equal(data.messages[0].body_text, "Keep this reply");
  assert.equal(data.leads[0].campaign_id, "paused");
  assert.equal(data.unread, 1);
  assert.equal(reads.some(read => read.operations.some(operation => operation[1] === "status")), false);
});

test("denied and unselected workspaces never read data", async () => {
  for (const denied of [{ ...workspace, enabled: false }, { ...workspace, clientId: null }]) {
    const { db, reads } = database({});
    assert.deepEqual(await readResults(db, denied, parseSelection({})), EMPTY_DATA);
    assert.deepEqual(reads, []);
  }
});
