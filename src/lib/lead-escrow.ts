import { canManageSetup, type Workspace } from "./access";
import { clientOperationalNote } from "./client-copy";
import { leadDirectoryFromResponse, parseLeadDirectoryQuery, VERIFIED_LEADS_PAGE_SIZE, type LeadDirectoryLead } from "./verified-leads";

export type EscrowQuery = { q: string; page: number };
export type EscrowLead = LeadDirectoryLead & { reviewState: "escrow"; reviewReason: string | null; reviewedAt: string | null };
export type EscrowPage = { clientId: string; leads: EscrowLead[]; total: number; page: number; pageSize: 36; summary: { escrow: number; clientVisible: number } };
export function parseEscrowQuery(params: Record<string, string | string[] | undefined>): EscrowQuery {
  const query = parseLeadDirectoryQuery(params);
  return { q: query.q, page: query.page };
}
export function canReadEscrow(workspace: Workspace, clientId: string): boolean {
  return workspace.enabled && workspace.clientId === clientId && canManageSetup(workspace.role) &&
    workspace.clients.some((client) => client.id === clientId && canManageSetup(client.role));
}
export function escrowHref(clientId: string, query: EscrowQuery): string {
  const params = new URLSearchParams({ client: clientId, visibility: "escrow" });
  if (query.q) params.set("q", query.q);
  if (query.page > 1) params.set("page", String(query.page));
  return `/agency/leads?${params}`;
}
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const count = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;

export function escrowFromResponse(value: unknown, clientId: string): EscrowPage {
  const fail = (): never => { throw new Error("The escrow list could not be confirmed. Please try again."); };
  const response = record(value);
  const summary = record(response.summary);
  if (!count(summary.escrow) || !count(summary.clientVisible) || !Array.isArray(response.leads)) return fail();
  // Reuse the strict tenant, contact, research and pagination projection.
  const projected = leadDirectoryFromResponse({
    ...response,
    summary: { total: summary.escrow, verifiedEmail: 0, withLinkedIn: 0, companies: 0 },
    companies: [], campaigns: [], lists: [], filterOptionsTruncated: false,
  }, clientId);
  const leads = projected.leads.map((lead, index): EscrowLead => {
    const raw = record((response.leads as unknown[])[index]);
    if (raw.campaignId !== null || raw.campaignName !== null || !raw.listId || !raw.listName || raw.priorityRank != null || raw.reviewState !== "escrow" || !(raw.reviewReason === null || typeof raw.reviewReason === "string" && raw.reviewReason.length <= 10000 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(raw.reviewReason))) return fail();
    const reviewedAt = raw.reviewedAt ?? null;
    if (!(reviewedAt === null || typeof reviewedAt === "string" && reviewedAt.length <= 50 && Number.isFinite(Date.parse(reviewedAt)))) return fail();
    return { ...lead, reviewState: "escrow", reviewReason: raw.reviewReason === null ? null : clientOperationalNote(raw.reviewReason, "Further research is required."), reviewedAt };
  });
  return { clientId, leads, total: projected.total, page: projected.page, pageSize: VERIFIED_LEADS_PAGE_SIZE, summary: { escrow: summary.escrow, clientVisible: summary.clientVisible } };
}
