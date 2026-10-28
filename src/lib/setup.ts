import { clientOperationalNote } from "./client-copy";

export const SETUP_STATUSES = ["requested", "in_progress", "needs_action", "resolved"] as const;
export type SetupStatus = (typeof SETUP_STATUSES)[number];
export function allowedSetupStatuses(current: SetupStatus): readonly SetupStatus[] {
  if (current === "resolved") return ["resolved"];
  return current === "requested" ? SETUP_STATUSES : ["in_progress", "needs_action", "resolved"];
}
export type SetupChannel = "email" | "linkedin";
export type SetupMethod = "google_workspace" | "microsoft" | "assisted";
export type SetupRequest = {
  id: string; client_id: string; channel: SetupChannel; method: SetupMethod;
  status: SetupStatus; note: string; created_at: string; updated_at: string;
};
export type SetupActionState = { error?: string; message?: string };
export const STATUS_LABELS: Record<SetupStatus, string> = {
  requested: "Requested", in_progress: "Setting up", needs_action: "Action needed", resolved: "Request closed",
};
export const STATUS_DESCRIPTIONS: Record<SetupStatus, string> = {
  requested: "Covora will review your request and share the next step here.",
  in_progress: "Covora is working on your setup. Any next steps will appear here.",
  needs_action: "Covora needs your help to continue. Contact your account manager for the next step.",
  resolved: "Covora has closed this request. Contact your account manager if you still need help.",
};
export const METHOD_LABELS: Record<SetupMethod, string> = {
  google_workspace: "Google Workspace", microsoft: "Microsoft", assisted: "Email setup",
};
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const record = (input: unknown): Record<string, unknown> => input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
export function parseSetupRequest(input: unknown): { clientId: string; channel: SetupChannel; method: SetupMethod } | null {
  const { clientId, channel, method } = record(input);
  if (!uuid(clientId) || !["email", "linkedin"].includes(String(channel)) || !["google_workspace", "microsoft", "assisted"].includes(String(method)) || (channel === "linkedin" && method !== "assisted")) return null;
  return { clientId, channel: channel as SetupChannel, method: method as SetupMethod };
}
export function parseSetupUpdate(input: unknown): { clientId: string; requestId: string; status: SetupStatus; note: string } | null {
  const { clientId, requestId, status, note } = record(input);
  if (!uuid(clientId) || !uuid(requestId) || !SETUP_STATUSES.includes(status as SetupStatus) || typeof note !== "string" || Array.from(note).length > 1000) return null;
  return { clientId, requestId, status: status as SetupStatus, note: note.trim() };
}
/** Explicitly project the safe response and fail closed on mismatched tenancy. */
export function setupRequestsFromResponse(input: unknown, clientId: string): SetupRequest[] {
  const { requests } = record(input);
  if (!Array.isArray(requests)) throw new Error("Setup requests could not be loaded. Please try again.");
  return requests.map((value) => {
    const row = record(value);
    const parsed = parseSetupRequest({ clientId: row.client_id, channel: row.channel, method: row.method });
    if (!parsed || row.client_id !== clientId || !uuid(row.id) || !SETUP_STATUSES.includes(row.status as SetupStatus) || (row.note !== null && typeof row.note !== "string") || (typeof row.note === "string" && Array.from(row.note).length > 1000) || typeof row.created_at !== "string" || !Number.isFinite(Date.parse(row.created_at)) || typeof row.updated_at !== "string" || !Number.isFinite(Date.parse(row.updated_at))) throw new Error("Setup requests could not be loaded. Please try again.");
    return { id: row.id, client_id: parsed.clientId, channel: parsed.channel, method: parsed.method, status: row.status as SetupStatus, note: clientOperationalNote(row.note ?? "", STATUS_DESCRIPTIONS[row.status as SetupStatus]), created_at: row.created_at, updated_at: row.updated_at };
  });
}
