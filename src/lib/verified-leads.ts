import { clientCampaignName, clientListName, clientOperationalNote } from "./client-copy";

export const VERIFIED_LEADS_PAGE_SIZE = 36 as const;
export const LEAD_ROLES = ["all", "owners-executives", "vp-director", "manager-other"] as const;
export const LEAD_CONTACT_FILTERS = ["all", "available", "verified"] as const;
export const LEAD_STATUS_FILTERS = ["all", "not_contacted", "contacted", "replied", "completed"] as const;
export const LEAD_SORTS = ["priority", "company", "name", "role"] as const;
export const LEAD_AUDIENCES = ["all", "hiring_partners", "athletes"] as const;
export const EPM_LEADS_CLIENT_ID = "26a2cffb-47f4-4231-9195-b4f772751c6d";
export const LEAD_AUDIENCE_LABELS = { all: "All contacts", hiring_partners: "Hiring Partners", athletes: "Athletes" } as const;
export const LEAD_STATUSES = ["not_contacted", "contacted", "in_sequence", "replied", "completed", "bounced", "unsubscribed", "skipped", "paused", "unknown"] as const;

export type LeadDirectoryQuery = {
  q: string;
  role: (typeof LEAD_ROLES)[number];
  company: string;
  campaign: string;
  list: string;
  email: (typeof LEAD_CONTACT_FILTERS)[number];
  linkedin: (typeof LEAD_CONTACT_FILTERS)[number];
  status: (typeof LEAD_STATUS_FILTERS)[number];
  sort: (typeof LEAD_SORTS)[number];
  page: number;
  audience: (typeof LEAD_AUDIENCES)[number];
  city: string;
  state: string;
};
export type LeadPersonLocation = { city: string | null; state: string | null; country: string | null; status: "known" | "partial" | "unknown" | "conflict" };
export type LeadLocationOption = { value: string; label: string; count: number };
export type LeadDirectoryLead = {
  id: string;
  clientId: string;
  campaignId: string | null;
  campaignName: string | null;
  listId: string | null;
  listName: string | null;
  firstName: string;
  lastName: string;
  fullName: string;
  company: string;
  jobTitle: string | null;
  location: string | null;
  email: string | null;
  emailVerification: "verified" | "unverified" | "unknown";
  linkedinUrl: string | null;
  linkedinVerified: boolean | null;
  status: (typeof LEAD_STATUSES)[number];
  interest: string | null;
  lastActivityAt: string | null;
  priorityRank?: number | null;
  fitReason?: string | null;
  emailValidation?: "valid" | "risky" | "unknown" | "invalid" | null;
  contactPreference?: "email_and_linkedin" | "linkedin_first" | null;
  researchGaps?: string | null;
  researchedAt?: string | null;
  sourceUrls?: string[];
  personLocation?: LeadPersonLocation | null;
  audience?: "hiring_partners" | "athletes" | null;
  icebreaker?: string | null;
};
export type LeadDirectoryPage = {
  clientId: string;
  leads: LeadDirectoryLead[];
  total: number;
  page: number;
  pageSize: typeof VERIFIED_LEADS_PAGE_SIZE;
  summary: { total: number; verifiedEmail: number; withLinkedIn: number; companies: number };
  companies: string[];
  campaigns: { id: string; name: string }[];
  lists: { id: string; name: string }[];
  filterOptionsTruncated: boolean;
  audienceEnabled?: boolean;
  locationOptions?: { states: LeadLocationOption[]; cities: LeadLocationOption[] };
};
export const LEAD_STATUS_LABELS: Record<LeadDirectoryLead["status"], string> = {
  not_contacted: "Not contacted", contacted: "Contacted", in_sequence: "In progress", replied: "Replied", completed: "Completed",
  bounced: "Bounced", unsubscribed: "Unsubscribed", skipped: "Skipped", paused: "Paused", unknown: "Not available",
};

