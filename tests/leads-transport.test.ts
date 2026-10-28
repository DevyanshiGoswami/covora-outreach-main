import test from "node:test";
import assert from "node:assert/strict";
import { leadDirectoryApiRequest, LeadDirectoryServiceError } from "../src/lib/leads-transport";
import { parseLeadDirectoryQuery } from "../src/lib/verified-leads";

const client = "10000000-0000-4000-8000-000000000001";

test("lead reads use the fixed endpoint, private bearer, encoded filters and no shared cache", async () => {
  const query = parseLeadDirectoryQuery({ q: "A&B + Partners", company: "O'Neil, Inc.", page: "2", email: "verified", linkedin: "available", audience: "hiring_partners", state: "US|CA", city: "US|CA|San Diego" });
  let calls = 0;
  const result = await leadDirectoryApiRequest("https://outbound.example.com", "private-test-token", client, query, async (input, init) => {
    calls++;
    const url = new URL(String(input));
    assert.equal(url.origin, "https://outbound.example.com");
    assert.equal(url.pathname, "/api/outbound/leads");
    assert.equal(url.searchParams.get("clientId"), client);
    assert.equal(url.searchParams.get("q"), "A&B + Partners");
    assert.equal(url.searchParams.get("company"), "O'Neil, Inc.");
    assert.equal(url.searchParams.get("page"), "2");
    assert.equal(url.searchParams.get("email"), "verified");
    assert.equal(url.searchParams.get("linkedin"), "available");
    assert.equal(url.searchParams.get("audience"), "hiring_partners");
    assert.equal(url.searchParams.get("state"), "US|CA");
    assert.equal(url.searchParams.get("city"), "US|CA|San Diego");
    assert.doesNotMatch(url.toString(), /private-test-token/);
    assert.equal(init?.method, "GET");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer private-test-token");
    assert.equal(init?.cache, "no-store");
    assert.equal(init?.credentials, "omit");
    assert.equal(init?.redirect, "error");
    assert.equal(init?.body, undefined);
    assert.ok(init?.signal);
    return Response.json({ leads: [] });
  });
  assert.equal(calls, 1);
  assert.deepEqual(result, { leads: [] });
});

test("lead failures never expose transport diagnostics or mistake failure for an empty roster", async () => {
  const query = parseLeadDirectoryQuery({});
  for (const status of [400, 401, 403, 500, 503]) {
    await assert.rejects(leadDirectoryApiRequest("https://outbound.example.com", "test-token", client, query, async () => Response.json({ error: "private upstream detail" }, { status })), (error: unknown) => {
      assert.ok(error instanceof LeadDirectoryServiceError);
      assert.doesNotMatch(error.message, /private|upstream/);
      if (status === 401) assert.match(error.message, /session/);
      if (status === 403) assert.match(error.message, /access/);
      return true;
    });
  }
  await assert.rejects(leadDirectoryApiRequest("https://outbound.example.com", "test-token", client, query, async () => { throw new Error("secret diagnostic"); }), /temporarily unavailable/);
  await assert.rejects(leadDirectoryApiRequest("https://outbound.example.com", "test-token", client, query, async () => new Response("not JSON")), /could not be confirmed/);
});

test("imported-list selection is encoded as a local identifier and keeps other lead filters", async () => {
  const list = "90000000-0000-4000-8000-000000000001";
  const query = parseLeadDirectoryQuery({ list, email: "available", linkedin: "verified" });
  await leadDirectoryApiRequest("https://outbound.example.com", "private-test-token", client, query, async (input) => {
    const url = new URL(String(input));
    assert.equal(url.searchParams.get("list"), list);
    assert.equal(url.searchParams.get("email"), "available");
    assert.equal(url.searchParams.get("linkedin"), "verified");
    assert.equal(url.searchParams.has("campaign"), false);
    return Response.json({ leads: [] });
  });
});
