import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";
import { resolveWorkspace, type Workspace } from "../src/lib/access";
import { authorizedAgencyClients, readAgencyPortfolio } from "../src/lib/agency-portfolio";

const a = "10000000-0000-4000-8000-000000000001";
const b = "10000000-0000-4000-8000-000000000002";
const c = "10000000-0000-4000-8000-000000000003";
type Row = Record<string, unknown>;
type Read = { table: string; columns: string; scope: unknown; head: boolean; count: string | undefined };
function database(tables: Record<string, Row[]>, failures: { table: string; scope: string; reject?: boolean }[] = []) {
  const reads: Read[] = [];
  class Query {
    columns = "";
    head = false;
    count: string | undefined;
    scope: unknown;
    filters: ((row: Row) => boolean)[] = [];
    take = Infinity;
    ordering: { key: string; ascending: boolean; nullsFirst: boolean } | null = null;
    constructor(readonly table: string) {}
    select(columns: string, options?: { head?: boolean; count?: string }) { this.columns = columns; this.head = Boolean(options?.head); this.count = options?.count; return this; }
    eq(key: string, value: unknown) { if (key === "client_id") this.scope = value; this.filters.push((row) => row[key] === value); return this; }
    is(key: string, value: unknown) { return this.eq(key, value); }
    order(key: string, options: { ascending: boolean; nullsFirst: boolean }) { this.ordering = { key, ...options }; return this; }
    limit(value: number) { this.take = value; return this; }
    then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
      reads.push({ table: this.table, columns: this.columns, scope: this.scope, head: this.head, count: this.count });
      const failure = failures.find((item) => item.table === this.table && item.scope === this.scope);
      if (failure?.reject) return Promise.reject(new Error("Private service detail")).then(resolve, reject);
      const rows = (tables[this.table] ?? []).filter((row) => this.filters.every((filter) => filter(row)));
      const ordering = this.ordering;
      if (ordering) rows.sort((left, right) => {
        if (left[ordering.key] === null) return ordering.nullsFirst ? -1 : 1;
        if (right[ordering.key] === null) return ordering.nullsFirst ? 1 : -1;
        return String(left[ordering.key]).localeCompare(String(right[ordering.key])) * (ordering.ascending ? 1 : -1);
      });
      return Promise.resolve({ data: this.head ? null : rows.slice(0, this.take), count: this.head ? rows.length : null, error: failure ? { message: "Private service detail" } : null }).then(resolve, reject);
    }
  }
  return { db: { from: (table: string) => new Query(table) } as unknown as SupabaseClient<Database>, reads };
}
const workspace = (role: string, extra: Parameters<typeof resolveWorkspace>[0] = []): Workspace => resolveWorkspace([
  { client_id: a, client_name: "Assigned", role }, ...extra,
]);
const campaign = (id: string, client_id: string, status: string, synced_at: string | null) => ({ id, client_id, status, synced_at });
const message = (id: string, client_id: string, direction = "received", client_read_at: string | null = null) => ({ id, client_id, direction, client_read_at });

test("client roles and disabled or invalid company selection cannot produce admin reads", async () => {
  for (const role of ["client_admin", "client_member", "client_viewer", "admin"]) {
    const { db, reads } = database({});
    assert.deepEqual(await readAgencyPortfolio(db, workspace(role)), []);
    assert.deepEqual(reads, []);
  }
  const { db, reads } = database({});
  const allowed = workspace("operator");
  assert.deepEqual(authorizedAgencyClients({ ...allowed, enabled: false, clientId: null }), []);
  assert.deepEqual(await readAgencyPortfolio(db, { ...allowed, enabled: false, clientId: null }), []);
  assert.deepEqual(reads, []);
});

