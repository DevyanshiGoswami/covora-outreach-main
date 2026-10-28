import { captureInvitation, invitationStorageKey } from "./invitation-session";
type TabStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const key = (projectUrl: string) => `${invitationStorageKey(projectUrl)}:activation`;
export function captureAccountInvitation(fragment: string, storage: TabStorage, replace: (path: string) => void, projectUrl: string) {
  if (fragment) {
    storage.removeItem(key(projectUrl));
    const match = /^#token=([a-f0-9]{64})&login=([A-Za-z0-9_-]{20,256})$/.exec(fragment);
    if (match) {
      storage.setItem(key(projectUrl), JSON.stringify({ token: match[1], loginToken: match[2], needsPassword: false }));
      fragment = `#token=${match[1]}`;
    }
  }
  const token = captureInvitation(fragment, storage, replace, projectUrl);
  let loginToken = ""; let needsPassword = false;
  try {
    const saved = JSON.parse(storage.getItem(key(projectUrl)) ?? "null");
    if (token && saved?.token === token) {
      loginToken = typeof saved.loginToken === "string" && /^[A-Za-z0-9_-]{20,256}$/.test(saved.loginToken) ? saved.loginToken : "";
      needsPassword = saved.needsPassword === true;
    } else storage.removeItem(key(projectUrl));
  } catch { storage.removeItem(key(projectUrl)); }
  return { token, loginToken, needsPassword };
}
export function markAccountActivated(storage: TabStorage, projectUrl: string, token: string) {
  storage.setItem(key(projectUrl), JSON.stringify({ token, needsPassword: true }));
}
export function clearAccountActivation(storage: TabStorage, projectUrl: string) { storage.removeItem(key(projectUrl)); }
