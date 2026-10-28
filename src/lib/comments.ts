import type { OutreachRole, Workspace } from "./access";
import { isUuid } from "./team";

export const COMMENTS_CLIENT_ID = "26a2cffb-47f4-4231-9195-b4f772751c6d";
export const COMMENT_STATUSES = { open: "Open", in_progress: "In progress", resolved: "Resolved" } as const;
export type CommentStatus = keyof typeof COMMENT_STATUSES;
export type CommentFilter = CommentStatus | "all";
export type CommentRequest = { id: string; clientId: string; title: string; status: CommentStatus; version: number; createdAt: string; updatedAt: string; authorName: string; replyCount: number };
export type CommentMessage = { id: string; requestId: string; clientId: string; body: string; authorName: string; createdAt: string };
export type CommentPage = { clientId: string; enabled: boolean; permissions: { canComment: boolean; canManage: boolean }; requests: CommentRequest[]; hasMore: boolean };
export type CommentDetail = { clientId: string; request: CommentRequest & { body: string }; messages: CommentMessage[]; hasMore: boolean };
export type CommentActionState = { error?: string; requestId?: string; ok?: boolean };

export function hasComments(clientId: string | null): boolean { return clientId === COMMENTS_CLIENT_ID; }
export function canComment(role: OutreachRole | null): boolean { return role !== null && role !== "client_viewer"; }
export function canManageComments(role: OutreachRole | null): boolean { return role === "agency_owner" || role === "operator"; }
export function commentsAccess(workspace: Workspace, clientId: string): boolean { return workspace.enabled && workspace.clientId === clientId && hasComments(clientId); }
export function isCommentStatus(value: unknown): value is CommentStatus { return value === "open" || value === "in_progress" || value === "resolved"; }
export function commentsQuery(params: Record<string, string | string[] | undefined>) {
  const offset = (value: unknown) => typeof value === "string" && /^\d{1,6}$/.test(value) && Number(value) <= 100000 && Number(value) % 25 === 0 ? Number(value) : 0;
  return { status: (isCommentStatus(params.status) ? params.status : "all") as CommentFilter, offset: offset(params.offset), messageOffset: offset(params.messageOffset), requestId: isUuid(params.request) ? params.request : null };
}
export function commentsUrl(clientId: string, options: { status?: CommentFilter; offset?: number; requestId?: string | null; messageOffset?: number } = {}): string {
  const query = new URLSearchParams({ client: clientId });
  if (options.status && options.status !== "all") query.set("status", options.status);
  if (options.offset) query.set("offset", String(options.offset));
  if (options.requestId) query.set("request", options.requestId);
  if (options.messageOffset) query.set("messageOffset", String(options.messageOffset));
  return `/comments?${query}`;
}
const record = (value: unknown): Record<string, unknown> => { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid comments response"); return value as Record<string, unknown>; };
const text = (value: unknown, max: number): string => { if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error("Invalid comments response"); return value; };
const date = (value: unknown): string => { const result = text(value, 40); if (!Number.isFinite(Date.parse(result))) throw new Error("Invalid comments response"); return result; };
const integer = (value: unknown, min = 0): number => { if (!Number.isSafeInteger(value) || (value as number) < min) throw new Error("Invalid comments response"); return value as number; };
const boolean = (value: unknown): boolean => { if (typeof value !== "boolean") throw new Error("Invalid comments response"); return value; };
function requestFromResponse(value: unknown, clientId: string): CommentRequest {
  const row = record(value);
  if (!isUuid(row.id) || row.clientId !== clientId || !isCommentStatus(row.status)) throw new Error("Invalid comments response");
  return { id: row.id, clientId, title: text(row.title, 120), status: row.status, version: integer(row.version, 1), createdAt: date(row.createdAt), updatedAt: date(row.updatedAt), authorName: text(row.authorName, 400), replyCount: integer(row.replyCount) };
}
export function commentPageFromResponse(value: unknown, clientId: string): CommentPage {
  const data = record(value), permissions = record(data.permissions);
  if (data.clientId !== clientId || !Array.isArray(data.requests) || data.requests.length > 25) throw new Error("Invalid comments response");
  return { clientId, enabled: boolean(data.enabled), permissions: { canComment: boolean(permissions.canComment), canManage: boolean(permissions.canManage) }, requests: data.requests.map(row => requestFromResponse(row, clientId)), hasMore: boolean(data.hasMore) };
}
export function commentDetailFromResponse(value: unknown, clientId: string, requestId: string): CommentDetail {
  const data = record(value), request = record(data.request);
  if (data.clientId !== clientId || request.id !== requestId || !Array.isArray(data.messages) || data.messages.length > 25) throw new Error("Invalid comments response");
  return { clientId, request: { ...requestFromResponse(request, clientId), body: text(request.body, 5000) }, messages: data.messages.map(value => {
    const row = record(value);
    if (!isUuid(row.id) || row.clientId !== clientId || row.requestId !== requestId) throw new Error("Invalid comments response");
    return { id: row.id, clientId, requestId, body: text(row.body, 5000), authorName: text(row.authorName, 400), createdAt: date(row.createdAt) };
  }), hasMore: boolean(data.hasMore) };
}
export function parseCommentInput(value: Record<string, unknown>, kind: "create" | "reply") {
  const { clientId, commandId, requestId } = value;
  const body = typeof value.body === "string" ? value.body.trim() : "";
  const title = typeof value.title === "string" ? value.title.trim() : "";
  if (!isUuid(clientId) || !hasComments(clientId) || !isUuid(commandId) || !body || body.length > 5000 || (kind === "create" && (!title || title.length > 120)) || (kind === "reply" && !isUuid(requestId))) return null;
  return { clientId, commandId, body, title, requestId: isUuid(requestId) ? requestId : null };
}
export function parseCommentStatus(value: Record<string, unknown>) {
  const { clientId, requestId, status } = value;
  const version = typeof value.expectedVersion === "string" && /^[1-9]\d*$/.test(value.expectedVersion) ? Number(value.expectedVersion) : 0;
  if (!isUuid(clientId) || !hasComments(clientId) || !isUuid(requestId) || !isCommentStatus(status) || !Number.isSafeInteger(version) || version < 1) return null;
  return { clientId, requestId, status, expectedVersion: version };
}
