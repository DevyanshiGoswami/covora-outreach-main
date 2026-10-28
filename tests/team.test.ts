import test from "node:test";
import assert from "node:assert/strict";
import { createdInvitationFromResponse, invitationAccess, canManageTeam, manageableRoles, canManageMember, parseInviteInput, parseMemberUpdate, teamFromResponse, invitationFromResponse } from "../src/lib/team";
import { safeLoginNext, captureInvitation, clearInvitation, invitationLink, invitationStorageKey } from "../src/lib/invitation-session";
import { teamApiRequest } from "../src/lib/team-transport";
const clientId = "10000000-0000-4000-8000-000000000001";
const userId = "10000000-0000-4000-8000-000000000002";
const token = "a".repeat(64);
const projectUrl = "https://new-project.supabase.co";
const storageKey = invitationStorageKey(projectUrl);

test("team managers and target roles never infer agency authority", () => {
  for (const role of ["operator", "client_member", "client_viewer", null] as const) assert.equal(canManageTeam(role), false);
  assert.deepEqual(manageableRoles("client_admin"), ["client_member", "client_viewer"]);
  assert.equal(canManageMember("client_admin", "operator"), false);
  assert.equal(canManageMember("client_admin", "client_admin"), false);
  assert.equal(canManageMember("agency_owner", "client_admin"), true);
  assert.equal(manageableRoles("agency_owner").includes("agency_owner" as never), false);
});
test("team inputs normalize email and require precise role, state and expected version", () => {
  assert.deepEqual(parseInviteInput({ clientId, email: " Person@Example.com ", role: "client_member" }), { clientId, email: "person@example.com", role: "client_member" });
  assert.equal(parseInviteInput({ clientId, email: "a@example.com", role: "agency_owner" }), null);
  const input = { clientId, userId, role: "client_viewer", state: "suspended", expectedVersion: "4" };
  assert.equal(parseMemberUpdate(input)?.expectedVersion, 4);
  for (const expectedVersion of ["4oops", "1.5", "-1", "0", String(Number.MAX_SAFE_INTEGER + 1)]) assert.equal(parseMemberUpdate({ ...input, expectedVersion }), null);
  assert.equal(parseMemberUpdate({ ...input, state: "deleted" }), null);
});
test("team DTOs strip secrets and fail closed on tenant and unknown role", () => {
  const member = { client_id: clientId, user_id: userId, email: null, role: "client_member", state: "active", version: 1, token };
  const invite = { id: userId, client_id: clientId, email: "person@example.com", role: "client_viewer", status: "expired", expires_at: "2026-10-10T10:00:00Z", created_at: "2026-10-03T10:00:00Z", token_hash: token };
  const result = teamFromResponse({ members: [member], invitations: [invite] }, clientId);
  assert.equal("token" in result.members[0], false);
  assert.equal("token_hash" in result.invitations[0], false);
  assert.throws(() => teamFromResponse({ members: [{ ...member, client_id: userId }], invitations: [] }, clientId));
  assert.throws(() => teamFromResponse({ members: [{ ...member, role: "agency_owner" }], invitations: [] }, clientId));
  assert.throws(() => invitationFromResponse({ invitation: { id: userId, clientId, clientName: "Company", role: "client_member", expiresAt: invite.expires_at, status: "revoked" } }));
});
test("invitation sign-in preserves only the exact invitation path and never its secret", () => {
  assert.equal(safeLoginNext("/invite"), "/invite");
  for (const value of [undefined, "/invite?token=x", "/invite#token=x", "//example.com", "https://example.com", "/invite/", ["/invite"]]) assert.equal(safeLoginNext(value), "/");
});
test("invitation capture strips fragment, keeps token only per tab, and clears stale tokens on invalid links", () => {
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
  const replaced: string[] = [];
  assert.equal(captureInvitation(`#token=${token}`, storage, (path) => replaced.push(path), projectUrl), token);
  assert.deepEqual(replaced, ["/invite"]);
  assert.equal(storage.getItem(storageKey), token);
  assert.equal(captureInvitation("", storage, () => assert.fail(), projectUrl), token);
  assert.equal(captureInvitation("#token=invalid", storage, (path) => replaced.push(path), projectUrl), "");
  assert.equal(storage.getItem(storageKey), null);
  storage.setItem(storageKey, token);
  clearInvitation(storage, projectUrl);
  assert.equal(storage.getItem(storageKey), null);
  assert.equal(invitationLink("https://outreach.example.com", token), `https://outreach.example.com/invite#token=${token}`);
});
test("team transport keeps invite tokens out of URLs, forbids redirects and sanitizes errors", async () => {
  let captured: { url: string; init: RequestInit } | undefined;
  const fetcher: typeof fetch = async (input, init) => { captured = { url: String(input), init: init! }; return Response.json({ ok: true }); };
  await teamApiRequest("https://api.outreach.example.com", "user-session", { kind: "inspect", body: { token } }, fetcher);
  assert.equal(captured?.url, "https://api.outreach.example.com/api/outbound/invitations/inspect");
  assert.equal(captured?.url.includes(token), false);
  assert.equal(captured?.init.redirect, "error");
  assert.equal(captured?.init.cache, "no-store");
  assert.deepEqual(JSON.parse(String(captured?.init.body)), { token });
  await assert.rejects(teamApiRequest("https://api.outreach.example.com", "user-session", { kind: "inspect", body: { token } }, async () => new Response(token, { status: 403 })), (error) => error instanceof Error && !error.message.includes(token));
});


