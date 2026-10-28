import test from "node:test";
import assert from "node:assert/strict";
import { clientCampaignName, clientListName, clientOperationalNote, clientReplyReason } from "../src/lib/client-copy";
import { containsPrivateBrand } from "../src/lib/client-brand-registry.mjs";
import { conversationsFromResponse, detailFromResponse, validReplyInput, type ConversationDetail } from "../src/lib/conversations";
import { leadDirectoryFromResponse, parseLeadDirectoryQuery } from "../src/lib/verified-leads";
import { demoLeadDirectory } from "../src/lib/demo-verified-leads";
import { setupRequestsFromResponse, STATUS_DESCRIPTIONS } from "../src/lib/setup";
import { accountsFromResponse } from "../src/lib/accounts";

const emailEngine = String.fromCharCode(73, 110, 115, 116, 97, 110, 116, 108, 121);
const socialEngine = String.fromCharCode(72, 101, 121, 82, 101, 97, 99, 104);
const verifier = String.fromCharCode(90, 101, 114, 111, 66, 111, 117, 110, 99, 101);
const clientId = "00000000-0000-4000-8000-000000000001";
const campaignId = "10000000-0000-4000-8000-000000000001";
const conversationId = "20000000-0000-4000-8000-000000000001";
const messageId = "30000000-0000-4000-8000-000000000001";
const now = "2026-10-12T12:00:00Z";

test("product titles retain campaign context while removing service brands and full service URLs", () => {
  assert.equal(clientCampaignName(`${emailEngine.toUpperCase()} — Medical clinics`), "Email — Medical clinics");
  assert.equal(clientCampaignName(`${socialEngine.slice(0, 3)}-Reach / Founders`), "LinkedIn / Founders");
  assert.equal(clientListName(`${verifier.slice(0, 4)} Bounce: Corporate buyers`), "Email verification: Corporate buyers");
  assert.equal(clientCampaignName(`Medical clinics https://app.${emailEngine.toLowerCase()}.ai/campaigns/private?key=private`), "Medical clinics");
  assert.equal(clientListName(`app.${emailEngine.toLowerCase()}.ai/campaigns/private#secret`), "Untitled list");
  assert.equal(clientCampaignName(emailEngine.slice(0, 4) + "\u200b" + emailEngine.slice(4)), "Email");
  assert.equal(clientCampaignName("Local clinics — West Palm Beach"), "Local clinics — West Palm Beach");
  assert.equal(clientCampaignName(null), "Untitled campaign");
});

test("operational explanations use neutral lifecycle and known reply reasons without inventing readiness", () => {
  const note = `Finish setup:\nhttps://app.${emailEngine.toLowerCase()}.ai/account\nthen reconnect`;
  assert.equal(clientOperationalNote(note, STATUS_DESCRIPTIONS.needs_action), STATUS_DESCRIPTIONS.needs_action);
  assert.equal(clientOperationalNote("Your account manager is reviewing setup.", "fallback"), "Your account manager is reviewing setup.");
  assert.equal(clientReplyReason(null), null);
  assert.equal(clientReplyReason("A reply is being checked or its outcome needs review."), "A reply is being checked or its outcome needs review.");
  for (const reason of [`${socialEngine} failed`, "unexpected upstream diagnostic with a private token"])
    assert.equal(clientReplyReason(reason), "Replies are not available for this conversation yet. Contact your Covora account manager for help.");
});

