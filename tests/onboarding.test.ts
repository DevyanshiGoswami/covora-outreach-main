import test from "node:test";
import assert from "node:assert/strict";
import { canStartEmailConnection, isPersonalGmail, connectionReviewRetryAt, connectionReviewMessage, connectionRequestMessage, connectionFailureMessage, canManageConnections, googleConsentUrl, emailConsentUrl, consentProviderName, connectionOperation, peopleFromResponse, managedConnectionsFromResponse } from "../src/lib/onboarding";
import { captureAccountInvitation, markAccountActivated, clearAccountActivation } from "../src/lib/onboarding-invitation";
import { clearInvitation } from "../src/lib/invitation-session";
import type { Workspace, OutreachRole } from "../src/lib/access";
const id = "10000000-0000-4000-8000-000000000001";
const other = "20000000-0000-4000-8000-000000000002";
test('workspace assignment DTO preserves selected names and disabled state without private fields', () => {
  const option = { id: 'managed-example', label: 'Sales workspace', channel: 'email', keyConfigured: true };
  const assignment = { optionId: option.id, label: option.label, enabled: false };
  const data = { status: { email: false, linkedin: false }, options: [option], assignments: { email: { ...assignment, credentialRef: 'private-ref', workspaceId: 'private-id' }, linkedin: null } };
  const result = managedConnectionsFromResponse(data);
  assert.deepEqual(result.assignments, { email: assignment, linkedin: null });
  assert.ok(!JSON.stringify(result).includes('private'));
  assert.throws(() => managedConnectionsFromResponse({ ...data, assignments: { ...data.assignments, linkedin: assignment } }));
  assert.throws(() => managedConnectionsFromResponse({ ...data, assignments: { ...data.assignments, email: { ...assignment, enabled: 'true' } } }));
  assert.equal(managedConnectionsFromResponse({ status: data.status, options: [] }).assignments, undefined);
});
test("connection management requires a live selected workspace and an authorized role", () => {
  for (const role of ["agency_owner", "operator", "client_admin", "client_member", "client_viewer"] as OutreachRole[]) {
    const workspace: Workspace = { clientId: id, clientName: "Test", role, clients: [], enabled: true, presentationMode: "live" };
    assert.equal(canManageConnections(workspace, id), ["agency_owner", "operator", "client_admin"].includes(role));
    assert.equal(canManageConnections(workspace, other), false);
    assert.equal(canManageConnections({ ...workspace, presentationMode: "preview" }, id), false);
    assert.equal(canManageConnections({ ...workspace, enabled: false }, id), false);
  }
});
test("only Google consent URLs with state can be displayed", () => {
  assert.equal(googleConsentUrl(null), null);
  assert.equal(googleConsentUrl("https://accounts.google.com/o/oauth2/v2/auth?state=example"), "https://accounts.google.com/o/oauth2/v2/auth?state=example");
  for (const value of ["javascript:alert(1)", "https://accounts.google.com.evil.test/o/oauth2/auth?state=x", "https://accounts.google.com/o/oauth2/auth", "http://accounts.google.com/o/oauth2/auth?state=x", "https://user:pass@accounts.google.com/o/oauth2/auth?state=x", "https://accounts.google.com/other?state=x"]) assert.throws(() => googleConsentUrl(value));
});
test("Microsoft sign-in links with state can be displayed alongside Google ones", () => {
  const google = "https://accounts.google.com/o/oauth2/v2/auth?state=example";
  const microsoft = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=example&state=example";
  assert.equal(emailConsentUrl(null), null);
  assert.equal(emailConsentUrl(google), google);
  assert.equal(emailConsentUrl(microsoft), microsoft);
  assert.equal(consentProviderName(google), "Google");
  assert.equal(consentProviderName(microsoft), "Microsoft");
  for (const value of ["https://login.microsoftonline.com.evil.test/common/oauth2/v2.0/authorize?state=x", "http://login.microsoftonline.com/common/oauth2/v2.0/authorize?state=x",
    "https://login.microsoftonline.com/common/oauth2/v2.0/authorize", "https://login.microsoftonline.com/common/oauth2/v2.0/token?state=x",
    "https://user@login.microsoftonline.com/common/oauth2/v2.0/authorize?state=x", "https://evil.test/?state=x", 42]) assert.throws(() => emailConsentUrl(value));
});
test("email sign-in starts with an explicit Google or Microsoft choice", () => {
  assert.deepEqual(connectionOperation("start-google", "email"), { action: "start", provider: "google" });
  assert.deepEqual(connectionOperation("start-microsoft", "email"), { action: "start", provider: "microsoft" });
  assert.deepEqual(connectionOperation("start", "email"), { action: "start" });
  assert.deepEqual(connectionOperation("start", "linkedin"), { action: "start" });
  assert.deepEqual(connectionOperation("poll", "email"), { action: "poll" });
  assert.deepEqual(connectionOperation("review", "email"), { action: "review" });
  assert.deepEqual(connectionOperation("review", "linkedin"), { action: "review" });
  assert.deepEqual(connectionOperation("switch-microsoft", "email"), { action: "switch", provider: "microsoft" });
  assert.deepEqual(connectionOperation("switch-google", "email"), { action: "switch", provider: "google" });
  for (const [operation, channel] of [["start-microsoft", "linkedin"], ["switch-google", "linkedin"], ["switch", "email"], ["start-yahoo", "email"], ["delete", "email"], [null, "email"]] as const)
    assert.throws(() => connectionOperation(operation, channel));
});
test("connection DTO rejects malformed timestamps and unknown success states", () => {
  const connection = { id, channel: "email", state: "pending", canContinue: false, updatedAt: "2026-10-15T00:00:00Z" };
  const data = (changes: object) => ({ people: [{ id, name: "Person", email: "person@example.test", source: "team", isSelf: true, canConnect: true, role: "client_member", access: "active", connections: [{ ...connection, ...changes }] }] });
  assert.equal(peopleFromResponse(data({}))[0].connections[0].state, "pending");
  assert.throws(() => peopleFromResponse(data({ state: "success" })));
  assert.throws(() => peopleFromResponse(data({ updatedAt: "invalid" })));
});
test("new-account invitations strip fragments and isolate activation progress by project", () => {
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
  const project = "https://test-project.supabase.co";
  const token = "a".repeat(64); const login = "b".repeat(64);
  let path = "";
  const first = captureAccountInvitation(`#token=${token}&login=${login}`, storage, value => { path = value; }, project);
  assert.deepEqual(first, { token, loginToken: login, needsPassword: false }); assert.equal(path, "/invite");
  assert.equal(captureAccountInvitation("", storage, () => {}, "https://other-project.supabase.co").token, "");
  markAccountActivated(storage, project, token);
  assert.deepEqual(captureAccountInvitation("", storage, () => {}, project), { token, loginToken: "", needsPassword: true });
  clearAccountActivation(storage, project); clearInvitation(storage, project);
  assert.equal(captureAccountInvitation("", storage, () => {}, project).token, "");
  const invalid = captureAccountInvitation(`#token=${token}&login=${login}&extra=x`, storage, () => {}, project);
  assert.equal(invalid.token, ""); assert.equal(invalid.loginToken, "");
});

