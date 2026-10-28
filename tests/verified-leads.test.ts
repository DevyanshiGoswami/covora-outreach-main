import test from "node:test";
import assert from "node:assert/strict";
import { demoLeadDirectory } from "../src/lib/demo-verified-leads";
import { EPM_LEADS_CLIENT_ID, LEAD_STATUSES, changeLeadAudience, leadDirectoryFromResponse, leadDirectoryHref, leadEmailLabel, leadEmailValidationNote, leadLocationDisplay, leadResearchCopy, leadRoleCategory, parseLeadDirectoryQuery, safeLeadLinkedInUrl, type LeadDirectoryPage } from "../src/lib/verified-leads";

const clientId = "00000000-0000-4000-8000-000000000001";
const foreign = "00000000-0000-4000-8000-000000000002";
const defaults = parseLeadDirectoryQuery({});
const first = () => demoLeadDirectory(clientId, defaults);
const single = (): LeadDirectoryPage => { const data = first(); return { ...data, leads: [data.leads[0]], total: 1 }; };

test("lead filters are bounded, duplicate-safe and canonical across page params and URL params", () => {
  assert.deepEqual(defaults, { q: "", role: "all", company: "", campaign: "", list: "", email: "all", linkedin: "all", status: "all", sort: "priority", page: 1, audience: "all", city: "", state: "" });
  const values = { q: " Alex ", role: "owners-executives", company: " Northstar Studio ", campaign: "10000000-0000-4000-8000-000000000001", email: "verified", linkedin: "available", status: "replied", sort: "role", page: "2" };
  assert.deepEqual(parseLeadDirectoryQuery(values), parseLeadDirectoryQuery(new URLSearchParams(values)));
  assert.deepEqual(parseLeadDirectoryQuery({ role: "superuser", email: "true", linkedin: "confirmed", status: "deleted", sort: "danger", page: "2.5", campaign: "remote-resource" }), defaults);
  assert.equal(parseLeadDirectoryQuery({ q: ["one", "two"], page: ["2", "3"] }).q, "");
  assert.equal(parseLeadDirectoryQuery(new URLSearchParams("q=one&q=two&page=2&page=3")).page, 1);
  for (const page of ["0", "-1", "Infinity", "NaN", "2e2", "999999999", "1.1"]) assert.equal(parseLeadDirectoryQuery({ page }).page, 1);
  assert.equal(parseLeadDirectoryQuery({ page: "9999999" }).page, 1000000);
  assert.equal(parseLeadDirectoryQuery({ q: "x".repeat(300), company: "a".repeat(700) }).q.length, 200);
  assert.equal(parseLeadDirectoryQuery({ company: "a".repeat(700) }).company.length, 500);
});

test("lead links preserve independent filters and keep navigation inside the selected workspace", () => {
  const query = parseLeadDirectoryQuery({ q: "Avery & Co", company: "A&B / Growth", email: "available", linkedin: "verified", role: "vp-director", status: "contacted", sort: "name", page: "3" });
  const href = leadDirectoryHref(clientId, query);
  const url = new URL(href, "https://outreach.example.com");
  assert.equal(url.pathname, "/leads");
  assert.equal(url.searchParams.get("client"), clientId);
  assert.equal(url.searchParams.get("email"), "available");
  assert.equal(url.searchParams.get("linkedin"), "verified");
  assert.deepEqual(parseLeadDirectoryQuery(url.searchParams), query);
  assert.equal(leadDirectoryHref(clientId, defaults, true), `/demo/leads?client=${clientId}`);
});