type QueryParams = URLSearchParams | Record<string, string | string[] | undefined>;
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown, limit = 500): value is string => typeof value === "string" && value.length <= limit && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);
const nullableText = (value: unknown, limit = 500): value is string | null => value === null || text(value, limit);
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const choose = <T extends string>(value: string, choices: readonly T[], fallback: T): T => choices.includes(value as T) ? value as T : fallback;

export function parseLeadDirectoryQuery(params: QueryParams): LeadDirectoryQuery {
  const one = (key: string) => {
    const value = params instanceof URLSearchParams ? (params.getAll(key).length === 1 ? params.get(key) : "") : params[key];
    return typeof value === "string" ? value.trim() : "";
  };
  const page = one("page");
  const campaign = one("campaign");
  const list = one("list");
  return {
    q: one("q").slice(0, 200), role: choose(one("role"), LEAD_ROLES, "all"), company: one("company").slice(0, 500),
    campaign: uuid(campaign) ? campaign : "", list: uuid(list) ? list : "", email: choose(one("email"), LEAD_CONTACT_FILTERS, "all"),
    linkedin: choose(one("linkedin"), LEAD_CONTACT_FILTERS, "all"), status: choose(one("status"), LEAD_STATUS_FILTERS, "all"),
    sort: choose(one("sort"), LEAD_SORTS, "priority"), page: /^[1-9]\d{0,6}$/.test(page) ? Math.min(Number(page), 1000000) : 1,
    audience: choose(one("audience"), LEAD_AUDIENCES, "all"), city: locationQuery(one("city")), state: locationQuery(one("state")),
  };
}

const locationQuery = (value: string) => value.length <= 250 && !/[\u0000-\u001f\u007f]/.test(value) ? value : "";

/** Category navigation clears constraints tied to the previous group. */
export function changeLeadAudience(query: LeadDirectoryQuery, audience: LeadDirectoryQuery["audience"]): LeadDirectoryQuery {
  return { ...query, audience, q: "", list: "", company: "", campaign: "", role: "all", email: "all", linkedin: "all", status: "all", page: 1 };
}

export function leadDirectoryHref(clientId: string, query: LeadDirectoryQuery, demo = false): string {
  const params = new URLSearchParams({ client: clientId });
  for (const field of ["q", "role", "company", "campaign", "list", "email", "linkedin", "status", "sort", "audience", "city", "state"] as const) {
    const value = query[field];
    if (value && value !== "all" && !(field === "sort" && value === "priority")) params.set(field, value);
  }
  if (query.page > 1) params.set("page", String(query.page));
  return `${demo ? "/demo/leads" : "/leads"}?${params.toString()}`;
}

/** A stored profile may be displayed only as a direct HTTPS person profile. */
export function safeLeadLinkedInUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 500 || !/^https:\/\/(?:www\.)?linkedin\.com\/in\/[A-Za-z0-9_-]{1,200}\/?$/.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.username || url.password || url.port || url.search || url.hash || url.hash) return null;
    return `https://www.linkedin.com${url.pathname.replace(/\/$/, "")}`;
  } catch { return null; }
}