test("person controls require explicit typed API permissions and do not expose identity IDs", () => {
  const person = { id, name: "Teammate", email: "member@example.test", source: "team", role: "client_member", access: "active", isSelf: true, canConnect: true, connections: [], userId: other };
  const [parsed] = peopleFromResponse({ people: [person] });
  assert.equal(parsed.canConnect, true);
  assert.equal("userId" in parsed, false);
  for (const changes of [{ canConnect: "true" }, { isSelf: undefined }, { role: "owner" }, { access: "enabled" }, { source: "unknown" }]) assert.throws(() => peopleFromResponse({ people: [{ ...person, ...changes }] }));
});

test("connection failures use fixed client-safe guidance and never render service text", () => {
  assert.match(connectionFailureMessage('account_create_required')!, /missing permission to add accounts/);
  assert.match(connectionFailureMessage('workspace_mismatch')!, /different workspace/);
  for (const code of ['account_create_required', 'mailbox_mismatch']) assert.ok(!connectionFailureMessage(code)!.includes('Google'));
  assert.equal(connectionFailureMessage(undefined), undefined);
  assert.equal(connectionFailureMessage(null), undefined);
  assert.ok(!connectionFailureMessage('private key and service error')!.includes('private key'));
  assert.equal(connectionFailureMessage('__proto__'), connectionFailureMessage({ key: 'secret' }));
});