test("only direct LinkedIn person profiles can be rendered or copied", () => {
  assert.equal(safeLeadLinkedInUrl("https://linkedin.com/in/avery-b/"), "https://www.linkedin.com/in/avery-b");
  assert.equal(safeLeadLinkedInUrl("https://www.linkedin.com/in/Avery_42"), "https://www.linkedin.com/in/Avery_42");
  for (const value of [null, {}, "javascript:alert(1)", "//www.linkedin.com/in/avery", "http://www.linkedin.com/in/avery", "https://www.linkedin.com.evil.example/in/avery", "https://evil.example/?url=https://www.linkedin.com/in/avery", "https://user:pass@www.linkedin.com/in/avery", "https://www.linkedin.com:443/in/avery", "https://www.linkedin.com/in/avery?redirect=evil", "https://www.linkedin.com/in/avery#section", "https://www.linkedin.com/company/company", "https://www.linkedin.com/in/../avery", "https://www.linkedin.com/in/%2e%2e", "https://www.linkedin.com/in/avery%2Fsettings", "https://www.linkedin.com/in/avery/extra", "https://www.linkedin.com/in/" + "x".repeat(201)]) {
    assert.equal(safeLeadLinkedInUrl(value), null, String(value));
  }
});

test("lead response projection rejects cross-company rows and removes unexpected metadata", () => {
  const page = single();
  const clean = leadDirectoryFromResponse({ ...page, privateToken: "hidden", leads: [{ ...page.leads[0], rawMetadata: "hidden" }] }, clientId);
  assert.deepEqual(clean, page);
  assert.throws(() => leadDirectoryFromResponse(page, foreign));
  assert.throws(() => leadDirectoryFromResponse({ ...page, clientId: foreign }, clientId));
  assert.throws(() => leadDirectoryFromResponse({ ...page, leads: [{ ...page.leads[0], clientId: foreign }] }, clientId));
  assert.throws(() => leadDirectoryFromResponse({ ...page, total: 2, leads: [page.leads[0], page.leads[0]] }, clientId));
  for (const update of [{ id: "bad" }, { campaignId: "bad" }, { email: "invalid" }, { emailVerification: true }, { linkedinVerified: "true" }, { jobTitle: 12 }, { location: undefined }, { status: "custom-secret-state" }, { lastActivityAt: "not a date" }]) {
    assert.throws(() => leadDirectoryFromResponse({ ...page, leads: [{ ...page.leads[0], ...update }] }, clientId));
  }
});

test("verification is never inferred from available contact details or an unsafe profile URL", () => {
  const page = single();
  const input = { ...page.leads[0], email: "avery@example.com", emailVerification: "unknown", linkedinUrl: "https://www.linkedin.com/in/avery-example", linkedinVerified: null };
  const lead = leadDirectoryFromResponse({ ...page, leads: [input] }, clientId).leads[0];
  assert.equal(lead.emailVerification, "unknown");
  assert.equal(lead.linkedinVerified, null);
  const absent = leadDirectoryFromResponse({ ...page, leads: [{ ...input, email: null, emailVerification: "verified", linkedinUrl: "https://example.com/unsafe", linkedinVerified: true }] }, clientId).leads[0];
  assert.equal(absent.emailVerification, "unknown");
  assert.equal(absent.linkedinUrl, null);
  assert.equal(absent.linkedinVerified, null);
  for (const status of LEAD_STATUSES) assert.equal(leadDirectoryFromResponse({ ...page, leads: [{ ...input, status }] }, clientId).leads[0].status, status);
});

test("page validation rejects inconsistent counts, pagination and filter options", () => {
  const page = single();
  for (const update of [{ total: -1 }, { total: 0 }, { total: 2 }, { total: Infinity }, { page: 0 }, { page: 2 }, { pageSize: 100 }, { summary: { ...page.summary, total: 0 } }, { summary: { ...page.summary, verifiedEmail: page.summary.total + 1 } }, { companies: ["Repeat", "Repeat"] }, { campaigns: [page.campaigns[0], page.campaigns[0]] }, { filterOptionsTruncated: "false" }]) {
    assert.throws(() => leadDirectoryFromResponse({ ...page, ...update }, clientId));
  }
  assert.equal(leadDirectoryFromResponse({ ...page, filterOptionsTruncated: true }, clientId).filterOptionsTruncated, true);
});