/** Explicit projection prevents unexpected backend metadata from entering UI props. */
export function leadDirectoryFromResponse(input: unknown, clientId: string): LeadDirectoryPage {
  const fail = (): never => { throw new Error("Your leads could not be loaded. Please try again."); };
  const row = record(input);
  const summary = record(row.summary);
  const rawLists = row.lists === undefined ? [] : row.lists;
  const extension: Pick<LeadDirectoryPage, "audienceEnabled" | "locationOptions"> = {};
  if (row.audienceEnabled !== undefined) {
    if (typeof row.audienceEnabled !== "boolean" || row.audienceEnabled && clientId !== EPM_LEADS_CLIENT_ID) return fail();
    extension.audienceEnabled = row.audienceEnabled;
  }
  if (row.locationOptions !== undefined) {
    const options = record(row.locationOptions);
    const parseOptions = (input: unknown, limit: number): LeadLocationOption[] => {
      if (!Array.isArray(input) || input.length > limit) return fail();
      const values = new Set<string>();
      return input.map((input) => {
        const option = record(input);
        if (!text(option.value, 250) || !option.value.trim() || !text(option.label, 250) || !option.label.trim() ||
            !integer(option.count) || option.count < 1 || values.has(option.value)) return fail();
        values.add(option.value);
        return { value: option.value, label: option.label, count: option.count };
      });
    };
    extension.locationOptions = { states: parseOptions(options.states, 1001), cities: parseOptions(options.cities, 5001) };
  }
  if (!uuid(clientId) || row.clientId !== clientId || !Array.isArray(row.leads) || row.leads.length > VERIFIED_LEADS_PAGE_SIZE ||
      !integer(row.total) || !integer(row.page) || row.page < 1 || row.pageSize !== VERIFIED_LEADS_PAGE_SIZE ||
      ![summary.total, summary.verifiedEmail, summary.withLinkedIn, summary.companies].every(integer) ||
      (summary.total as number) < row.total || [summary.verifiedEmail, summary.withLinkedIn, summary.companies].some((value) => (value as number) > (summary.total as number)) ||
      !Array.isArray(row.companies) || row.companies.length > 1001 || !Array.isArray(row.campaigns) || row.campaigns.length > 501 || !Array.isArray(rawLists) || rawLists.length > 501 || typeof row.filterOptionsTruncated !== "boolean") return fail();
  const totalPages = Math.max(1, Math.ceil(row.total / VERIFIED_LEADS_PAGE_SIZE));
  if (row.page > totalPages || row.leads.length !== Math.min(VERIFIED_LEADS_PAGE_SIZE, Math.max(0, row.total - (row.page - 1) * VERIFIED_LEADS_PAGE_SIZE))) return fail();
  const ids = new Set<string>();
  const leads = row.leads.map((value): LeadDirectoryLead => {
    const lead = record(value);
    const listId = lead.listId ?? null;
    const listName = lead.listName ?? null;
    if (!uuid(lead.id) || ids.has(lead.id) || lead.clientId !== clientId || !(lead.campaignId === null || uuid(lead.campaignId)) || !nullableText(lead.campaignName) ||
        !(listId === null || uuid(listId)) || !nullableText(listName) || (!lead.campaignId && !listId) ||
        (lead.campaignId === null && lead.campaignName !== null) || (listId === null && listName !== null) ||
        ![lead.firstName, lead.lastName, lead.fullName, lead.company].every((value) => text(value)) ||
        !nullableText(lead.jobTitle) || !nullableText(lead.location) || !nullableText(lead.interest) ||
        !(lead.email === null || (text(lead.email, 254) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email))) ||
        !["verified", "unverified", "unknown"].includes(lead.emailVerification as string) ||
        !nullableText(lead.linkedinUrl) || !(lead.linkedinVerified === null || typeof lead.linkedinVerified === "boolean") ||
        !LEAD_STATUSES.includes(lead.status as LeadDirectoryLead["status"]) ||
        !(lead.lastActivityAt === null || (text(lead.lastActivityAt, 50) && Number.isFinite(Date.parse(lead.lastActivityAt))))) return fail();
    const research = leadResearchFromResponse(lead);
    ids.add(lead.id);
    const linkedinUrl = safeLeadLinkedInUrl(lead.linkedinUrl);
    return {
      id: lead.id, clientId, campaignId: lead.campaignId, campaignName: lead.campaignName === null ? null : clientCampaignName(lead.campaignName), listId, listName: listName === null ? null : clientListName(listName),
      firstName: lead.firstName as string, lastName: lead.lastName as string, fullName: lead.fullName as string,
      company: lead.company as string, jobTitle: lead.jobTitle, location: lead.location, email: lead.email,
      emailVerification: lead.email ? lead.emailVerification as LeadDirectoryLead["emailVerification"] : "unknown",
      linkedinUrl, linkedinVerified: linkedinUrl ? lead.linkedinVerified : null,
      status: lead.status as LeadDirectoryLead["status"], interest: lead.interest, lastActivityAt: lead.lastActivityAt, ...research,
    };
  });
  const companySet = new Set<string>();
  const companies = row.companies.map((value) => {
    if (!text(value, 500) || !value.trim() || companySet.has(value)) return fail();
    companySet.add(value); return value;
  });
  const campaignSet = new Set<string>();
  const campaigns = row.campaigns.map((value) => {
    const campaign = record(value);
    if (!uuid(campaign.id) || !text(campaign.name) || campaignSet.has(campaign.id)) return fail();
    campaignSet.add(campaign.id); return { id: campaign.id, name: clientCampaignName(campaign.name) };
  });
  const listSet = new Set<string>();
  const lists = rawLists.map((value) => {
    const list = record(value);
    if (!uuid(list.id) || !text(list.name) || listSet.has(list.id)) return fail();
    listSet.add(list.id); return { id: list.id, name: clientListName(list.name) };
  });
  return {
    clientId, leads, total: row.total, page: row.page, pageSize: VERIFIED_LEADS_PAGE_SIZE,
    summary: { total: summary.total as number, verifiedEmail: summary.verifiedEmail as number, withLinkedIn: summary.withLinkedIn as number, companies: summary.companies as number },
    companies, campaigns, lists, filterOptionsTruncated: row.filterOptionsTruncated, ...extension,
  };
}

