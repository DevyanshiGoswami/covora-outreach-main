import type { OutreachRole } from "./access";
export const TEAM_ROLES = ["client_admin", "client_member", "client_viewer", "operator"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];
export const MEMBER_STATES = ["active", "suspended", "revoked"] as const;
export type MemberState = (typeof MEMBER_STATES)[number];
export type TeamMember = { client_id: string; user_id: string; email: string | null; role: TeamRole; state: MemberState; version: number };
export type TeamInvitation = { id: string; client_id: string; email: string; role: TeamRole; status: "pending" | "accepted" | "revoked" | "expired"; expires_at: string; created_at: string };
export type TeamData = { members: TeamMember[]; invitations: TeamInvitation[] };
export type InspectedInvitation = { id: string; clientId: string; clientName: string; role: TeamRole; expiresAt: string; status: "pending" | "accepted" };
export type TeamActionState = { error?: string; message?: string; invitation?: { invitationId: string; token: string; expiresAt: string; loginToken?: string | null } };
export const ROLE_LABELS: Record<TeamRole, string> = { client_admin: "Client administrator", client_member: "Member", client_viewer: "Viewer", operator: "Agency operator" };
export const STATE_LABELS: Record<MemberState, string> = { active: "Active", suspended: "Suspended", revoked: "Revoked" };
export const isUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export const isInvitationToken = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const validDate = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));
const isRole = (value: unknown): value is TeamRole => TEAM_ROLES.includes(value as TeamRole);
const validVersion = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
export function invitationAccess(invitation: Pick<InspectedInvitation, "status" | "role">): { offeredRole: TeamRole | null; acceptanceRequired: boolean } {
  return invitation.status === "accepted"
    ? { offeredRole: null, acceptanceRequired: false }
    : { offeredRole: invitation.role, acceptanceRequired: true };
}
export function canManageTeam(role: OutreachRole | null): boolean { return role === "client_admin" || role === "agency_owner"; }
export function manageableRoles(role: OutreachRole | null): readonly TeamRole[] { return role === "agency_owner" ? TEAM_ROLES : role === "client_admin" ? ["client_member", "client_viewer"] : []; }
export function canManageMember(actor: OutreachRole | null, target: TeamRole): boolean { return manageableRoles(actor).includes(target); }
export function parseInviteInput(input: unknown): { clientId: string; email: string; role: TeamRole } | null {
  const { clientId, email, role } = record(input);
  if (!isUuid(clientId) || typeof email !== "string" || email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || !isRole(role)) return null;
  return { clientId, email: email.trim().toLowerCase(), role };
}
export function parseMemberUpdate(input: unknown): { clientId: string; userId: string; role: TeamRole; state: MemberState; expectedVersion: number } | null {
  const row = record(input);
  const version = typeof row.expectedVersion === "string" && /^\d+$/.test(row.expectedVersion) ? Number(row.expectedVersion) : row.expectedVersion;
  if (!isUuid(row.clientId) || !isUuid(row.userId) || !isRole(row.role) || !MEMBER_STATES.includes(row.state as MemberState) || !validVersion(version)) return null;
  return { clientId: row.clientId, userId: row.userId, role: row.role, state: row.state as MemberState, expectedVersion: version };
}
export function teamFromResponse(input: unknown, clientId: string): TeamData {
  const row = record(input);
  const fail = () => { throw new Error("Team access could not be loaded."); };
  if (!Array.isArray(row.members) || !Array.isArray(row.invitations)) return fail();
  const members = row.members.map((input): TeamMember => {
    const m = record(input);
    if (m.client_id !== clientId || !isUuid(m.client_id) || !isUuid(m.user_id) || (m.email !== null && typeof m.email !== "string") || !isRole(m.role) || !MEMBER_STATES.includes(m.state as MemberState) || !validVersion(m.version)) return fail();
    return { client_id: m.client_id, user_id: m.user_id, email: m.email, role: m.role, state: m.state as MemberState, version: m.version };
  });
  const invitations = row.invitations.map((input): TeamInvitation => {
    const i = record(input);
    if (i.client_id !== clientId || !isUuid(i.client_id) || !isUuid(i.id) || typeof i.email !== "string" || !isRole(i.role) || !["pending", "accepted", "revoked", "expired"].includes(i.status as string) || !validDate(i.expires_at) || !validDate(i.created_at)) return fail();
    return { id: i.id, client_id: i.client_id, email: i.email, role: i.role, status: i.status as TeamInvitation["status"], expires_at: i.expires_at, created_at: i.created_at };
  });
  return { members, invitations };
}
export function invitationFromResponse(input: unknown): InspectedInvitation {
  const i = record(record(input).invitation);
  if (!isUuid(i.id) || !isUuid(i.clientId) || typeof i.clientName !== "string" || !isRole(i.role) || !validDate(i.expiresAt) || !["pending", "accepted"].includes(i.status as string)) throw new Error("This invitation is unavailable.");
  return { id: i.id, clientId: i.clientId, clientName: i.clientName, role: i.role, expiresAt: i.expiresAt, status: i.status as InspectedInvitation["status"] };
}
export function createdInvitationFromResponse(input: unknown): NonNullable<TeamActionState["invitation"]> {
  const i = record(input);
  if (!isUuid(i.invitationId) || !isInvitationToken(i.token) || !validDate(i.expiresAt)) throw new Error("The invitation could not be confirmed.");
  if (i.loginToken !== undefined && i.loginToken !== null && (typeof i.loginToken !== "string" || !/^[A-Za-z0-9_-]{20,256}$/.test(i.loginToken))) throw new Error("The invitation could not be confirmed.");
  return { invitationId: i.invitationId, token: i.token, expiresAt: i.expiresAt, ...(i.loginToken !== undefined ? { loginToken: i.loginToken as string | null } : {}) };
}