test("conversation DTO sanitizes controlled labels and reasons but preserves correspondence, identity and reply text", () => {
  const content = `We use ${emailEngine}. Should we connect it?`;
  const identity = `${emailEngine} Consulting`;
  const address = `person@${emailEngine.toLowerCase()}.example`;
  const detail: ConversationDetail = {
    id: conversationId, clientId, channel: "email", campaignId, campaignName: `${emailEngine} — Clinics`,
    subject: content, contactName: identity, contactAddress: address, senderLabel: "sales@example.test",
    owner: { kind: "covora", userId: null, name: "Covora" }, ownedByMe: false, version: 1,
    latestMessageId: messageId, latestAt: now, preview: content, unread: true, status: "needs_reply",
    canReply: false, canTakeover: true, replyUnavailableReason: `${emailEngine} account check failed`,
    messages: [{ id: messageId, direction: "received", bodyText: content, sentAt: now, senderLabel: address }],
    commands: [], messagesTruncated: false,
  };
  const result = detailFromResponse({ conversation: detail }, clientId, conversationId);
  assert.equal(result.campaignName, "Email — Clinics");
  assert.equal(containsPrivateBrand(result.replyUnavailableReason!), false);
  for (const field of ["subject", "preview", "contactName", "contactAddress", "senderLabel", "campaignId", "id"] as const)
    assert.equal(result[field], detail[field]);
  assert.deepEqual(result.messages, detail.messages);
  assert.equal(result.canReply, false);
  assert.equal(detail.campaignName, `${emailEngine} — Clinics`);
  const page = conversationsFromResponse({ conversations: [detail], nextCursor: null }, clientId, "email");
  assert.equal(page.conversations[0].campaignName, result.campaignName);
  assert.equal(validReplyInput({ clientId, commandId: campaignId, expectedVersion: 1, latestMessageId: messageId, bodyText: content, takeover: true })?.bodyText, content);
});

test("directory applies the same neutral title to options and rows while preserving IDs and prospect data", () => {
  const page = demoLeadDirectory(clientId, parseLeadDirectoryQuery({}));
  const original = page.leads[0];
  const listId = "40000000-0000-4000-8000-000000000001";
  const listName = `${verifier} — Fitness`;
  const company = `${emailEngine} Consulting`;
  const leads = [
    { ...original, campaignName: `${emailEngine} — Buyers`, company },
    { ...original, id: messageId, campaignId: null, campaignName: null, listId, listName },
  ];
  const parsed = leadDirectoryFromResponse({ ...page, leads, total: 2, campaigns: [{ id: original.campaignId!, name: `${emailEngine} — Buyers` }], lists: [{ id: listId, name: listName }], companies: [company] }, clientId);
  assert.equal(parsed.campaigns[0].name, parsed.leads[0].campaignName);
  assert.equal(parsed.lists[0].name, parsed.leads[1].listName);
  assert.equal(parsed.campaigns[0].id, original.campaignId);
  assert.equal(parsed.lists[0].id, listId);
  assert.equal(parsed.leads[0].company, company);
  assert.deepEqual(parsed.companies, [company]);
  assert.equal(parsed.leads[0].email, original.email);
  assert.equal(parsed.leads[0].emailVerification, original.emailVerification);
  assert.equal(parsed.leads[0].linkedinUrl, original.linkedinUrl);
  assert.equal(parsed.leads[1].campaignName, null);
});

test("setup DTO neutralizes branded notes for every lifecycle without changing status or method", () => {
  for (const status of ["requested", "in_progress", "needs_action", "resolved"] as const) {
    const row = { id: campaignId, client_id: clientId, channel: "email", method: "google_workspace", status, note: `${emailEngine} setup action required`, created_at: now, updated_at: now };
    const parsed = setupRequestsFromResponse({ requests: [row] }, clientId)[0];
    assert.equal(parsed.note, STATUS_DESCRIPTIONS[status]);
    assert.equal(parsed.status, status);
    assert.equal(parsed.method, "google_workspace");
    assert.equal(parsed.id, row.id);
  }
});

test("account DTO preserves real sender names even when a name overlaps a supplier brand", () => {
  const names = ["Claude Dubois", `${String.fromCharCode(65, 112, 111, 108, 108, 111)} Johnson`, ""];
  for (const displayName of names) {
    const account = { id: campaignId, client_id: clientId, channel: "email", email: "sales@example.test", display_name: displayName, state: "unverified", last_checked_at: null, last_attempt_at: null, check_error: false, last_connected_at: null, updated_at: now };
    const result = accountsFromResponse({ accounts: [account], verificationAvailable: false }, clientId);
    assert.deepEqual(result.accounts[0], account);
    assert.equal(result.verificationAvailable, false);
  }
});
