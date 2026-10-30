import test from "node:test";
import assert from "node:assert/strict";
import { outreachApiRequest, OutreachServiceError } from "../src/lib/outreach-transport";
import { outreachFormErrors, outreachFromResponse, outreachListFromResponse, outreachOptionsFromResponse, outreachOutcomeNotice, outreachStatusLabel, validOutreachInput } from "../src/lib/outreach";

const client = "10000000-0000-4000-8000-000000000001";
const send = "20000000-0000-4000-8000-000000000002";
const lead = "30000000-0000-4000-8000-000000000003";
const sender = "40000000-0000-4000-8000-000000000004";
const input = { clientId: client, sendId: send, recipientEmail: " Priya@Prospect-Mock.test ", connectionId: sender, subject: " Quick idea ", bodyText: " Hello " };
const item = { id: send, clientId: client, status: "scheduled", recipientEmail: "priya@prospect-mock.test", recipientName: "Priya Shah", senderAddress: "alice.sender@covora-mock.test",
  subject: "Quick idea", createdAt: "2026-10-28T10:00:00Z", updatedAt: "2026-10-28T10:00:01Z", conversationId: null };

test("outreach input requires ids, a typed recipient, a one-line subject and a bounded message", () => {
  assert.deepEqual(validOutreachInput(input), { ...input, recipientEmail: "priya@prospect-mock.test", subject: "Quick idea", bodyText: "Hello" });
  for (const patch of [{ recipientEmail: "" }, { recipientEmail: "not-an-email" }, { subject: "" }, { subject: "a\nb" }, { bodyText: "x".repeat(4001) }, { connectionId: undefined }]) {
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
  assert.deepEqual(await calls[0].json(), { clientId: client, sendId: send, recipientEmail: "priya@prospect-mock.test", connectionId: sender, subject: "Quick idea", bodyText: "Hello" });
  assert.equal(outreachFromResponse(response, client, send).status, "scheduled");
});

test("a leadId is never sent, even when the caller supplies one", async () => {
  const body = validOutreachInput({ ...input, leadId: lead })!;
  assert.equal("leadId" in body, false);
  let posted = "";
  await outreachApiRequest("https://outbound.example.com", "t", { kind: "start", body }, async (_url, init) => { posted = String(init?.body); return Response.json({ outreach: item }); });
  assert.doesNotMatch(posted, /leadId/);
  assert.match(posted, /"recipientEmail":"priya@prospect-mock\.test"/);
});

test("an invalid email, empty subject or empty message blocks submission with inline errors", () => {
  const valid = { recipientEmail: "priya@prospect-mock.test", subject: "Hi", bodyText: "Hello" };
  assert.deepEqual(outreachFormErrors(valid), {});
  assert.match(outreachFormErrors({ ...valid, recipientEmail: "priya@" }).recipientEmail!, /valid email/);
  assert.match(outreachFormErrors({ ...valid, recipientEmail: "  " }).recipientEmail!, /Enter the recipient/);
  assert.match(outreachFormErrors({ ...valid, recipientEmail: `${"a".repeat(250)}@x.io` }).recipientEmail!, /valid email/);
  assert.deepEqual(Object.keys(outreachFormErrors({ recipientEmail: "x", subject: " ", bodyText: "" })).sort(), ["bodyText", "recipientEmail", "subject"]);
});

test("statuses are shown honestly and an unknown outcome offers no retry", () => {
  assert.equal(outreachStatusLabel("scheduled"), "Queued for sending");
  assert.equal(outreachStatusLabel("sent"), "Sent");
  assert.equal(outreachStatusLabel("failed"), "Not sent");
  assert.equal(outreachStatusLabel("unknown"), "Outcome unconfirmed, do not resend");
  const unknown = outreachOutcomeNotice({ status: "unknown", recipientEmail: "priya@prospect-mock.test" });
  assert.match(unknown, /do not resend/);
  assert.doesNotMatch(unknown, /try again|retry/i);
  assert.match(outreachOutcomeNotice({ status: "failed", recipientEmail: "x@y.test" }), /try again/);
});

test("rejected starts show the service's own short message, never branded or multi-line text", async () => {
  const reject = (status: number, payload: unknown) => outreachApiRequest("https://outbound.example.com", "t", { kind: "start", body: validOutreachInput(input)! }, async () => Response.json(payload, { status }));
  await assert.rejects(reject(400, { message: "This recipient is not allowed." }), (error: unknown) => error instanceof OutreachServiceError && error.message === "This recipient is not allowed." && !error.uncertain);
  await assert.rejects(reject(403, { message: "Outreach is unavailable for this account." }), (error: unknown) => error instanceof OutreachServiceError && error.message === "Outreach is unavailable for this account.");
  await assert.rejects(reject(400, { message: "line one\nline two" }), (error: unknown) => error instanceof OutreachServiceError && /Check the recipient/.test(error.message));
  await assert.rejects(reject(403, {}), (error: unknown) => error instanceof OutreachServiceError && /not enabled/.test(error.message));
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