test("invitation fragments are removed even when tab storage rejects the secret", () => {
  const replaced: string[] = [];
  const storage = { getItem: () => null, setItem: () => { throw new Error("Storage unavailable"); }, removeItem: () => {} };
  assert.throws(() => captureInvitation(`#token=${token}`, storage, (path) => replaced.push(path), projectUrl));
  assert.deepEqual(replaced, ["/invite"]);
});

test("invitation tab storage never carries a legacy or previous-project token into a new project", () => {
  const previousUrl = "https://previous-project.supabase.co";
  const data = new Map([["covora.outbound.invitation", token], [invitationStorageKey(previousUrl), token]]);
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
  assert.equal(captureInvitation("", storage, () => assert.fail(), projectUrl), "");
  assert.equal(data.has("covora.outbound.invitation"), false);
  assert.equal(data.get(invitationStorageKey(previousUrl)), token);
  assert.equal(captureInvitation(`#token=${token}`, storage, () => {}, projectUrl), token);
  assert.equal(captureInvitation("", storage, () => assert.fail(), projectUrl), token);
  clearInvitation(storage, projectUrl);
  assert.equal(data.has(storageKey), false);
  assert.equal(data.get(invitationStorageKey(previousUrl)), token);
});

test("team transport uses the exact method and endpoint for every command", async () => {
  const cases = [
    [{ kind: "list", clientId }, "GET", `/api/outbound/team?clientId=${clientId}`],
    [{ kind: "create", body: { clientId, email: "person@example.com", role: "client_member" } }, "POST", "/api/outbound/team/invitations"],
    [{ kind: "revoke", body: { invitationId: userId } }, "DELETE", "/api/outbound/team/invitations"],
    [{ kind: "member", body: { clientId, userId, role: "client_viewer", state: "revoked", expectedVersion: 2 } }, "PATCH", "/api/outbound/team/members"],
    [{ kind: "accept", body: { token } }, "POST", "/api/outbound/invitations/accept"],
  ] as const;
  for (const [operation, method, endpoint] of cases) {
    await teamApiRequest("https://api.outreach.example.com", "user-session", operation, async (input, init) => {
      assert.equal(String(input), `https://api.outreach.example.com${endpoint}`);
      assert.equal(init?.method, method);
      assert.equal(init?.credentials, "omit");
      if (operation.kind === "list") assert.equal(init?.body, undefined);
      else assert.deepEqual(JSON.parse(String(init?.body)), operation.body);
      return Response.json({ ok: true });
    });
  }
});


test("accepted invitation presentation never advertises a historical offered role or a fresh grant", () => {
  for (const role of ["client_admin", "client_member", "client_viewer", "operator"] as const) {
    assert.deepEqual(invitationAccess({ role, status: "accepted" }), { offeredRole: null, acceptanceRequired: false });
    assert.deepEqual(invitationAccess({ role, status: "pending" }), { offeredRole: role, acceptanceRequired: true });
  }
});

test("new teammate login tokens are validated and returned only with creation results", () => {
  const input = { invitationId: "10000000-0000-4000-8000-000000000001", token: "a".repeat(64), expiresAt: "2026-10-20T00:00:00Z", loginToken: "b".repeat(64) };
  assert.equal(createdInvitationFromResponse(input).loginToken, input.loginToken);
  assert.equal(createdInvitationFromResponse({ ...input, loginToken: null }).loginToken, null);
  assert.throws(() => createdInvitationFromResponse({ ...input, loginToken: "bad&token=other" }));
});
