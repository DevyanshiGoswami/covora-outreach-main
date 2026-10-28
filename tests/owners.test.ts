import assert from "node:assert/strict";
import { test } from "node:test";
import {
  captureOwnerInvitation,
  ownerInvitationLink,
  ownerStorageKey,
  ownerList,
} from "../src/lib/owners";
import { safeLoginNext } from "../src/lib/invitation-session";
import { teamApiRequest } from "../src/lib/team-transport";
const token = "a".repeat(64),
  activate = "b".repeat(64),
  project = "https://example.test";
function storage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      m.set(k, v);
    },
    removeItem: (k: string) => {
      m.delete(k);
    },
  };
}
test("owner secrets use a fragment, isolated tab storage and are stripped even on storage failure", () => {
  const s = storage();
  const link = new URL(
    ownerInvitationLink("https://portal.test", token, activate),
  );
  assert.equal(link.search, "");
  assert.equal(link.pathname, "/owner-invite");
  let replaced = "";
  const r = captureOwnerInvitation(
    link.hash,
    s,
    (p) => {
      replaced = p;
    },
    project,
  );
  assert.deepEqual(r, { token, loginToken: activate });
  assert.equal(replaced, "/owner-invite");
  assert.deepEqual(
    captureOwnerInvitation("", s, () => {}, project),
    { ...r, needsPassword: false },
  );
  assert.equal(
    captureOwnerInvitation("", s, () => {}, "https://other.test").token,
    "",
  );
  assert.equal(
    captureOwnerInvitation("#token=bad", s, () => {}, project).token,
    "",
  );
  assert.equal(s.getItem(ownerStorageKey(project)), null);
  assert.throws(() =>
    captureOwnerInvitation(
      link.hash,
      {
        ...s,
        removeItem: () => {
          throw new Error();
        },
      },
      (p) => {
        replaced = p;
      },
      project,
    ),
  );
  assert.equal(replaced, "/owner-invite");
});
test("only exact owner return paths are allowed", () => {
  for (const p of ["/owner-invite", "/agency/owners"])
    assert.equal(safeLoginNext(p), p);
  for (const p of [
    "/owner-invite#token=x",
    "/owner-invite?next=https://evil.test",
    "//evil.test",
    "/agency/owners/extra",
  ])
    assert.equal(safeLoginNext(p), "/");
});
test("owner API transport sends credentials only to fixed routes; list has no body", async () => {
  const requests: { url: string; init?: RequestInit }[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    requests.push({ url: String(input), init });
    return Response.json({ ok: true });
  };
  await teamApiRequest(
    "https://api.test",
    "test-bearer",
    { kind: "owners", body: {} },
    fetcher,
  );
  await teamApiRequest(
    "https://api.test",
    "test-bearer",
    { kind: "ownerAccept", body: { token } },
    fetcher,
  );
  assert.equal(requests[0].url, "https://api.test/api/outbound/owners");
  assert.equal(requests[0].init?.body, undefined);
  assert.equal(requests[1].url, "https://api.test/api/outbound/owners/accept");
  assert.equal(requests[1].init?.body, JSON.stringify({ token }));
  assert.equal(requests[1].init?.redirect, "error");
});
test("malformed owner access responses fail closed", () => {
  assert.throws(() => ownerList({ owners: [], invitations: [] }));
  assert.throws(() =>
    ownerList({
      userId: "10000000-0000-4000-8000-000000000001",
      owners: [{ userId: "bad", email: "x", state: "active", version: 1 }],
      invitations: [],
    }),
  );
});