export function leadRoleCategory(title: string | null): Exclude<LeadDirectoryQuery["role"], "all"> {
  const role = (title || "").toLowerCase().replace(/\./g, "").replace(/[–—]/g, "-");
  if (/\b(?:assistant to|executive assistant|product owner|process owner|platform owner|service owner|system owner|portfolio owner|program owner)\b/.test(role)) return "manager-other";
  if (/\b(?:owner|founder|chief|ceo|cfo|coo|cto|cio|cmo|cro|cpo|chro|chairman|chairwoman|chairperson|principal|proprietor|board member)\b/.test(role)) return "owners-executives";
  if (/\b(?:vice president|evp|svp|avp|vp|head|director)\b/.test(role)) return "vp-director";
  if (/\bpresident\b|^(?:(?:managing|founding|general|equity|operating|senior) )?partner\b/.test(role)) return "owners-executives";
  return "manager-other";
}


/** Only explicit research fields are exposed; unknown legacy rows retain their prior labels. */
function leadResearchFromResponse(lead: Record<string, unknown>): Partial<LeadDirectoryLead> {
  const fail = (): never => { throw new Error("Your leads could not be loaded. Please try again."); };
  const result: Partial<LeadDirectoryLead> = {};
  if (lead.priorityRank !== undefined) {
    if (!(lead.priorityRank === null || integer(lead.priorityRank) && lead.priorityRank > 0)) return fail();
    result.priorityRank = lead.priorityRank;
  }
  for (const key of ["fitReason", "researchGaps", "icebreaker"] as const) {
    if (lead[key] !== undefined) {
      if (!nullableText(lead[key], 10000)) return fail();
      result[key] = lead[key] === null ? null : leadResearchCopy(lead[key]);
    }
  }
  if (lead.emailValidation !== undefined) {
    if (!(lead.emailValidation === null || ["valid", "risky", "unknown", "invalid"].includes(lead.emailValidation as string))) return fail();
    result.emailValidation = lead.emailValidation as LeadDirectoryLead["emailValidation"];
    // Validation and a verified badge must never disagree.
    if (["risky", "unknown", "invalid"].includes(String(lead.emailValidation)) && lead.emailVerification === "verified") return fail();
  }
  if (lead.contactPreference !== undefined) {
    if (!(lead.contactPreference === null || ["email_and_linkedin", "linkedin_first"].includes(lead.contactPreference as string))) return fail();
    result.contactPreference = lead.contactPreference as LeadDirectoryLead["contactPreference"];
  }
  if (lead.researchedAt !== undefined) {
    if (!(lead.researchedAt === null || text(lead.researchedAt, 50) && Number.isFinite(Date.parse(lead.researchedAt)))) return fail();
    result.researchedAt = lead.researchedAt;
  }
  if (lead.sourceUrls !== undefined) {
    if (!Array.isArray(lead.sourceUrls) || lead.sourceUrls.length > 20 || !lead.sourceUrls.every((value) => text(value, 2000))) return fail();
    result.sourceUrls = [...new Set(lead.sourceUrls.flatMap((value) => {
      const url = safeResearchUrl(value);
      return url ? [url] : [];
    }))];
  }
  if (lead.audience !== undefined) {
    if (lead.audience !== null && lead.audience !== "hiring_partners" && lead.audience !== "athletes") return fail();
    result.audience = lead.audience;
  }
  if (lead.personLocation === null) result.personLocation = null;
  else if (lead.personLocation !== undefined) {
    const location = record(lead.personLocation);
    if (!["known", "partial", "unknown", "conflict"].includes(String(location.status)) ||
        ![location.city, location.state, location.country].every((value) => nullableText(value, 120))) return fail();
    const city = typeof location.city === "string" ? location.city.trim() || null : null;
    const state = typeof location.state === "string" ? location.state.trim() || null : null;
    const country = typeof location.country === "string" ? location.country.trim() || null : null;
    if (location.status === "known" && (!city || !state || !country) ||
        location.status === "partial" && !city && !state && !country ||
        location.status === "unknown" && (city || state || country) ||
        location.status === "conflict" && (city || state || country)) return fail();
    result.personLocation = { city, state, country, status: location.status as LeadPersonLocation["status"] };
  }
  return result;
}

