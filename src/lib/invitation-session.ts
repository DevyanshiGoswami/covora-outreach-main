import { isInvitationToken } from "./team";
const LEGACY_INVITATION_STORAGE_KEY = "covora.outbound.invitation";
export function invitationStorageKey(projectUrl: string): string {
  return `${LEGACY_INVITATION_STORAGE_KEY}:${new URL(projectUrl).origin}`;
}
type TabStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type LoginDestination = "/owner-invite" | "/agency/owners" | "/invite" | "/agency" | "/" | `/?client=${string}&view=inbox`;
export function safeLoginNext(value: unknown): LoginDestination {
  if (value === "/owner-invite" || value === "/agency/owners") return value;
  if (value === "/invite") return "/invite";
  if (value === "/agency") return "/agency";
  // Match only the alert's exact local route, before URL normalization can
  // discard extra syntax. Workspace membership is still checked on arrival.
  const inbox = typeof value === "string"
    ? /^\/\?client=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})&view=inbox$/i.exec(value)
    : null;
  return inbox ? `/?client=${inbox[1].toLowerCase()}&view=inbox` : "/";
}
export function loginPath(returnTo: unknown = "/"): string {
  const next = safeLoginNext(returnTo);
  return next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`;
}
export function captureInvitation(fragment: string, storage: TabStorage, replace: (path: string) => void, projectUrl: string): string {
  if (fragment) {
    const match = /^#token=([0-9a-f]{64})$/.exec(fragment);
    try {
      storage.removeItem(LEGACY_INVITATION_STORAGE_KEY);
      const key = invitationStorageKey(projectUrl);
      if (match) storage.setItem(key, match[1]);
      else storage.removeItem(key);
    } finally { replace("/invite"); }
    return match?.[1] ?? "";
  }
  storage.removeItem(LEGACY_INVITATION_STORAGE_KEY);
  const stored = storage.getItem(invitationStorageKey(projectUrl));
  return isInvitationToken(stored) ? stored : "";
}
export function clearInvitation(storage: TabStorage, projectUrl: string) { storage.removeItem(invitationStorageKey(projectUrl)); }
export function invitationLink(origin: string, token: string): string {
  if (!isInvitationToken(token)) throw new Error("Invitation link is unavailable.");
  const url = new URL("/invite", origin);
  url.hash = `token=${token}`;
  return url.toString();
}