test("synthetic directory filtering combines verification, profile, company, campaign and status independently", () => {
  const all = first();
  assert.equal(all.total, 48);
  assert.equal(all.leads.length, 36);
  const verified = demoLeadDirectory(clientId, { ...defaults, email: "verified" });
  assert.ok(verified.total > 0);
  assert.ok(verified.leads.every((lead) => lead.email && lead.emailVerification === "verified"));
  const available = demoLeadDirectory(clientId, { ...defaults, email: "available" });
  assert.ok(available.total > verified.total);
  assert.ok(available.leads.some((lead) => lead.emailVerification === "unknown"));
  const combined = demoLeadDirectory(clientId, { ...defaults, email: "verified", linkedin: "verified" });
  assert.ok(combined.total > 0);
  assert.ok(combined.leads.every((lead) => lead.emailVerification === "verified" && lead.linkedinVerified === true && safeLeadLinkedInUrl(lead.linkedinUrl)));
  const selected = combined.leads[0];
  const narrow = demoLeadDirectory(clientId, { ...defaults, q: selected.fullName, company: selected.company, campaign: selected.campaignId || "", email: "verified", linkedin: "verified", status: selected.status === "in_sequence" ? "contacted" : selected.status === "completed" ? "completed" : "all" });
  assert.ok(narrow.leads.some((lead) => lead.id === selected.id));
  assert.ok(narrow.leads.every((lead) => lead.company === selected.company && lead.campaignId === selected.campaignId));
  assert.deepEqual(narrow.summary, all.summary);
  assert.equal(demoLeadDirectory(clientId, { ...defaults, q: "does-not-exist" }).total, 0);
  const contacted = demoLeadDirectory(clientId, { ...defaults, status: "contacted" });
  assert.ok(contacted.leads.some((lead) => lead.status === "in_sequence"));
});

test("synthetic directory has deterministic sorting, nonoverlapping pages and clamped bounds", () => {
  const page1 = first();
  const page2 = demoLeadDirectory(clientId, { ...defaults, page: 2 });
  assert.equal(page2.leads.length, 12);
  assert.equal(new Set([...page1.leads, ...page2.leads].map((lead) => lead.id)).size, 48);
  assert.deepEqual(demoLeadDirectory(clientId, { ...defaults, page: 999 }), page2);
  for (const sort of ["company", "name", "role"] as const) {
    const sorted = demoLeadDirectory(clientId, { ...defaults, sort });
    const values = sorted.leads.map((lead) => sort === "company" ? lead.company : sort === "name" ? lead.fullName : lead.jobTitle || "");
    assert.deepEqual(values, [...values].sort((left, right) => left.localeCompare(right, "en", { sensitivity: "base" })));
  }
  const empty = demoLeadDirectory(clientId, { ...defaults, q: "no matching company", page: 100 });
  assert.equal(empty.page, 1);
  assert.equal(empty.leads.length, 0);
});

test("role groups distinguish senior leaders from support titles", () => {
  for (const title of ["Founder & CEO", "President", "Chief Operating Officer", "Managing Partner"]) assert.equal(leadRoleCategory(title), "owners-executives");
  for (const title of ["VP of Sales", "Marketing Director", "Head of Growth"]) assert.equal(leadRoleCategory(title), "vp-director");
  for (const title of [null, "Product Owner", "Executive Assistant", "Assistant to CEO", "Sales Manager"]) assert.equal(leadRoleCategory(title), "manager-other");
  for (const role of ["owners-executives", "vp-director", "manager-other"] as const) {
    const data = demoLeadDirectory(clientId, { ...defaults, role });
    assert.ok(data.total > 0);
    assert.ok(data.leads.every((lead) => leadRoleCategory(lead.jobTitle) === role));
  }
});

