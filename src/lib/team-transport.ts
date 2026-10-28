/** `reason` is a short code for server logs; the message is what the person sees. */
export class TeamServiceError extends Error { constructor(message: string, readonly reason = "team_error") { super(message); } }
export function teamErrorMessage(error: unknown): string { return error instanceof TeamServiceError ? error.message : "Team access is unavailable. Refresh and try again."; }
export type TeamOperation =
  | { kind: "list"; clientId: string }
  | { kind: "owners"; body: Record<string, never> }
  | { kind: "ownerInvite" | "ownerRevoke" | "ownerRevokeInvitation" | "ownerInspect" | "ownerAccept"; body: Record<string, string | number> }
  | { kind: "create" | "revoke" | "member" | "inspect" | "accept"; body: Record<string, string | number> };
const endpoints = {
  owners: { path: "/api/outbound/owners", method: "GET" },
  ownerInvite: { path: "/api/outbound/owners/invitations", method: "POST" },
  ownerRevokeInvitation: { path: "/api/outbound/owners/invitations", method: "DELETE" },
  ownerRevoke: { path: "/api/outbound/owners", method: "DELETE" },
  ownerInspect: { path: "/api/outbound/owners/inspect", method: "POST" },
  ownerAccept: { path: "/api/outbound/owners/accept", method: "POST" },
  list: { path: "/api/outbound/team", method: "GET" },
  create: { path: "/api/outbound/team/invitations", method: "POST" },
  revoke: { path: "/api/outbound/team/invitations", method: "DELETE" },
  member: { path: "/api/outbound/team/members", method: "PATCH" },
  inspect: { path: "/api/outbound/invitations/inspect", method: "POST" },
  accept: { path: "/api/outbound/invitations/accept", method: "POST" },
} as const;
export async function teamApiRequest(origin: string, token: string, operation: TeamOperation, fetcher: typeof fetch = fetch): Promise<unknown> {
  let response: Response;
  try {
    const endpoint = endpoints[operation.kind];
    const url = new URL(endpoint.path, origin);
    if (operation.kind === "list") url.searchParams.set("clientId", operation.clientId);
    response = await fetcher(url.toString(), {
      method: endpoint.method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      ...((operation.kind === "list" || operation.kind === "owners") ? {} : { body: JSON.stringify(operation.body) }),
      cache: "no-store", credentials: "omit", redirect: "error", signal: AbortSignal.timeout(15000),
    });
  } catch (cause) { throw new TeamServiceError("Team access is temporarily unavailable. Please try again.", cause instanceof Error && cause.name === "TimeoutError" ? "api_timeout" : "api_unreachable"); }
  if (!response.ok) {
    if (response.status === 401) throw new TeamServiceError("Your session has expired. Sign in again to continue.", "session_expired");
    if (operation.kind === "inspect" || operation.kind === "accept" || operation.kind === "ownerInspect" || operation.kind === "ownerAccept") throw new TeamServiceError("This invitation is unavailable for this account. Sign in with the account the invitation was shared with, or ask your account manager for a new link.", `api_${response.status}`);
    if (response.status === 400) throw new TeamServiceError("This team request could not be completed. Refresh the page, check the current access, and try again.", "api_400");
    if (response.status === 403) throw new TeamServiceError("You no longer have permission to manage this team. Refresh your workspace.", "api_403");
    throw new TeamServiceError("Team access could not be saved or loaded. Please try again.", `api_${response.status}`);
  }
  try { return await response.json(); }
  catch { throw new TeamServiceError("The team response could not be confirmed. Refresh before trying again.", "bad_response"); }
}
