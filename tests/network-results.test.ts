import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { networkTotals, networkFreshness } from "../src/lib/network-results";
import { NetworkCampaignResults } from "../src/components/network-campaign-results";
import type { NetworkCampaign, WorkspaceInfo } from "../src/lib/model";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";
import { parseSelection } from "../src/lib/model";
import { readResults } from "../src/lib/results-reader";

const now = "2026-10-20T01:00:00Z";
const campaign: NetworkCampaign = { id: "campaign-a", client_id: "client-a", name: "Holiday outreach", status: "active", totals: networkTotals({ leads: 47 }), synced_at: "2026-10-20T00:55:00Z", schedule: {} };
const render = (campaigns: NetworkCampaign[], unavailable = false) => renderToStaticMarkup(createElement(NetworkCampaignResults, { campaigns, unavailable, now }));

test("missing, invalid and negative network measurements remain unknown while reported zeros survive", () => {
  for (const value of [null, [], {}, { invitations_sent: -1, replies: NaN }, { invitations_sent: "0", messages_sent: Infinity }]) {
    const totals = networkTotals(value);
    assert.equal(totals.invitations_sent, null);
    assert.equal(totals.messages_sent, null);
  }
  assert.deepEqual(networkTotals({ leads: 47, invitations_sent: 0, invitations_accepted: 0, messages_sent: 0, replies: 0 }), { leads: 47, invitations_sent: 0, invitations_accepted: 0, messages_sent: 0, replies: 0 });
});

test("a configured campaign without an activity report shows its real audience and pending results, with no fabricated rates or meetings", () => {
  const html = render([campaign]);
  assert.match(html, /Contacts in campaign<\/dt><dd>47/);
  assert.equal((html.match(/aria-label="Not reported"/g) || []).length, 4);
  assert.match(html, /Awaiting the first activity report/);
  assert.match(html, /Active/);
  assert.doesNotMatch(html, /0%|Meetings booked|09:00|Sample results/);
  const measured = render([{ ...campaign, totals: networkTotals({ leads: 47, invitations_sent: 0 }) }]);
  assert.match(measured, /Invitations sent<\/dt><dd>0/);
  assert.equal((measured.match(/aria-label="Not reported"/g) || []).length, 3);
});

test("campaign freshness distinguishes a current sync, delay, and missing measurement safely", () => {
  assert.equal(networkFreshness(campaign.synced_at, now).stale, false);
  assert.equal(networkFreshness("2026-10-19T20:00:00Z", now).stale, true);
  assert.equal(networkFreshness(null, now).label, "Waiting for the first sync");
  assert.equal(networkFreshness("invalid", now).stale, true);
  assert.match(render([{ ...campaign, synced_at: "2026-10-19T20:00:00Z" }]), /Update delayed/);
});

test("unavailable campaign reads do not masquerade as zero activity or an empty configuration", () => {
  assert.match(render([], true), /temporarily unavailable/);
  assert.doesNotMatch(render([], true), /No LinkedIn campaigns|Invitations sent/);
  assert.match(render([]), /No LinkedIn campaigns connected yet/);
});

test("network reads are tenant scoped, projected, isolated on failure and do not touch inbox reads", async () => {
  const workspace: WorkspaceInfo = { clientId: "client-a", clientName: "Client A", role: "client_admin", enabled: true, clients: [] };
  for (const failNetwork of [false, true]) {
    const reads: { table: string; columns: string; filters: [string, unknown][] }[] = [];
    const db = { from(table: string) {
      const read = { table, columns: "", filters: [] as [string, unknown][] };
      const query = {
        select(columns: string) { read.columns = columns; return this; },
        eq(key: string, value: unknown) { read.filters.push([key, value]); return this; },
        is() { return this; }, order() { return this; }, range() { return this; }, lte() { return this; }, gte() { return this; },
        then(resolve: (value: unknown) => unknown) {
          reads.push(read);
          const rows = table === "client_outreach_network_campaigns" ? [{ ...campaign, totals: { leads: 47 } }, { ...campaign, id: "foreign", client_id: "client-b" }] : [];
          return Promise.resolve({ data: rows, error: failNetwork && table === "client_outreach_network_campaigns" ? "private failure" : null, count: 0 }).then(resolve);
        },
      };
      return query;
    } } as unknown as SupabaseClient<Database>;
    const result = await readResults(db, workspace, parseSelection({}));
    const read = reads.find(row => row.table === "client_outreach_network_campaigns")!;
    assert.deepEqual(read.filters, [["client_id", "client-a"]]);
    assert.equal(read.columns, "id,client_id,name,status,totals,schedule,synced_at");
    assert.equal(result.networkCampaigns.length, failNetwork ? 0 : 1);
    assert.equal(Boolean(result.networkUnavailable), failNetwork);
    assert.doesNotMatch(JSON.stringify(result), /private failure|foreign/);
    reads.length = 0;
    await readResults(db, workspace, parseSelection({ view: "inbox" }));
    assert.equal(reads.some(row => row.table === "client_outreach_network_campaigns"), false);
  }
});