test("imported lead lists retain provenance without inventing a campaign or verification", () => {
  const page = single();
  const listId = "90000000-0000-4000-8000-000000000001";
  const imported = { ...page.leads[0], campaignId: null, campaignName: null, listId, listName: "Imported prospect roster", status: "not_contacted", emailVerification: "unknown" };
  const data = leadDirectoryFromResponse({ ...page, leads: [imported], lists: [{ id: listId, name: imported.listName }] }, clientId);
  assert.equal(data.leads[0].campaignId, null);
  assert.equal(data.leads[0].listId, listId);
  assert.equal(data.leads[0].status, "not_contacted");
  assert.equal(data.leads[0].emailVerification, "unknown");
  assert.deepEqual(data.lists, [{ id: listId, name: "Imported prospect roster" }]);
  for (const update of [{ listId: "not-a-list" }, { listId: null, listName: null }, { campaignId: null, campaignName: "Campaign" }]) {
    assert.throws(() => leadDirectoryFromResponse({ ...page, leads: [{ ...imported, ...update }] }, clientId));
  }
  assert.throws(() => leadDirectoryFromResponse({ ...page, lists: [data.lists[0], data.lists[0]] }, clientId));
  const oldResponse = { ...page, leads: page.leads.map((lead) => ({ ...lead, listId: undefined, listName: undefined })), lists: undefined };
  assert.deepEqual(leadDirectoryFromResponse(oldResponse, clientId).lists, []);
});

test("canonical imported leads retain list provenance and research when a live campaign supplies activity", () => {
  const page = single();
  const original = page.leads[0];
  const listId = "90000000-0000-4000-8000-000000000001";
  for (const status of ["contacted", "bounced", "unsubscribed"] as const) {
    const verification = status === "contacted" ? "verified" : "unverified";
    const input = { ...original, listId, listName: "Priority roster", campaignName: "Holiday outreach", status, lastActivityAt: "2026-10-20T12:00:00Z", priorityRank: 7, fitReason: "Owns employee gifting", emailValidation: status === "bounced" ? "invalid" : "valid", emailVerification: verification };
    const lead = leadDirectoryFromResponse({ ...page, leads: [input] }, clientId).leads[0];
    assert.equal(lead.id, original.id);
    assert.equal(lead.listId, listId);
    assert.equal(lead.listName, "Priority roster");
    assert.equal(lead.campaignId, original.campaignId);
    assert.equal(lead.campaignName, "Holiday outreach");
    assert.equal(lead.priorityRank, 7);
    assert.equal(lead.fitReason, "Owns employee gifting");
    assert.equal(lead.status, status);
    assert.equal(lead.lastActivityAt, input.lastActivityAt);
    assert.equal(lead.emailVerification, verification);
    assert.equal(leadEmailLabel(lead), status === "bounced" ? "Invalid email" : status === "contacted" ? "Verified" : "Not verified");
    if (status === "unsubscribed") {
      assert.match(leadEmailValidationNote(lead)!, /earlier validation check/);
      assert.match(leadEmailValidationNote(lead)!, /not currently verified/);
    }
    assert.throws(() => leadDirectoryFromResponse({ ...page, leads: [{ ...input, clientId: foreign }] }, clientId));
    assert.throws(() => leadDirectoryFromResponse({ ...page, leads: [{ ...input, campaignId: null, campaignName: null, listId: null, listName: null }] }, clientId));
    assert.throws(() => leadDirectoryFromResponse({ ...page, leads: [{ ...input, listId: null }] }, clientId));
  }
  assert.equal(leadEmailValidationNote({ emailValidation: "risky", emailVerification: "unknown" }), undefined);
});

