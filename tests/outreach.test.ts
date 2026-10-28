import test from "node:test";
import assert from "node:assert/strict";
import { outreachApiRequest, OutreachServiceError } from "../src/lib/outreach-transport";
import { outreachFromResponse, outreachListFromResponse, outreachOptionsFromResponse, validOutreachInput } from "../src/lib/outreach";

const client = "10000000-0000-4000-8000-000000000001";
const send = "20000000-0000-4000-8000-000000000002";
const lead = "30000000-0000-4000-8000-000000000003";
const sender = "40000000-0000-4000-8000-000000000004";
const input = { clientId: client, sendId: send, leadId: lead, connectionId: sender, subject: " Quick idea ", bodyText: " Hello " };
const item = { id: send, clientId: client, status: "scheduled", recipientEmail: "priya@prospect-mock.test", recipientName: "Priya Shah", senderAddress: "alice.sender@covora-mock.test",
  subject: "Quick idea", createdAt: "2026-10-28T10:00:00Z", updatedAt: "2026-10-28T10:00:01Z", conversationId: null };

test("outreach input requires ids, a one-line subject and a bounded message", () => {
  assert.deepEqual(validOutreachInput(input), { ...input, subject: "Quick idea", bodyText: "Hello" });
  for (const patch of [{ leadId: "x" }, { subject: "" }, { subject: "a\nb" }, { bodyText: "x".repeat(4001) }, { connectionId: undefined }]) {
    assert.equal(validOutreachInput({ ...input, ...patch }), null);
  }
});

test("starting outreach posts once to the fixed endpoint with the private bearer", async () => {
  const calls: Request[] = [];
  const response = await outreachApiRequest("https://outbound.example.com", "private-token", { kind: "start", body: validOutreachInput(input)! }, async (url, init) => {
    calls.push(new Request(url, init));
    return Response.json({ outreach: item });
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "POST");
  assert.equal(new URL(calls[0].url).pathname, "/api/outbound/outreach");
  assert.equal(calls[0].headers.get("authorization"), "Bearer private-token");
  assert.equal(outreachFromResponse(response, client, send).status, "scheduled");
});

test("a lost start response is uncertain; rejected reads are not", async () => {
  await assert.rejects(outreachApiRequest("https://outbound.example.com", "t", { kind: "start", body: validOutreachInput(input)! }, async () => { throw new Error("socket"); }),
    (error: unknown) => error instanceof OutreachServiceError && error.uncertain);
  await assert.rejects(outreachApiRequest("https://outbound.example.com", "t", { kind: "list", clientId: client }, async () => new Response("", { status: 403 })),
    (error: unknown) => error instanceof OutreachServiceError && !error.uncertain);
});

test("responses for another workspace or with unknown fields are refused", () => {
  assert.throws(() => outreachListFromResponse({ outreach: [{ ...item, clientId: lead }] }, client));
  assert.throws(() => outreachListFromResponse({ outreach: [{ ...item, status: "delivered" }] }, client));
  assert.throws(() => outreachFromResponse({ outreach: item }, client, lead));
  assert.deepEqual(outreachOptionsFromResponse({ prospects: [{ id: lead, name: "Priya Shah", email: "priya@prospect-mock.test", company: "Northwind" }], senders: [], sendingEnabled: false }).senders, []);
  assert.throws(() => outreachOptionsFromResponse({ prospects: [], senders: [{ connectionId: "x", address: "a", label: "b" }], sendingEnabled: true }));
});
