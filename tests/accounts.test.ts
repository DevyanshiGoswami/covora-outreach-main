import test from "node:test";
import assert from "node:assert/strict";
import { ACCOUNT_STATES, CONNECTION_FRESHNESS_MS, accountConnection, accountsFromResponse, canManageAccounts, canManageClientAccounts, confirmedAccountCheck, parseAccountCheck, parseAccountRegistration, registeredAccountFromResponse, type AccountData, type OutreachAccount } from "../src/lib/accounts";
import { AccountsServiceError, accountsApiRequest, type AccountsOperation } from "../src/lib/accounts-transport";
import { loadSettingsData } from "../src/lib/settings-data";
import { SetupServiceError } from "../src/lib/outbound-transport";
import type { OutreachRole, Workspace } from "../src/lib/access";

const clientId = "10000000-0000-4000-8000-000000000001";
const accountId = "20000000-0000-4000-8000-000000000002";
const foreign = "30000000-0000-4000-8000-000000000003";
const now = Date.parse("2026-10-04T12:00:00Z");
const checked = "2026-10-04T11:00:00Z";
const base: OutreachAccount = { id: accountId, client_id: clientId, channel: "email", email: "alex@example.com", display_name: "Alex", state: "connected", last_checked_at: checked, last_attempt_at: checked, check_error: false, last_connected_at: checked, updated_at: checked };

test("only explicit agency owners and assigned operators can manage the selected active workspace's inboxes", () => {
  const workspace: Workspace = { clientId, clientName: "Example", role: "operator", clients: [], enabled: true };
  for (const role of ["agency_owner", "operator"] as const) {
    assert.equal(canManageAccounts(role), true);
    assert.equal(canManageClientAccounts({ ...workspace, role }, clientId), true);
    assert.equal(canManageClientAccounts({ ...workspace, role }, foreign), false);
    assert.equal(canManageClientAccounts({ ...workspace, role, enabled: false }, clientId), false);
  }
  for (const role of ["client_admin", "client_member", "client_viewer", null] as (OutreachRole | null)[]) {
    assert.equal(canManageAccounts(role), false);
    assert.equal(canManageClientAccounts({ ...workspace, role }, clientId), false);
  }
});

test("registration only accepts a normalized existing sender identity and bounded Unicode display name", () => {
  assert.deepEqual(parseAccountRegistration({ clientId, email: " Alex@Example.com ", displayName: " Alex " }), { clientId, email: "alex@example.com", displayName: "Alex" });
  assert.equal(parseAccountRegistration({ clientId, email: "a@example.com", displayName: "" })?.displayName, "");
  assert.equal(parseAccountRegistration({ clientId, email: "a@example.com", displayName: "😀".repeat(100) })?.displayName.length, 200);
  for (const change of [{ clientId: "bad" }, { email: "missing-address" }, { email: "a\r\n@example.com" }, { email: `${"a".repeat(250)}@example.com` }, { displayName: "😀".repeat(101) }, { displayName: null }]) {
    assert.equal(parseAccountRegistration({ clientId, email: "a@example.com", displayName: "", ...change }), null);
  }
  assert.deepEqual(parseAccountCheck({ clientId, accountId }), { clientId, accountId });
  assert.equal(parseAccountCheck({ clientId, accountId: "bad" }), null);
  assert.equal(parseAccountCheck({ clientId: "bad", accountId }), null);
});

test("account DTOs project only neutral fields and reject mixed tenants, duplicate identities and malformed observations", () => {
  const data = accountsFromResponse({ accounts: [{ ...base, private_metadata: "must not reach UI" }], verificationAvailable: true, access_key: "hidden" }, clientId);
  assert.deepEqual(data, { accounts: [base], verificationAvailable: true });
  for (const state of ACCOUNT_STATES) assert.equal(accountsFromResponse({ accounts: [{ ...base, state }], verificationAvailable: false }, clientId).accounts[0].state, state);
  for (const change of [{ client_id: foreign }, { id: "bad" }, { channel: "linkedin" }, { state: "ready" }, { email: "bad" }, { display_name: null }, { check_error: "false" }, { last_attempt_at: undefined }, { last_checked_at: "invalid" }, { last_connected_at: "invalid" }, { updated_at: "invalid" }]) {
    assert.throws(() => accountsFromResponse({ accounts: [{ ...base, ...change }], verificationAvailable: true }, clientId));
  }
  assert.throws(() => accountsFromResponse({ accounts: [base, base], verificationAvailable: true }, clientId));
  assert.throws(() => accountsFromResponse({ accounts: [], verificationAvailable: "true" }, clientId));
  assert.throws(() => accountsFromResponse({ verificationAvailable: true }, clientId));
  assert.equal(registeredAccountFromResponse({ accountId }), accountId);
  assert.throws(() => registeredAccountFromResponse({ accountId: "bad" }));
  assert.equal(confirmedAccountCheck({ ok: true }), true);
  assert.equal(confirmedAccountCheck({ ok: "true" }), false);
});