export function leadResearchCopy(value: string): string {
  return clientOperationalNote(value, "Additional research is required.").replace(/[\p{Dash_Punctuation}\u2212?]+/gu, " ").replace(/\s+/g, " ").trim();
}

/** Only explicit person geography may be presented as confirmed city or state. */
export function leadLocationDisplay(lead: Pick<LeadDirectoryLead, "personLocation" | "location">): { label: string; note: string } {
  const location = lead.personLocation;
  if (location?.status === "known" || location?.status === "partial") {
    return { label: [location.city, location.state, location.country].filter(Boolean).join(", "),
      note: location.status === "known" ? "Recorded person location" : "Person location is incomplete" };
  }
  if (location?.status === "conflict") return { label: "Location needs review", note: "Conflicting person locations are excluded from city and state filters" };
  return { label: lead.location || "Not provided", note: lead.location ? "Recorded location. Person city and state are not confirmed" : "Person location is not available yet" };
}

export function safeResearchUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2000 || clientOperationalNote(value, "") !== value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash || !url.hostname.includes(".") || /^(?:\d{1,3}\.){3}\d{1,3}$/.test(url.hostname) || /(?:^|\.)(?:localhost|local|internal)$/i.test(url.hostname)) return null;
    return url.toString();
  } catch { return null; }
}

export function leadEmailLabel(lead: Pick<LeadDirectoryLead, "emailVerification" | "emailValidation">): string {
  if (lead.emailValidation === "risky") return "Risky / catch-all";
  if (lead.emailValidation === "invalid") return "Invalid email";
  if (lead.emailValidation === "unknown") return "Verification unknown";
  return lead.emailVerification === "verified" ? "Verified" : lead.emailVerification === "unverified" ? "Not verified" : "Email available";
}
export function leadEmailValidationNote(lead: Pick<LeadDirectoryLead, "emailVerification" | "emailValidation">): string | undefined {
  if (lead.emailValidation !== "valid") return undefined;
  return lead.emailVerification === "verified"
    ? "Email passed the recorded validation check. This does not establish buying intent."
    : "This email passed an earlier validation check, but is not currently verified. Later delivery and unsubscribe results take precedence.";
}
export function leadLinkedInFirst(lead: Pick<LeadDirectoryLead, "emailValidation" | "contactPreference">): boolean {
  return lead.contactPreference === "linkedin_first" || ["risky", "unknown", "invalid"].includes(String(lead.emailValidation));
}