test("rejected connection requests distinguish retry guidance from expired sessions and revoked access", () => {
  assert.match(connectionRequestMessage(400), /Check the connection details/);
  assert.doesNotMatch(connectionRequestMessage(400), /wait/i);
  assert.match(connectionFailureMessage('connection_retry_later')!, /Wait one minute/);
  assert.match(connectionFailureMessage('linkedin_identity_locked')!, /Use another account/);
  assert.match(connectionFailureMessage('connection_identity_reserved')!, /another person/);
  assert.match(connectionRequestMessage(401), /session expired/);
  assert.match(connectionRequestMessage(403), /access or this connection/);
  assert.match(connectionRequestMessage(500), /could not confirm/);
});

test('mailbox review outcomes provide fixed actionable guidance', () => {
  assert.match(connectionReviewMessage('connected'), /setup is complete/);
  assert.match(connectionReviewMessage('missing'), /Choose your provider below/);
  assert.match(connectionReviewMessage('waiting'), /If a sign-in window is open/);
  for (const outcome of ['missing', 'waiting', 'checking']) assert.ok(!connectionReviewMessage(outcome).includes('Google'));
  assert.match(connectionReviewMessage('checking'), /already in progress/);
  assert.match(connectionReviewMessage('unavailable'), /Check again later/);
  assert.equal(connectionReviewMessage('private service text'), connectionReviewMessage(undefined));
  assert.ok(!connectionReviewMessage('private service text').includes('private service text'));
  assert.match(connectionReviewMessage('restored', 'linkedin'), /checking its status/);
  assert.match(connectionReviewMessage('missing', 'linkedin'), /Connect LinkedIn again/);
  assert.match(connectionReviewMessage('waiting', 'linkedin'), /Check again after/);
  assert.match(connectionReviewMessage('unavailable', 'linkedin'), /Check again shortly/);
  for (const outcome of ['restored', 'missing', 'waiting', 'checking', 'unavailable']) assert.ok(!/mailbox|provider/i.test(connectionReviewMessage(outcome, 'linkedin')));
});


test("review deadlines are validated and shown only while waiting for consent expiry", () => {
  assert.equal(connectionReviewRetryAt('waiting', '2026-10-21T12:10:03-07:00'), '2026-10-21T19:10:03.000Z');
  for (const status of ['missing', 'connected', 'unavailable', undefined]) assert.equal(connectionReviewRetryAt(status, '2026-10-21T19:10:03Z'), undefined);
  for (const value of [undefined, {}, 'private service text', '2026-99-99T00:00:00Z']) assert.equal(connectionReviewRetryAt('waiting', value), undefined);
  assert.match(connectionReviewMessage('waiting'), /after the time below/);
  assert.doesNotMatch(connectionReviewMessage('waiting'), /up to 10 minutes/);
});

test("email provider choices never send personal Gmail or unsupported providers to OAuth", () => {
  assert.equal(isPersonalGmail(" Person@GMAIL.COM "), true);
  assert.equal(isPersonalGmail("person@googlemail.com"), true);
  assert.equal(isPersonalGmail("person@gmail.com.example.test"), false);
  for (const provider of [null, "personal", "other"] as const) assert.equal(canStartEmailConnection(provider, "person@company.test"), false);
  for (const provider of ["google", "microsoft"] as const) {
    assert.equal(canStartEmailConnection(provider, "person@company.test"), true);
    assert.equal(canStartEmailConnection(provider, "person@gmail.com"), false);
  }
  assert.throws(() => connectionOperation("pin", "email"));
  assert.match(connectionFailureMessage("personal_gmail_unsupported")!, /not available here yet/);
  assert.match(connectionFailureMessage("consent_denied")!, /company administrator/);
  assert.match(connectionFailureMessage("account_already_assigned")!, /another email workspace/);
});
