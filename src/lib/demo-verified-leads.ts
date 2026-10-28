import { leadDirectoryFromResponse, leadRoleCategory, safeLeadLinkedInUrl, VERIFIED_LEADS_PAGE_SIZE, type LeadDirectoryLead, type LeadDirectoryPage, type LeadDirectoryQuery } from "./verified-leads";

const campaignIds = ["10000000-0000-4000-8000-000000000001", "10000000-0000-4000-8000-000000000002"];
const campaignNames = ["Founder introductions", "Growth leaders"];
const firstNames = ["Avery", "Jordan", "Morgan", "Taylor", "Cameron", "Riley", "Casey", "Alex", "Jamie", "Quinn", "Rowan", "Drew"];
const lastNames = ["Bennett", "Chen", "Reed", "Brooks", "Ellis", "Stone", "Parker", "Hayes", "Morgan", "Kim", "Walsh", "Patel"];
const companies = ["Northstar Studio", "Evergreen Labs", "Summit Works", "Canvas Group", "Atlas Partners", "Brightwater", "Fieldwork Co.", "Clearpath Systems"];
const titles = ["Founder & CEO", "VP of Growth", "Marketing Director", "General Manager", "Head of Partnerships", "Chief Operating Officer", "Product Owner", "Sales Manager"];
const locations = ["Austin, TX", "San Francisco, CA", "Denver, CO", "Chicago, IL", "New York, NY", "Seattle, WA"];
const statuses: LeadDirectoryLead["status"][] = ["not_contacted", "in_sequence", "replied", "completed", "contacted", "paused", "bounced", "unsubscribed"];

/** Synthetic preview records. These are never a fallback for a real workspace. */
export function demoLeadDirectory(clientId: string, query: LeadDirectoryQuery): LeadDirectoryPage {
  if (process.env.NODE_ENV === "production") throw new Error("Sample data is unavailable.");
  const all: LeadDirectoryLead[] = Array.from({ length: 48 }, (_, index) => {
    const firstName = firstNames[index % firstNames.length];
    const lastName = lastNames[(index * 5 + Math.floor(index / firstNames.length)) % lastNames.length];
    const email = index % 7 === 0 ? null : `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index + 1}@example.com`;
    // The rejected examples exercise the same profile validation as real rows.
    const profile = index === 7 ? "https://example.com/not-a-profile" : index === 13 ? "javascript:void(0)" : index % 5 === 0 ? null : `https://www.linkedin.com/in/covora-demo-${firstName.toLowerCase()}-${index + 1}`;
    const linkedinUrl = safeLeadLinkedInUrl(profile);
    return {
      id: `50000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, clientId,
      campaignId: campaignIds[index % 2], campaignName: campaignNames[index % 2], listId: null, listName: null,
      firstName, lastName, fullName: `${firstName} ${lastName}`, company: companies[index % companies.length],
      jobTitle: index === 11 ? null : titles[(index + Math.floor(index / 8)) % titles.length], location: index === 9 ? null : locations[index % locations.length],
      email, emailVerification: email ? index % 3 === 0 ? "verified" : index % 3 === 1 ? "unknown" : "unverified" : "unknown",
      linkedinUrl, linkedinVerified: linkedinUrl ? index % 3 === 0 ? true : index % 3 === 1 ? null : false : null,
      status: statuses[index % statuses.length], interest: index % 8 === 2 ? "Interested" : null,
      lastActivityAt: index % 8 === 0 ? null : `2026-10-0${(index % 5) + 1}T14:30:00Z`,
    };
  });
  const search = query.q.toLocaleLowerCase("en-US");
  const filtered = all.filter((lead) => {
    const profile = safeLeadLinkedInUrl(lead.linkedinUrl);
    return (!search || [lead.fullName, lead.company, lead.jobTitle, lead.location, lead.email, lead.campaignName].join(" ").toLocaleLowerCase("en-US").includes(search)) &&
      (query.role === "all" || leadRoleCategory(lead.jobTitle) === query.role) &&
      (!query.company || lead.company === query.company) && (!query.campaign || lead.campaignId === query.campaign) && !query.list &&
      (query.email === "all" || Boolean(lead.email) && (query.email !== "verified" || lead.emailVerification === "verified")) &&
      (query.linkedin === "all" || Boolean(profile) && (query.linkedin !== "verified" || lead.linkedinVerified === true)) &&
      (query.status === "all" || lead.status === query.status || query.status === "contacted" && lead.status === "in_sequence");
  });
  const compare = (left: string, right: string) => left.localeCompare(right, "en", { sensitivity: "base" });
  filtered.sort((left, right) => {
    const sortValue = (lead: LeadDirectoryLead) => (query.sort === "company" || query.sort === "priority") ? lead.company : query.sort === "role" ? lead.jobTitle || "" : lead.fullName;
    return compare(sortValue(left), sortValue(right)) || compare(left.fullName, right.fullName) || left.id.localeCompare(right.id);
  });
  const page = Math.min(query.page, Math.max(1, Math.ceil(filtered.length / VERIFIED_LEADS_PAGE_SIZE)));
  return leadDirectoryFromResponse({
    clientId, leads: filtered.slice((page - 1) * VERIFIED_LEADS_PAGE_SIZE, page * VERIFIED_LEADS_PAGE_SIZE), total: filtered.length, page, pageSize: VERIFIED_LEADS_PAGE_SIZE,
    summary: { total: all.length, verifiedEmail: all.filter((lead) => lead.email && lead.emailVerification === "verified").length, withLinkedIn: all.filter((lead) => safeLeadLinkedInUrl(lead.linkedinUrl)).length, companies: companies.length },
    companies: [...companies].sort(compare), campaigns: campaignIds.map((id, index) => ({ id, name: campaignNames[index] })), lists: [], filterOptionsTruncated: false,
  }, clientId);
}