test("lead list filters survive navigation and reject unrecognized identifiers", () => {
  const list = "90000000-0000-4000-8000-000000000001";
  const query = parseLeadDirectoryQuery({ list, q: "Purchasing", email: "available", linkedin: "verified", page: "3" });
  assert.equal(query.list, list);
  const url = new URL(leadDirectoryHref(clientId, query), "https://outbound.example.com");
  assert.equal(url.searchParams.get("list"), list);
  assert.deepEqual(parseLeadDirectoryQuery(url.searchParams), query);
  assert.equal(parseLeadDirectoryQuery({ list: "guessed-list" }).list, "");
  assert.equal(parseLeadDirectoryQuery(new URLSearchParams(`list=${list}&list=${list}`)).list, "");
});


test("EPM categories clear prior company and list constraints while retaining geography", () => {
  const query = parseLeadDirectoryQuery({ audience: "hiring_partners", q: "Avery", list: "90000000-0000-4000-8000-000000000001", campaign: "10000000-0000-4000-8000-000000000001", company: "Example Medical", role: "vp-director", state: "US|CA", city: "US|CA|San Diego", sort: "name", page: "4", email: "verified", linkedin: "verified", status: "replied" });
  const changed = changeLeadAudience(query, "athletes");
  assert.equal(changed.audience, "athletes");
  assert.deepEqual([changed.q, changed.list, changed.company, changed.campaign], ["", "", "", ""]);
  assert.equal(changed.role, "all");
  assert.deepEqual([changed.email, changed.linkedin, changed.status], ["all", "all", "all"]);
  assert.equal(changed.page, 1);
  assert.equal(changed.state, "US|CA");
  assert.equal(changed.city, "US|CA|San Diego");
  assert.equal(changed.sort, "name");
  const url = new URL(leadDirectoryHref(EPM_LEADS_CLIENT_ID, changed), "https://outbound.example.com");
  assert.deepEqual(parseLeadDirectoryQuery(url.searchParams), changed);
  assert.equal(url.searchParams.get("client"), EPM_LEADS_CLIENT_ID);
  assert.equal(url.searchParams.has("list"), false);
});

test("opaque person geography keys are bounded and never interpreted as company locations", () => {
  const query = parseLeadDirectoryQuery({ audience: "athletes", state: "US|CA", city: "US|CA|San Diego" });
  assert.equal(query.city, "US|CA|San Diego");
  assert.equal(query.state, "US|CA");
  assert.equal(parseLeadDirectoryQuery({ city: "x".repeat(251), state: "US\u0000|CA", audience: "untrusted" }).city, "");
  assert.equal(parseLeadDirectoryQuery({ state: "US\u0000|CA" }).state, "");
  assert.equal(parseLeadDirectoryQuery({ audience: "untrusted" }).audience, "all");
  assert.equal(parseLeadDirectoryQuery(new URLSearchParams("city=US%7CCA%7CSan+Diego&city=US%7CCA%7COakland")).city, "");
  const legacy = leadLocationDisplay({ location: "Company headquarters in Boston" });
  assert.equal(legacy.label, "Company headquarters in Boston");
  assert.match(legacy.note, /not confirmed/);
  const known = leadLocationDisplay({ location: "Company headquarters in Boston", personLocation: { city: "San Diego", state: "CA", country: "US", status: "known" } });
  assert.equal(known.label, "San Diego, CA, US");
  const conflict = leadLocationDisplay({ location: "Boston", personLocation: { city: null, state: null, country: "US", status: "conflict" } });
  assert.equal(conflict.label, "Location needs review");
  assert.match(conflict.note, /excluded/);
});

