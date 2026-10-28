import test from "node:test";
import assert from "node:assert/strict";
import { resolveWorkspace } from "../src/lib/access";
import { canReadEscrow, escrowFromResponse, escrowHref, parseEscrowQuery } from "../src/lib/lead-escrow";
import { escrowApiRequest } from "../src/lib/lead-escrow-transport";
import { demoLeadDirectory } from "../src/lib/demo-verified-leads";
import { leadDirectoryFromResponse, leadDirectoryHref, leadEmailLabel, leadLinkedInFirst, parseLeadDirectoryQuery, safeResearchUrl } from "../src/lib/verified-leads";

const clientId = "10000000-0000-4000-8000-000000000001";
const other = "10000000-0000-4000-8000-000000000002";
const source = () => demoLeadDirectory(clientId, parseLeadDirectoryQuery({}));
const record = () => ({ ...source().leads[1], campaignId: null, campaignName: null, listId: "90000000-0000-4000-8000-000000000001", listName: "Corporate ICP", reviewState: "escrow", reviewReason: "Needs company evidence.", reviewedAt: "2026-10-17T12:00:00Z" });
const response = () => ({ clientId, leads: [record()], total: 1, page: 1, pageSize: 36, summary: { escrow: 1, clientVisible: 1000 } });

test("escrow membership is explicit and scoped to the current company", () => {
  for (const role of ["agency_owner", "operator", "client_admin", "client_member", "client_viewer"]) {
    const workspace = resolveWorkspace([{ client_id: clientId, client_name: "Example", role }], clientId);
    assert.equal(canReadEscrow(workspace, clientId), ["agency_owner", "operator"].includes(role));
    assert.equal(canReadEscrow(workspace, other), false);
    assert.equal(canReadEscrow({ ...workspace, enabled: false }, clientId), false);
    assert.equal(canReadEscrow({ ...workspace, clients: [] }, clientId), false);
  }
});

test("escrow projects only authorized, held records and safe review metadata", () => {
  const value = response();
  const output = escrowFromResponse({ ...value, secret: "never expose", leads: [{ ...value.leads[0], secret: "never expose" }] }, clientId);
  assert.equal(output.total, 1);
  assert.equal(output.summary.clientVisible, 1000);
  assert.equal(output.leads[0].reviewState, "escrow");
  assert.equal("secret" in output.leads[0], false);
  assert.throws(() => escrowFromResponse(value, other));
  for (const update of [{ clientId: other }, { campaignId: clientId, campaignName: "Unexpected campaign", listId: null, listName: null }, { priorityRank: 1 }, { listName: null }, { reviewState: "client_visible" }, { reviewReason: 42 }, { reviewedAt: "no" }, { emailVerification: "verified", emailValidation: "risky" }]) {
    assert.throws(() => escrowFromResponse({ ...value, leads: [{ ...value.leads[0], ...update }] }, clientId));
  }
  for (const update of [{ total: 2 }, { summary: { escrow: 0, clientVisible: 1000 } }, { page: 2 }]) assert.throws(() => escrowFromResponse({ ...value, ...update }, clientId));
});

test("escrow links preserve search without exposing an alternate client visibility path", async () => {
  assert.deepEqual(parseEscrowQuery({ q: " A&B ", page: "2", visibility: "published" }), { q: "A&B", page: 2 });
  assert.deepEqual(parseEscrowQuery({ q: ["one", "two"], page: "-1" }), { q: "", page: 1 });
  const href = new URL(escrowHref(clientId, { q: "A&B", page: 2 }), "https://example.com");
  assert.equal(href.pathname, "/agency/leads");
  assert.equal(href.searchParams.get("visibility"), "escrow");
  await escrowApiRequest("https://backend.example.com", "test-private-bearer", clientId, { q: "A&B", page: 2 }, async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.pathname, "/api/outbound/leads/escrow");
    assert.equal(url.searchParams.get("clientId"), clientId);
    assert.equal(url.searchParams.get("q"), "A&B");
    assert.equal(url.searchParams.has("visibility"), false);
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer test-private-bearer");
    assert.equal(init?.cache, "no-store"); assert.equal(init?.redirect, "error"); assert.equal(init?.credentials, "omit");
    return Response.json(response());
  });
  for (const status of [401, 403, 500]) await assert.rejects(escrowApiRequest("https://backend.example.com", "token", clientId, { q: "", page: 1 }, async () => Response.json({ error: "Private diagnostic" }, { status })), (error: Error) => !error.message.includes("Private diagnostic"));
});

test("priority is default and explicit sort choices survive page links and filters", () => {
  assert.equal(parseLeadDirectoryQuery({}).sort, "priority");
  const href = leadDirectoryHref(clientId, parseLeadDirectoryQuery({ sort: "company", page: "3", email: "verified" }));
  assert.match(href, /sort=company/); assert.match(href, /page=3/); assert.match(href, /email=verified/);
});

test("research metadata remains evidence based and risky email can never gain a verified badge", () => {
  const base = source();
  const lead = { ...base.leads[1], priorityRank: 1, fitReason: "Handles employee gifting.", researchGaps: "Budget not known.", researchedAt: "2026-10-17T12:00:00Z", sourceUrls: ["https://example.com/about", "javascript:alert(1)"], emailValidation: "risky", emailVerification: "unknown", contactPreference: "linkedin_first" };
  const page = leadDirectoryFromResponse({ ...base, leads: [lead], total: 1 }, clientId);
  assert.equal(page.leads[0].priorityRank, 1);
  assert.deepEqual(page.leads[0].sourceUrls, ["https://example.com/about"]);
  assert.equal(leadEmailLabel(page.leads[0]), "Risky / catch-all");
  assert.equal(leadLinkedInFirst(page.leads[0]), true);
  for (const validation of ["risky", "unknown", "invalid"] as const) {
    assert.throws(() => leadDirectoryFromResponse({ ...base, leads: [{ ...lead, emailValidation: validation, emailVerification: "verified" }], total: 1 }, clientId));
    assert.notEqual(leadEmailLabel({ emailValidation: validation, emailVerification: "unknown" }), "Verified");
  }
  assert.equal(leadEmailLabel({ emailValidation: "valid", emailVerification: "verified" }), "Verified");
  for (const value of ["http://example.com", "https://user:pass@example.com", "https://127.0.0.1", "javascript:alert(1)"]) assert.equal(safeResearchUrl(value), null);
});
