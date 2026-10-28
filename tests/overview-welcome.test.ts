import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkspaceWelcome } from "../src/components/workspace-welcome";
import { showWorkspaceWelcome } from "../src/lib/overview";
import { EMPTY_DATA, type ResultsData, type WorkspaceInfo } from "../src/lib/model";

const clientId = "10000000-0000-4000-8000-000000000001";
const workspace: WorkspaceInfo = { clientId, clientName: "Example & Co", role: "client_admin", enabled: true, clients: [] };
const render = (value: WorkspaceInfo, demo = false) => renderToStaticMarkup(createElement(WorkspaceWelcome, { workspace: value, demo }));

test("welcome excludes denied, partial and existing workspaces, including zero-activity campaigns", () => {
  assert.equal(showWorkspaceWelcome(workspace, EMPTY_DATA), true);
  for (const value of [{ ...workspace, enabled: false }, { ...workspace, clientId: null }, { ...workspace, role: null }]) {
    assert.equal(showWorkspaceWelcome(value, EMPTY_DATA), false);
    assert.equal(render(value), "");
  }
  assert.equal(showWorkspaceWelcome(workspace, { ...EMPTY_DATA, truncated: true }), false);
  assert.equal(showWorkspaceWelcome(workspace, { ...EMPTY_DATA, unread: 1 }), false);
  assert.equal(showWorkspaceWelcome(workspace, { ...EMPTY_DATA, networkUnavailable: true }), false);
  const existing: Partial<ResultsData> = {
    campaigns: [{ id: "campaign", client_id: clientId, name: "Draft campaign", status: "draft", totals: {}, schedule: {}, synced_at: null }],
    daily: [{ campaign_id: "historical", day: "2026-09-01", sent: 1, contacted: 1, new_contacted: 1, unique_replies: 0, auto_replies: 0, opportunities: 0 }],
    steps: [{ campaign_id: "historical", step: 1, variant: 0, subject: "Hello", body_text: "Hello", delay_days: 0, stats: {} }],
    leads: [{ id: "lead", campaign_id: "historical", email: "lead@example.test", first_name: null, last_name: null, company: null, status: "not_contacted", last_step: null, reply_count: 0, interest: null, last_activity_at: null }],
    messages: [{ id: "message", campaign_id: "historical", thread_key: "thread", direction: "sent", lead_email: "lead@example.test", from_email: "team@example.test", to_email: "lead@example.test", subject: "Hello", body_text: "Hello", sent_at: "2026-09-01T00:00:00Z", interest: null, is_auto_reply: false, client_read_at: null }],
    linkedin: [{ client_id: clientId, day: "2026-09-01", source: "dm_log", sent: 1, replied: 0, meeting_booked: 0 }],
    networkCampaigns: [{ id: "network", client_id: clientId, name: "Connections", status: "active", totals: { leads: 47, invitations_sent: null, invitations_accepted: null, messages_sent: null, replies: null }, schedule: {}, synced_at: null }],
  };
  for (const [key, records] of Object.entries(existing)) {
    assert.equal(showWorkspaceWelcome(workspace, { ...EMPTY_DATA, [key]: records }), false, `${key} remains in the results flow`);
  }
});

test("welcome presents three preparation steps and preserves the authorized company in each destination", () => {
  const html = render(workspace);
  assert.match(html, /Welcome, Example &amp; Co\./);
  assert.equal((html.match(/<li>/g) || []).length, 3);
  assert.match(html, /Account setup/);
  assert.match(html, /Campaign preparation/);
  assert.match(html, /Conversations and results/);
  assert.match(html, new RegExp(`href="/settings\\?client=${clientId}"`));
  assert.match(html, new RegExp(`href="/settings/team\\?client=${clientId}"`));
  assert.doesNotMatch(html, /aria-label="All-time campaign results"|<svg[^>]+role="img"|Connected|Complete|Ready to send/);
  assert.match(render(workspace, true), new RegExp(`href="/demo/settings\\?client=${clientId}"`));
});

test("welcome team link follows existing manager permissions without denying read-only account visibility", () => {
  for (const role of ["client_admin", "agency_owner", "operator", "client_member", "client_viewer"] as const) {
    const html = render({ ...workspace, role });
    assert.equal(html.includes("Manage team"), ["client_admin", "agency_owner"].includes(role), role);
    assert.ok(html.includes(`href="/settings?client=${clientId}"`), role);
  }
});