test("EPM audience and full cohort location facets are validated and projected without private metadata", () => {
  const page = single();
  const epm = { ...page, clientId: EPM_LEADS_CLIENT_ID, leads: page.leads.map((lead) => ({ ...lead, clientId: EPM_LEADS_CLIENT_ID })) };
  const options = { states: [{ value: "US|CA", label: "CA, US", count: 40, privateTrace: "hidden" }], cities: [{ value: "US|CA|San Diego", label: "San Diego, CA, US", count: 3 }] };
  const data = leadDirectoryFromResponse({ ...epm, audienceEnabled: true, locationOptions: options }, EPM_LEADS_CLIENT_ID);
  assert.equal(data.audienceEnabled, true);
  assert.deepEqual(data.locationOptions?.states, [{ value: "US|CA", label: "CA, US", count: 40 }]);
  assert.equal(data.leads.length, 1);
  assert.equal(data.locationOptions?.states[0].count, 40);
  const cities = Array.from({ length: 2002 }, (_, index) => ({ value: `US|CA|City${index}`, label: `City ${index}, CA, US`, count: 1 }));
  assert.equal(leadDirectoryFromResponse({ ...epm, locationOptions: { states: [], cities } }, EPM_LEADS_CLIENT_ID).locationOptions?.cities.length, 2002);
  assert.throws(() => leadDirectoryFromResponse({ ...epm, locationOptions: { states: cities.slice(0, 1002), cities: [] } }, EPM_LEADS_CLIENT_ID));
  assert.throws(() => leadDirectoryFromResponse({ ...epm, locationOptions: { states: [], cities: Array.from({ length: 5002 }, (_, index) => ({ value: `US|CA|City${index}`, label: `City ${index}`, count: 1 })) } }, EPM_LEADS_CLIENT_ID));
  assert.throws(() => leadDirectoryFromResponse({ ...page, audienceEnabled: true }, clientId));
  assert.throws(() => leadDirectoryFromResponse({ ...epm, audienceEnabled: "true" }, EPM_LEADS_CLIENT_ID));
  for (const states of [[{ value: "US|CA", label: "CA", count: 0 }], [{ value: "US|CA", label: "CA", count: 1.5 }], [options.states[0], options.states[0]], [{ value: "", label: "CA", count: 1 }]]) {
    assert.throws(() => leadDirectoryFromResponse({ ...epm, locationOptions: { ...options, states } }, EPM_LEADS_CLIENT_ID));
  }
});

test("person location and draft research remain separate from contact verification", () => {
  const page = single();
  const personLocation = { city: "San Diego", state: "CA", country: "US", status: "known", rawReceipt: "hidden", companyHeadquarters: "Boston" };
  const response = { ...page, leads: [{ ...page.leads[0], audience: "hiring_partners", personLocation, fitReason: "Leads a commercial team", icebreaker: "Saw the new device launch — a clear step forward?", emailVerification: "unknown", linkedinVerified: null }] };
  const lead = leadDirectoryFromResponse(response, clientId).leads[0];
  assert.deepEqual(lead.personLocation, { city: "San Diego", state: "CA", country: "US", status: "known" });
  assert.equal(lead.icebreaker, "Saw the new device launch a clear step forward");
  assert.equal(lead.emailVerification, "unknown");
  assert.equal(lead.linkedinVerified, null);
  assert.equal(lead.fitReason, "Leads a commercial team");
  for (const location of [{ city: null, state: "CA", country: "US", status: "known" }, { city: "Boston", state: "MA", country: "US", status: "conflict" }, { city: "Boston", state: null, country: null, status: "unknown" }, { city: null, state: null, country: null, status: "partial" }]) {
    assert.throws(() => leadDirectoryFromResponse({ ...page, leads: [{ ...page.leads[0], personLocation: location }] }, clientId));
  }
  const partial = leadDirectoryFromResponse({ ...page, leads: [{ ...page.leads[0], personLocation: { city: null, state: "CA", country: "US", status: "partial" } }] }, clientId).leads[0];
  assert.equal(leadLocationDisplay(partial).label, "CA, US");
  assert.match(leadLocationDisplay(partial).note, /incomplete/);
  const cautious = leadDirectoryFromResponse({ ...page, leads: [{ ...page.leads[0], personLocation: { city: "San Diego", state: "CA", country: "US", status: "partial" } }] }, clientId).leads[0];
  assert.equal(cautious.personLocation?.status, "partial");
  assert.equal(leadResearchCopy("A U.S. commercial team with a formal training program."), "A U.S. commercial team with a formal training program.");
});
