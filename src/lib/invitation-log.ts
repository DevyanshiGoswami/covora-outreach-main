import { TeamServiceError } from "./team-transport";

export type InvitationStep = "create" | "activate" | "set_password" | "inspect" | "accept";
/** A short, log-safe reason code. */
export function reasonCode(value: unknown, fallback = "unknown"): string {
  return typeof value === "string" && /^[a-z0-9_]{1,60}$/.test(value) ? value : fallback;
}
/** Why a request to the outbound service failed, without any message text, token or address. */
export function invitationFailureReason(cause: unknown): string {
  if (cause instanceof TeamServiceError) return reasonCode(cause.reason, "team_error");
  if (cause instanceof Error && "status" in cause && typeof cause.status === "number") return `api_${cause.status}`;
  if (cause instanceof Error && cause.message === "Session required") return "session_expired";
  if (cause instanceof Error && (cause.name === "TimeoutError" || cause.name === "AbortError")) return "api_timeout";
  if (cause instanceof TypeError) return "api_unreachable";
  return "unexpected";
}
/**
 * Server log line for one invitation step in the portal, e.g. account activation, which never
 * reaches the outbound service. The outbound service records its own steps with the database reason.
 */
export function logInvitationStep(step: InvitationStep, outcome: "ok" | "failed", reason: string, extra: { clientId?: string } = {}) {
  (outcome === "ok" ? console.info : console.warn)("[invitation]", JSON.stringify({ step, outcome, reason: reasonCode(reason), ...extra }));
}