test("failed attempts override a recent connected observation without claiming a disconnect", () => {
  assert.equal(accountConnection(base, now).label, "Connected");
  const failed = accountConnection({ ...base, check_error: true, last_attempt_at: new Date(now).toISOString() }, now);
  assert.equal(failed.label, "Check unavailable");
  assert.notEqual(failed.tone, "connected");
  assert.doesNotMatch(failed.description, /disconnected|ready|sending/);
  assert.equal(accountConnection({ ...base, state: "unverified", last_checked_at: null, last_connected_at: null }, now).label, "Not checked");
  for (const [state, label] of [["paused", "Paused"], ["maintenance", "Maintenance"], ["setting_up", "Setting up"], ["needs_attention", "Needs attention"]] as const) {
    const status = accountConnection({ ...base, state }, now);
    assert.equal(status.label, label);
    assert.notEqual(status.tone, "connected");
  }
});

test("all observations go stale at 24 hours and future or missing confirmations never produce a green connected badge", () => {
  const atLimit = new Date(now - CONNECTION_FRESHNESS_MS).toISOString();
  assert.equal(accountConnection({ ...base, last_checked_at: atLimit, last_connected_at: atLimit }, now - 1).label, "Connected");
  for (const state of ACCOUNT_STATES) {
    const status = accountConnection({ ...base, state, last_checked_at: atLimit, last_connected_at: atLimit }, now);
    assert.equal(status.label, "Check overdue");
    assert.notEqual(status.tone, "connected");
  }
  assert.notEqual(accountConnection({ ...base, last_checked_at: new Date(now + 1000).toISOString() }, now).tone, "connected");
  assert.notEqual(accountConnection({ ...base, last_connected_at: null }, now).tone, "connected");
  assert.notEqual(accountConnection({ ...base, last_connected_at: atLimit }, now).tone, "connected");
});

test("account transport pins endpoint/method, forwards only bearer auth, and never adds identity or credentials to URLs", async (context) => {
  const timeouts: number[] = [];
  context.mock.method(AbortSignal, "timeout", (duration: number) => {
    timeouts.push(duration);
    return new AbortController().signal;
  });
  const operations: [AccountsOperation, string, string][] = [
    [{ kind: "list", clientId }, `/api/outbound/accounts?clientId=${clientId}`, "GET"],
    [{ kind: "register", body: { clientId, email: "alex@example.com", displayName: "Alex" } }, "/api/outbound/accounts", "POST"],
    [{ kind: "verify", body: { clientId, accountId } }, "/api/outbound/accounts/verify", "POST"],
  ];
  for (const [operation, endpoint, method] of operations) {
    let called = false;
    const fetcher: typeof fetch = async (input, options) => {
      called = true;
      assert.equal(String(input), `https://api.outreach.example.com${endpoint}`);
      assert.equal(options?.method, method);
      assert.deepEqual(options?.headers, { Authorization: "Bearer current-user-token", "Content-Type": "application/json" });
      assert.equal(options?.cache, "no-store");
      assert.equal(options?.credentials, "omit");
      assert.equal(options?.redirect, "error");
      assert.ok(options?.signal instanceof AbortSignal);
      assert.equal(options?.body, operation.kind === "list" ? undefined : JSON.stringify(operation.body));
      assert.doesNotMatch(String(input), /token|alex|accountId/);
      return Response.json({ ok: true });
    };
    await accountsApiRequest("https://api.outreach.example.com", "current-user-token", operation, fetcher);
    assert.equal(called, true);
  }
  assert.deepEqual(timeouts, [20000, 20000, 40000]);
});

test("account transport discards external diagnostic bodies, parse errors and network errors", async () => {
  for (const fetcher of [
    ...[400, 401, 403, 429, 500].map((status) => async () => new Response("private upstream diagnostic secret", { status })),
    async () => new Response("private non-JSON secret", { status: 200 }),
    async () => { throw new Error("private URL with secret"); },
  ] as typeof fetch[]) {
    await assert.rejects(accountsApiRequest("https://api.outreach.example.com", "secret", { kind: "verify", body: { clientId, accountId } }, fetcher), (cause) => cause instanceof AccountsServiceError && !/private|secret|upstream/.test(cause.message));
  }
});

test("independent account/request failures never turn unavailable account data into a zero or hide a working setup flow", async () => {
  const accountData: AccountData = { accounts: [base], verificationAvailable: false };
  const requests = [{ id: accountId, client_id: clientId, channel: "email" as const, method: "assisted" as const, status: "requested" as const, note: "", created_at: checked, updated_at: checked }];
  const accountFailure = await loadSettingsData(clientId, { requests: async () => requests, accounts: async () => { throw new AccountsServiceError("Inboxes unavailable"); } });
  assert.deepEqual(accountFailure.requests, requests);
  assert.equal(accountFailure.error, undefined);
  assert.equal(accountFailure.accountData, null);
  assert.equal(accountFailure.accountsError, "Inboxes unavailable");
  const requestFailure = await loadSettingsData(clientId, { requests: async () => { throw new SetupServiceError("Requests unavailable"); }, accounts: async () => accountData });
  assert.deepEqual(requestFailure.accountData, accountData);
  assert.equal(requestFailure.accountsError, undefined);
  assert.equal(requestFailure.error, "Requests unavailable");
  const both = await loadSettingsData(clientId, { requests: async () => { throw new Error("private diagnostic"); }, accounts: async () => { throw new Error("private diagnostic"); } });
  assert.equal(both.accountData, null);
  assert.doesNotMatch(`${both.error} ${both.accountsError}`, /private/);
});
