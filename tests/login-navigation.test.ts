import test from "node:test";
import assert from "node:assert/strict";
import { loginPath, safeLoginNext } from "../src/lib/invitation-session";
import { parseSelection } from "../src/lib/model";
import { resolveWorkspace } from "../src/lib/access";

const clientId = "10000000-0000-4000-8000-000000000001";
const otherClientId = "20000000-0000-4000-8000-000000000002";
const inbox = `/?client=${clientId}&view=inbox`;

test("a lead alert preserves the exact tenant inbox through the login query and form", () => {
  const redirect = loginPath(inbox);
  assert.equal(redirect, `/login?next=${encodeURIComponent(inbox)}`);
  const pageInput = new URL(redirect, "https://outreach.example.com").searchParams.get("next");
  const hiddenInput = safeLoginNext(pageInput);
  assert.equal(hiddenInput, inbox);
  const form = new FormData();
  form.set("next", hiddenInput);
  assert.equal(safeLoginNext(form.get("next")), inbox);
  assert.equal(loginPath("/"), "/login");
  assert.equal(safeLoginNext("/invite"), "/invite");
});

test("the exact admin destination survives login without allowing nested paths or extra values", () => {
  assert.equal(loginPath("/agency"), "/login?next=%2Fagency");
  const next = new URL(loginPath("/agency"), "https://outreach.example.com").searchParams.get("next");
  const form = new FormData();
  form.set("next", safeLoginNext(next));
  assert.equal(safeLoginNext(form.get("next")), "/agency");
  for (const value of ["/agency/", "/agency?client=" + clientId, "/agency#token=secret", "/agency/setup", "/agency/client-preview", "/agency/../invite", "/agency\n", "/agency%0a", "//agency", "https://outreach.example.com/agency", ["/agency"]]) {
    assert.equal(safeLoginNext(value), "/", String(value));
  }
});

test("return destinations reject open redirects, ambiguous queries, secrets and unsupported routes", () => {
  for (const value of [undefined, null, [inbox], new Blob([inbox]), "//evil.example", "https://evil.example",
    "/\\evil.example", "javascript:alert(1)", ` ${inbox}`, `${inbox}\n`,
    `/${inbox}`, `${inbox}#fragment`, `${inbox}&token=secret`, `${inbox}&client=${otherClientId}`,
    `${inbox}&view=inbox`, `/?client=${clientId}&view=overview`, "/?view=inbox",
    `/?client=not-a-uuid&view=inbox`, `/?client=${clientId}%0d%0a&view=inbox`,
    `/?client=${clientId}&view=%69nbox`, `/?client=${clientId}&view=inbox&`,
    `/path/../?client=${clientId}&view=inbox`, encodeURIComponent(inbox),
    "/invite?token=secret", "/invite#token=secret", "/settings", "/login"]) {
    assert.equal(safeLoginNext(value), "/", String(value));
    assert.equal(loginPath(value), "/login", String(value));
  }
});

test("the return path selects a workspace only after current membership authorization", () => {
  const target = new URL(safeLoginNext(inbox), "https://outreach.example.com");
  const selection = parseSelection(Object.fromEntries(target.searchParams));
  const rows = [
    { client_id: otherClientId, client_name: "First workspace", role: "client_member" },
    { client_id: clientId, client_name: "Alert workspace", role: "client_member" },
  ];
  assert.equal(selection.view, "inbox");
  assert.equal(resolveWorkspace(rows, selection.client).clientId, clientId);
  const revoked = resolveWorkspace(rows.slice(0, 1), selection.client);
  assert.equal(revoked.clientId, null);
  assert.equal(revoked.enabled, false);
  assert.equal(resolveWorkspace([], selection.client).enabled, false);
});
