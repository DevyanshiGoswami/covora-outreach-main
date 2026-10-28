"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { inspectInvitation, acceptInvitation, activateInvitedAccount, setInvitedAccountPassword } from "@/app/invite/actions";
import { clearInvitation } from "@/lib/invitation-session";
import { captureAccountInvitation, markAccountActivated, clearAccountActivation } from "@/lib/onboarding-invitation";
import { ROLE_LABELS, invitationAccess, type InspectedInvitation } from "@/lib/team";
// `loadedFor` is the sign-in state and attempt the result belongs to; anything older is still being checked.
type InvitationState = { token: string; loginToken?: string; needsPassword?: boolean; invitation?: InspectedInvitation; error?: string; loaded: boolean; loadedFor?: string };
export function InvitationAcceptance({ authenticated, projectUrl }: { authenticated: boolean; projectUrl: string }) {
  const router = useRouter();
  const [activationError, setActivationError] = useState("");
  const [state, setState] = useState<InvitationState>({ token: "", loaded: false });
  const currentToken = useRef("");
  const [clientId, setClientId] = useState("");
  const [pending, startTransition] = useTransition();
  const [attempt, setAttempt] = useState(0);
  const [activated, setActivated] = useState(false);
  const loadKey = `${authenticated}:${attempt}`;
  useEffect(() => {
    let active = true;
    let sequence = 0;
    async function load() {
      const request = ++sequence;
      try {
        let captured: ReturnType<typeof captureAccountInvitation>;
        try {
          captured = captureAccountInvitation(window.location.hash, window.sessionStorage, (path) => window.history.replaceState(null, "", path), projectUrl);
        } finally {
          if (window.location.hash) window.history.replaceState(null, "", "/invite");
        }
        const { token } = captured;
        currentToken.current = token;
        const response = token && authenticated ? await inspectInvitation(token) : await Promise.resolve({});
        if (active && sequence === request) setState({ ...captured, loaded: true, loadedFor: loadKey, ...response });
      } catch {
        if (active && sequence === request) setState({ token: "", loaded: true, loadedFor: loadKey, error: "Your browser could not keep this invitation while you sign in. Allow storage for this site, then reopen the invitation link." });
      }
    }
    const onHashChange = () => { currentToken.current = ""; setState({ token: "", loaded: false }); setClientId(""); void load(); };
    void load();
    window.addEventListener("hashchange", onHashChange);
    return () => { active = false; window.removeEventListener("hashchange", onHashChange); };
  }, [authenticated, projectUrl, loadKey]);
  // After activation the new session reaches this page on refresh. If it never does, stop waiting.
  useEffect(() => {
    if (!activated || authenticated) return;
    const timer = window.setTimeout(() => setActivated(false), 10000);
    return () => window.clearTimeout(timer);
  }, [activated, authenticated]);
  if (clientId) return <div className="invitation-content">
    <h1>You&apos;re ready to join in.</h1>
    <p className="muted">Your Outbound workspace access is active. Your existing password stays the same.</p>
    <Link className="primary" href={`/?client=${encodeURIComponent(clientId)}`}>Open workspace</Link>
  </div>;
  if (!state.loaded || state.loadedFor !== loadKey || (activated && !authenticated)) return <div className="invitation-content" role="status">
    <h1>Checking your invitation.</h1>
    <p className="muted">One moment while we verify the next step.</p>
  </div>;
  if (!authenticated && state.token && state.loginToken) return <div className="invitation-content">
    <h1>Welcome to Covora.</h1><p className="muted">Activate your account, choose a password, then review your workspace invitation.</p>
    {activationError && <p className="notice" role="alert">{activationError}</p>}
    <button className="primary" disabled={pending} onClick={() => startTransition(async () => {
      const token = state.token;
      try {
        const result = await activateInvitedAccount(state.loginToken!);
        if (currentToken.current !== token) return;
        if (!result.ok) { setActivationError(result.error ?? "Account activation could not be confirmed."); return; }
        markAccountActivated(window.sessionStorage, projectUrl, token);
        setActivated(true);
        setState({ ...state, loginToken: "", needsPassword: true });
        router.refresh();
      } catch { setActivationError("Account activation could not be confirmed. Reload to check your session."); }
    })}>{pending ? "Activating…" : "Activate my account"}</button>
    <Link className="secondary" href="/login?next=/invite">I already have a password</Link>
  </div>;
  if (authenticated && state.needsPassword && state.invitation && !state.error) return <div className="invitation-content">
    <h1>Create your password.</h1><p className="muted">Use at least 12 characters to secure your Covora account.</p>
    <form className="login-form" action={async form => {
      const password = String(form.get("password") ?? "");
      if (password !== form.get("confirmPassword")) { setActivationError("The passwords do not match."); return; }
      startTransition(async () => {
        const token = state.token;
        try {
          const result = await setInvitedAccountPassword(token, password);
          if (currentToken.current !== token) return;
          if (!result.ok) { setActivationError(result.error ?? "Password could not be saved."); return; }
          clearAccountActivation(window.sessionStorage, projectUrl);
          setActivationError(""); setState({ ...state, needsPassword: false });
        } catch { setActivationError("Password could not be saved. Try again."); }
      });
    }}><label className="settings-field">Password<input name="password" type="password" minLength={12} maxLength={128} required autoComplete="new-password" /></label><label className="settings-field">Confirm password<input name="confirmPassword" type="password" minLength={12} maxLength={128} required autoComplete="new-password" /></label>{activationError && <p className="notice" role="alert">{activationError}</p>}<button className="primary" disabled={pending}>{pending ? "Saving…" : "Save password"}</button></form>
  </div>;
  if (!authenticated && state.token) return <div className="invitation-content">
    <h1>Sign in to continue.</h1>
    <p className="muted">Use your Covora Outreach email and password to review this invitation. Signing in does not accept it.</p>
    <Link className="primary" href="/login?next=/invite">Sign in to review invitation</Link>
    <p className="muted">Don&apos;t have a Covora Outreach account? Ask your account manager for assisted access. This link does not create an account or send an email.</p>
  </div>;
  if (!state.token || state.error || !state.invitation) return <div className="invitation-content">
    <h1>We couldn&apos;t open this invitation.</h1>
    <p className="notice" role="alert">
      {state.error || "Open the complete invitation link shared by your account manager. The link may have expired or been replaced."}
    </p>
    {authenticated && state.token && <button className="primary" onClick={() => setAttempt(value => value + 1)}>Try again</button>}
    {authenticated ? <form action="/auth/signout?next=/invite" method="post">
      <button className="secondary">Sign out and use another account</button>
    </form> : <Link className="secondary" href="/login?next=/invite">Sign in</Link>}<p className="muted">Your account manager can check your access or share a new link. No password change is needed.</p>
  </div>;
  const invitation = state.invitation;
  const access = invitationAccess(invitation);
  return <div className="invitation-content">
    <span className="eyebrow">OUTBOUND WORKSPACE INVITATION</span>
    <h1>
      {invitation.clientName}
    </h1>
    {access.offeredRole ? <>
      <p className="muted">You&apos;ve been invited as <strong>{ROLE_LABELS[access.offeredRole]}</strong>. Accepting grants access to this Outbound workspace using your Covora Outreach account.</p>
      <p className="muted">Expires {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(invitation.expiresAt))} UTC.</p>
    </> : <p className="muted">You have already accepted this invitation. Continue with your current workspace access.</p>}
    <button className="primary" disabled={pending} onClick={() => startTransition(async () => {
      const result = await acceptInvitation(state.token);
      if (currentToken.current !== state.token) return;
      if (result.clientId && result.clientId === invitation.clientId) {
        try { clearInvitation(window.sessionStorage, projectUrl); clearAccountActivation(window.sessionStorage, projectUrl); } catch { }
        currentToken.current = ""; setState({ token: "", loaded: true }); setClientId(result.clientId);
      } else { setState({ ...state, error: result.error || "Your access could not be confirmed. Refresh and try again." }); }
    })}>
      {pending ? "Confirming access…" : access.acceptanceRequired ? "Accept workspace access" : "Continue to workspace"}
    </button>
    <form action="/auth/signout?next=/invite" method="post">
      <button className="quiet-button" disabled={pending}>Use another account</button>
    </form>
    <p className="muted">Accepting workspace access does not change your Covora Outreach password.</p>
  </div>;
}