test("directory-only reads retain authorized clients and perform no metric queries", async () => {
  const { db, reads } = database({});
  const allowed = workspace("agency_owner", [{ client_id: b, client_name: "Second", role: "agency_owner" }]);
  const result = await readAgencyPortfolio(db, allowed, { includeMetrics: false });
  assert.deepEqual(result.map(client => client.id), [a, b]);
  assert.ok(result.every(client => client.activeCampaigns === null && client.receivedEmails === null));
  assert.deepEqual(reads, []);
  const assigned = workspace("operator", [{ client_id: b, client_name: "Member only", role: "client_member" }]);
  assert.deepEqual((await readAgencyPortfolio(db, assigned, { includeMetrics: false })).map(client => client.id), [a]);
  assert.deepEqual(await readAgencyPortfolio(db, workspace("client_admin"), { includeMetrics: false }), []);
  assert.deepEqual(await readAgencyPortfolio(db, { ...allowed, enabled: false }, { includeMetrics: false }), []);
  assert.deepEqual(reads, []);
});

test("operators read only assigned memberships and each database read retains exact tenant scope", async () => {
  const { db, reads } = database({
    client_outreach_campaigns: [campaign("one", a, "active", "2026-01-02T12:00:00Z"), campaign("two", a, "paused", "2026-01-03T12:00:00Z"), campaign("foreign", b, "active", "2026-01-04T12:00:00Z")],
    client_outreach_messages: [message("unread", a), message("read", a, "received", "2026-01-02T12:00:00Z"), message("sent", a, "sent"), message("foreign", b)],
  });
  const result = await readAgencyPortfolio(db, workspace("operator", [{ client_id: b, client_name: "Client only", role: "client_admin" }]));
  assert.equal(result.length, 1);
  assert.equal(result[0].activeCampaigns, 1);
  assert.equal(result[0].receivedEmails, 2);
  assert.equal(result[0].oldestCampaignSync, "2026-01-02T12:00:00Z");
  assert.equal(result[0].unavailable, false);
  assert.equal(reads.length, 3);
  assert.ok(reads.every((read) => read.scope === a));
  assert.ok(reads.every((read) => ["id", "synced_at"].includes(read.columns)));
  assert.ok(reads.filter((read) => read.head).every((read) => read.count === "exact"));
});

test("owner portfolio separates previews and keeps exact active counts beyond the page limit", async () => {
  const { db, reads } = database({
    client_outreach_campaigns: Array.from({ length: 1200 }, (_, index) => campaign(String(index), a, "active", "2026-01-02T12:00:00Z")),
  });
  const result = await readAgencyPortfolio(db, workspace("agency_owner", [
    { client_id: b, client_name: "Preview", role: "agency_owner", presentation_mode: "preview" },
    { client_id: c, client_name: "Other live", role: "agency_owner" },
  ]));
  assert.equal(result.length, 3);
  assert.equal(result[0].activeCampaigns, 1200);
  assert.equal(result[1].activeCampaigns, null);
  assert.equal(result[1].receivedEmails, null);
  assert.equal(result[1].unavailable, false);
  assert.equal(result[2].activeCampaigns, 0);
  assert.ok(reads.every((read) => read.scope !== b));
});

test("partial database failures preserve independent counts and never become zero or disclose errors", async () => {
  for (const reject of [false, true]) {
    const { db } = database({ client_outreach_messages: [message("one", a)] }, [{ table: "client_outreach_campaigns", scope: a, reject }]);
    const [result] = await readAgencyPortfolio(db, workspace("agency_owner"));
    assert.equal(result.activeCampaigns, null);
    assert.equal(result.oldestCampaignSync, null);
    assert.equal(result.receivedEmails, 1);
    assert.equal(result.unavailable, true);
    assert.ok(!JSON.stringify(result).includes("Private service detail"));
  }
});

test("oldest active metadata time never hides an unsynced campaign or accepts a future timestamp", async () => {
  for (const timestamp of [null, "invalid", "2999-01-02T12:00:00Z"]) {
    const { db } = database({ client_outreach_campaigns: [campaign("one", a, "active", timestamp)] });
    assert.equal((await readAgencyPortfolio(db, workspace("operator")))[0].oldestCampaignSync, null);
  }
  const { db } = database({ client_outreach_campaigns: [campaign("one", a, "active", "2026-01-02T12:00:00Z"), campaign("two", a, "active", null)] });
  assert.equal((await readAgencyPortfolio(db, workspace("operator")))[0].oldestCampaignSync, null);
});
