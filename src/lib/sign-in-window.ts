import { emailConsentUrl, type EmailProvider } from "./onboarding";

/** Open during the click gesture so the browser does not block the async sign-in. */
export function openSignInWindow(provider?: EmailProvider): Window | null {
  try {
    const popup = window.open("about:blank", "_blank", "popup,width=520,height=720");
    if (!popup) return null;
    popup.opener = null;
    const name = provider === "microsoft" ? "Microsoft" : provider === "google" ? "Google" : "email";
    popup.document.title = `Opening ${name} sign-in`;
    const heading = popup.document.createElement("h1");
    heading.textContent = `Opening ${name} sign-in…`;
    const note = popup.document.createElement("p");
    note.textContent = "Keep this window open while we prepare your secure sign-in. If it cannot start, the details will appear in Covora.";
    popup.document.body.style.cssText = "font:16px/1.6 system-ui,sans-serif;padding:28px;color:#252933;background:#fff";
    heading.style.fontSize = "22px";
    popup.document.body.replaceChildren(heading, note);
    return popup;
  } catch { return null; }
}

export function finishSignInWindow(popup: Window | null, authUrl?: string | null): void {
  if (!popup || popup.closed) return;
  try {
    const url = emailConsentUrl(authUrl ?? null);
    if (url) popup.location.replace(url);
    else popup.close();
  } catch { popup.close(); }
}
