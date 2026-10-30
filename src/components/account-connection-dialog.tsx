"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { ArrowLeft, Check, CheckCircle2, ExternalLink, Eye, EyeOff, Mail, Network } from "lucide-react";
import { connectPerson, cancelLinkedinSignIn } from "@/app/settings/onboarding-actions";
import { openSignInWindow, finishSignInWindow } from "@/lib/sign-in-window";
import { CONNECTION_LABELS, canStartEmailConnection, consentProviderName, type EmailProvider, type OutreachPerson, type ConnectionChannel, type OnboardingActionState } from "@/lib/onboarding";
import { SettingsDialog, useSettingsAction } from "./settings-dialog";
import { EmailProviderLogo, EmailProviderPicker } from "./email-provider-picker";
import { linkedinProgress, needsLinkedinCode, type VerificationReceipt } from "@/lib/linkedin-verification";
import { LinkedinVerificationProgress } from "./linkedin-verification-progress";

function connectionUpdate(current: OnboardingActionState, next: OnboardingActionState): OnboardingActionState {
  // A throttled status read returns the saved state without a fresh progress
  // observation. Keep the last confirmed step until a new observation arrives.
  const connection = next.connection && next.connection.state === "pending" && !next.connection.nextStep && current.connection?.state === "pending"
    ? { ...next.connection, nextStep: current.connection.nextStep } : next.connection ?? current.connection;
  return { ...next, connection };
}

export function AccountConnectionDialog({ clientId, clientName, person, channel, configured, onClose }: {
  clientId: string; clientName: string; person: OutreachPerson; channel: ConnectionChannel;
  configured: Record<ConnectionChannel, boolean>; onClose: () => void;
}) {
  return <SettingsDialog title={channel === "email" ? "Connect email" : "Connect LinkedIn"} description={clientName} returnFocusId={`person-${person.id}-${channel}`} onClose={onClose}>
    <PersonConnectionForm key={`${person.id}:${channel}`} clientId={clientId} person={person} channel={channel} configured={configured[channel]} onClose={onClose} />
  </SettingsDialog>;
}

function PersonConnectionForm({ clientId, person, channel, configured, onClose }: {
  clientId: string; person: OutreachPerson; channel: ConnectionChannel; configured: boolean; onClose: () => void;
}) {
  const panelId = useId();
  const saved = person.connections.find(connection => connection.channel === channel);
  const [result, setResult] = useState<OnboardingActionState>({});
  const [provider, setProvider] = useState<EmailProvider | null>(null);
  const [choosingProvider, setChoosingProvider] = useState(false);
  const [choosingLinkedin, setChoosingLinkedin] = useState(false);
  const [confirmLinkedinCancel, setConfirmLinkedinCancel] = useState(false);
  const [linkedinMethod, setLinkedinMethod] = useState<"password" | "cookies">("password");
  // The picker default does not identify a saved attempt after reopening.
  const [startedLinkedinMethod, setStartedLinkedinMethod] = useState<"password" | "cookies">();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [mailbox, setMailbox] = useState(saved?.state !== "disconnected" && saved?.address ? saved.address : person.email);
  const [linkedinEmail, setLinkedinEmail] = useState(saved?.state !== "disconnected" ? saved?.loginEmail ?? (saved?.address?.includes("@") ? saved.address : person.email) : person.email);
  const [linkedinCountry, setLinkedinCountry] = useState("");
  const [linkedinProfile, setLinkedinProfile] = useState("");
  const [linkedinPin, setLinkedinPin] = useState("");
  const [enteringLinkedinCode, setEnteringLinkedinCode] = useState(false);
  const [verificationReceipt, setVerificationReceipt] = useState<VerificationReceipt>();
  const [checkingLinkedin, setCheckingLinkedin] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const busy = useRef(false);
  const backgroundCheck = useRef<Promise<void> | null>(null);
  const checkedOnOpen = useRef(false);
  const [operation, setOperation] = useState("");
  const authWindow = useRef<Window | null>(null);
  const openedSignInWindow = useRef<Window | null>(null);
  const [, startTransition] = useTransition();
  const [, submit, pending] = useSettingsAction<OnboardingActionState>(async (previous, form) => {
    if (busy.current) return previous;
    busy.current = true;
    try {
      // Finish a background read before a deliberate code submission/check.
      // The user's action stays queued rather than being silently discarded.
      await backgroundCheck.current;
      const cancelling = ["cancel", "check-cancel"].includes(String(form.get("operation")));
      const next = await (cancelling ? cancelLinkedinSignIn : connectPerson)(previous, form);
      if (cancelling && next.connection?.state === "disconnected") {
        setConfirmLinkedinCancel(false); setChoosingLinkedin(true); setLinkedinEmail(""); setLinkedinProfile("");
      }
      finishSignInWindow(authWindow.current, next.connection?.authUrl);
      authWindow.current = null;
      setResult(current => connectionUpdate(current, next));
      if (channel === "linkedin" && form.get("operation") === "review" && next.connection?.state === "pending" && (saved?.loginEmail || saved?.address?.includes("@"))) setLinkedinEmail(saved.loginEmail ?? saved.address!);
      if (next.connection && next.connection.state !== "pending" && next.connection.state !== "starting") {
        setLinkedinPin(""); setEnteringLinkedinCode(false); setVerificationReceipt(undefined);
      } else if (form.get("operation") === "pin") {
        const kind = next.codeSubmission ?? "unconfirmed";
        setVerificationReceipt(current => ({ kind, at: current?.at ?? Date.now() }));
        setEnteringLinkedinCode(kind === "rejected" || kind === "not_submitted");
      }
      if (next.connection?.state === "connected" || (String(form.get("operation")).startsWith("switch") && !next.error)) setChoosingProvider(false);
      return next;
    } catch {
      finishSignInWindow(authWindow.current); authWindow.current = null;
      const next = { error: "Your session or access changed. Reload this page to continue." };
      setResult(current => ({ ...next, connection: current.connection }));
      if (form.get("operation") === "pin") setEnteringLinkedinCode(false);
      return next;
    } finally {
      // A status read must not erase a code the person is still entering.
      // Submitted secrets are cleared even after denied or uncertain outcomes.
      if (form.get("operation") === "pin") setLinkedinPin("");
      for (const name of ["cookies", "password"]) {
        const field = formRef.current?.elements.namedItem(name);
        if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) field.value = "";
      }
      busy.current = false;
    }
  }, {});
  const state = result.connection?.state ?? saved?.state;
  const active = state === "pending" || state === "starting";
  const linkedinStep = active ? result.connection?.nextStep : undefined;
  const showLinkedinCode = active && needsLinkedinCode(enteringLinkedinCode, linkedinStep, verificationReceipt);
  const uncertain = state === "uncertain" || state === "needs_review";
  const connected = state === "connected";
  const canContinue = person.canConnect && saved?.canContinue !== false;
  const error = result.error;
  const authUrl = active && canContinue ? result.connection?.authUrl : null;
  useEffect(() => {
    if (!configured || !active || !canContinue || error || confirmLinkedinCancel) return;
    const checkStatus = () => {
      if (busy.current || backgroundCheck.current || document.visibilityState !== "visible") return;
      if (channel === "linkedin") setCheckingLinkedin(true);
      const request = (async () => {
        const form = new FormData();
        for (const [key, value] of Object.entries({ clientId, personId: person.id, channel, operation: "poll" })) form.set(key, value);
        try {
          const next = await connectPerson({}, form);
          setResult(current => connectionUpdate(current, next));
          if (next.connection && next.connection.state !== "pending" && next.connection.state !== "starting") {
            setLinkedinPin(""); setEnteringLinkedinCode(false); setVerificationReceipt(undefined);
          }
        } catch { setResult(current => ({ error: "We couldn’t check the connection. Try Check connection status below.", connection: current.connection })); }
      })();
      backgroundCheck.current = request;
      startTransition(async () => { try { await request; } finally { backgroundCheck.current = null; setCheckingLinkedin(false); } });
    };
    // Reopening a pending LinkedIn attempt should immediately read its status.
    // A code request is never inferred from the saved generic pending state.
    const initial = channel === "linkedin" && !checkedOnOpen.current ? window.setTimeout(() => { checkedOnOpen.current = true; checkStatus(); }, 500) : undefined;
    const timer = window.setInterval(checkStatus, 10000);
    window.addEventListener("focus", checkStatus);
    document.addEventListener("visibilitychange", checkStatus);
    return () => {
      window.clearTimeout(initial); window.clearInterval(timer);
      window.removeEventListener("focus", checkStatus); document.removeEventListener("visibilitychange", checkStatus);
    };
  }, [configured, active, canContinue, error, confirmLinkedinCancel, clientId, person.id, channel]);

  const removing = state === "disconnecting" || state === "disconnect_uncertain";
  const canCancelLinkedin = channel === "linkedin" && person.canConnect && saved?.canCancel && state !== "connected" && state !== "disconnected";
  const blocked = !person.canConnect || connected || removing || uncertain || (active && !canContinue);
  const canReview = configured && person.canConnect && state && (channel === "email" ? ["uncertain", "needs_review", "expired", "failed"] : ["uncertain", "needs_review", "failed", "expired"]).includes(state);
  const canStartEmail = canStartEmailConnection(provider, mailbox);
  const inFlight = pending;
  const isStarting = pending && operation.startsWith("start");
  const isSwitching = pending && operation.startsWith("switch");
  const submittingCode = pending && operation === "pin";
  const progress = linkedinProgress({ submitting: submittingCode, showCode: showLinkedinCode, step: linkedinStep, receipt: verificationReceipt, paused: Boolean(error), method: startedLinkedinMethod });
  const label = channel === "email" ? "Email" : "LinkedIn";
  const status = channel === "linkedin" && active ? progress.badge
    : inFlight ? isStarting ? channel === "email" ? "Opening sign-in…" : "Connecting…" : "Checking…" : connected ? "Connected" : !configured ? "Not enabled"
      : state ? CONNECTION_LABELS[state] : "Not connected";
  const showProviderPicker = channel === "email" && configured && person.canConnect && !connected && !removing
    && ((!active && !uncertain) || (choosingProvider && canContinue));
  const previousSignIn = active || uncertain;
  const chooseAnotherProvider = () => {
    // Closing our popup does not revoke remote consent. Keep the saved attempt
    // and check it before permitting another sign-in.
    try { openedSignInWindow.current?.close(); } catch { /* The user can close it manually. */ }
    openedSignInWindow.current = null;
    setProvider(null);
    setChoosingProvider(true);
  };

  return <>
    <div className="settings-dialog-body connection-dialog-body">
      <div className="connection-person"><span className="people-avatar" aria-hidden="true">{person.name.trim().slice(0, 1).toUpperCase()}</span><div><strong>{person.name}{person.isSelf ? " · You" : ""}</strong><span>{person.email}</span></div></div>
      {connected && <div className="connection-complete" role="status"><CheckCircle2 size={20} aria-hidden="true" /><div><strong>Account connected</strong><p>This person’s setup is complete.</p></div></div>}
    <form id={`${panelId}-form`} ref={formRef} action={submit} onReset={event => event.preventDefault()} className={`connection-channel ${connected ? "is-connected" : ""}`} aria-label={`${label} connection`} onSubmit={event => {
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    if (!(submitter instanceof HTMLButtonElement) || busy.current || inFlight) { event.preventDefault(); return; }
    setOperation(submitter.value);
    setPasswordVisible(false);
    if (channel === "linkedin" && submitter.value === "pin") {
      setVerificationReceipt({ kind: "unconfirmed", at: Date.now() }); setEnteringLinkedinCode(true);
    }
    if (channel === "linkedin" && submitter.dataset.appApproved === "true") {
      setVerificationReceipt({ kind: "app_approved", at: Date.now() }); setEnteringLinkedinCode(false); setLinkedinPin("");
    }
    if (channel === "linkedin" && submitter.value.startsWith("start") && (blocked || active || !configured)) { event.preventDefault(); return; }
    if (channel === "linkedin" && submitter.value.startsWith("start")) {
      setChoosingLinkedin(false); setStartedLinkedinMethod(submitter.value === "start-cookies" ? "cookies" : "password");
    }
    if (channel === "linkedin" && submitter.value === "start-cookies") {
      const userAgent = event.currentTarget.elements.namedItem("userAgent");
      if (userAgent instanceof HTMLInputElement) userAgent.value = window.navigator.userAgent;
    }
    if (channel === "email" && submitter.value.startsWith("switch")) {
      if (!canStartEmail || !configured || !active || !canContinue) { event.preventDefault(); return; }
      authWindow.current = openSignInWindow(provider === "microsoft" ? "microsoft" : "google");
      openedSignInWindow.current = authWindow.current;
    } else if (channel === "email" && submitter.value.startsWith("start")) {
      if (!canStartEmail || !configured || blocked || active) { event.preventDefault(); return; }
      setChoosingProvider(false);
      authWindow.current = openSignInWindow(provider === "microsoft" ? "microsoft" : "google");
      openedSignInWindow.current = authWindow.current;
    } else if (channel === "email" && submitter.dataset.resume === "true" && active && !authUrl && canContinue) {
      authWindow.current = openSignInWindow();
      openedSignInWindow.current = authWindow.current;
    }
  }}>
    <div className="connection-channel-toggle">
      <span className="connection-channel-icon" aria-hidden="true">{channel === "email" ? <Mail size={20} /> : <Network size={20} />}</span>
      <span className="connection-channel-title"><strong>{label}</strong>{!connected && <span>{!configured ? "Your agency needs to enable this" : choosingProvider ? "Choose your email provider" : choosingLinkedin ? "Choose how to connect" : active ? channel === "linkedin" ? "Connection in progress" : "Finish your sign-in" : uncertain ? "Confirm the last attempt" : channel === "email" ? "Google Workspace or Microsoft" : "Connect your LinkedIn profile"}</span>}</span>
      <span className={`settings-status ${connected ? "account-status-connected" : uncertain || state === "failed" ? "account-status-attention" : ""}`} role="status">{connected && <Check size={13} aria-hidden="true" />}{status}</span>
    </div>
    <div id={panelId} className="connection-channel-body">
      <input type="hidden" name="clientId" value={clientId} /><input type="hidden" name="personId" value={person.id} />
      <input type="hidden" name="connectionId" value={saved?.id ?? ""} /><input type="hidden" name="channel" value={channel} />
      {channel === "email" && <label className="settings-field">Sending mailbox<input name="email" type="email" required maxLength={254} value={mailbox} readOnly={active || uncertain || connected || removing || Boolean(saved && saved.state !== "disconnected")}
        disabled={inFlight} onChange={event => { setMailbox(event.target.value); setProvider(null); }} /><small>Your sending mailbox can differ from your Covora login. Disconnect a connected mailbox before replacing it.</small></label>}
      {removing && !canCancelLinkedin && <p className="connection-notice">The previous account is being disconnected. Close this dialog and check its disconnection status before connecting again.</p>}
      {error && <p className="connection-notice connection-notice-error" role="alert">{error}</p>}
      {!connected && result.message && <p className="connection-notice" role="status">{result.message}</p>}
      {result.retryAt && (choosingProvider || uncertain) && !connected && <p className="settings-help">{choosingProvider ? "If the previous sign-in stays open, check again after " : "Check again after "}<time dateTime={result.retryAt}>{new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit", timeZoneName: "short" }).format(new Date(result.retryAt))}</time>. Checking does not extend the wait.</p>}
      {connected ? <p className="settings-help">This account is connected. No further setup is needed.{saved?.state === "connected" && <> Last confirmed {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(saved.updatedAt))}.</>}</p>
        : !configured ? <p className="settings-help">Ask your agency owner to enable {label} for this workspace. You can connect it here once it’s enabled.</p>
        : canCancelLinkedin && (confirmLinkedinCancel || removing) ? <div className="connection-provider-wait">
          <strong>{removing ? "Ending the previous sign-in" : "Use another LinkedIn account?"}</strong>
          <p>Previous sign-in: <strong>{saved?.loginEmail ?? saved?.address}</strong></p>
          <p>This ends the previous sign-in and removes its unfinished outreach connection. Once confirmed, you can enter a different LinkedIn email.</p>
          <button className="settings-button settings-button-primary connection-primary" name="operation" value={removing ? "check-cancel" : "cancel"} formNoValidate disabled={inFlight}>
            {inFlight ? "Checking…" : removing ? "Check cancellation" : "End sign-in and continue"}
          </button>
          {!removing && <button type="button" className="connection-text-button" disabled={inFlight} onClick={() => setConfirmLinkedinCancel(false)}>Keep previous sign-in</button>}
        </div>
        : canCancelLinkedin && (state === "failed" || state === "expired") ? <div className="connection-provider-wait">
          <strong>The previous sign-in didn’t finish</strong>
          <p>LinkedIn email: <strong>{saved?.loginEmail ?? linkedinEmail}</strong></p>
          <p>Check whether it completed, or end this attempt to try again with any LinkedIn account.</p>
          <button className="settings-button connection-primary" name="operation" value="review" formNoValidate disabled={inFlight}>Check previous sign-in</button>
        </div>
        : showProviderPicker ? <>
          <EmailProviderPicker selected={provider} disabled={inFlight} onSelect={setProvider} />
          {previousSignIn ? <div className="connection-provider-wait" role="status">
            <strong>{uncertain ? "Check the previous sign-in" : "Previous sign-in still pending"}</strong>
            <p>{active && canContinue ? "Close any previous sign-in windows. You can check the previous sign-in, or end it and continue with the provider you choose above. If it already finished, we’ll keep that connection."
              : "You can choose a different provider above. Close any previous sign-in windows, then check status. Closing a window may not end sign-in immediately; we’ll enable Continue when the earlier attempt ends."}</p>
            {active && canContinue && provider && <button className="settings-button settings-button-primary connection-primary" name="operation" value={`switch-${provider}`} disabled={inFlight || !canStartEmail}>
              {isSwitching ? "Opening sign-in…" : provider === "microsoft" ? "End it and continue with Microsoft" : "End it and continue with Google"}</button>}
            <button className="settings-button connection-primary" name="operation" value={uncertain ? "review" : "poll"} disabled={inFlight}>{inFlight && !isSwitching ? "Checking…" : "Check previous sign-in"}</button>
          </div> : <>
            <button className="settings-button settings-button-primary connection-primary" name="operation" value={provider === "microsoft" ? "start-microsoft" : "start-google"} disabled={inFlight || !canStartEmail}>
              {isStarting ? "Opening sign-in…" : provider === "microsoft" ? "Continue with Microsoft" : provider === "google" ? "Continue with Google" : "Choose a provider above"}
            </button>
            <p className="connection-caption">A sign-in window will open for {mailbox}. You can change your choice before continuing.</p>
          </>}
          <details className="connection-help"><summary>Personal Gmail or another provider?</summary><p>These connection methods aren’t available here yet. Ask your agency owner for help, or connect LinkedIn.</p></details>
          {!previousSignIn && canReview && <button className="connection-text-button" name="operation" value="review" disabled={inFlight}>Already signed in? Check status</button>}
        </>
        : uncertain ? <>
          {!result.message && !error && <p className="settings-help">{channel === "email" ? "We haven’t confirmed the last attempt yet. Check its status before signing in again." : "We haven’t confirmed the last LinkedIn attempt yet. Check its status before connecting again."}</p>}
          {canReview && <button className="settings-button settings-button-primary connection-primary" name="operation" value="review" disabled={inFlight}>{inFlight ? "Checking…" : "Check connection status"}</button>}
          {channel === "email" && canContinue && <button type="button" className="connection-text-button connection-provider-back" disabled={inFlight} onClick={chooseAnotherProvider}><ArrowLeft size={14} aria-hidden="true" />Choose another provider</button>}
        </>
        : active && !choosingLinkedin ? <>
          {channel === "linkedin" && <p className="settings-help">LinkedIn sign-in: <strong>{linkedinEmail}</strong></p>}
          {!canContinue ? <p className="settings-help">The person who started this sign-in needs to finish it.</p> : <>
            {channel === "email" ? <>
              <p className="settings-help">Finish signing in with the email shown above. We’ll check the connection automatically.</p>
              {authUrl && <div className="connection-sign-in-provider"><EmailProviderLogo provider={consentProviderName(authUrl) === "Microsoft" ? "microsoft" : "google"} /><span>Signing in with <strong>{consentProviderName(authUrl)}</strong></span></div>}
              {authUrl ? <a className="settings-button settings-button-primary connection-primary" href={authUrl} target="_blank" rel="noopener noreferrer">Open {consentProviderName(authUrl)} sign-in <ExternalLink size={14} aria-hidden="true" /></a>
                : <button className="settings-button settings-button-primary connection-primary" name="operation" value="poll" data-resume="true" disabled={inFlight}>Reopen sign-in window <ExternalLink size={14} aria-hidden="true" /></button>}
              <button className="connection-text-button" name="operation" value="poll" disabled={inFlight}>{inFlight ? "Checking…" : "I’ve finished signing in — check status"}</button>
              <button type="button" className="connection-text-button connection-provider-back" disabled={inFlight} onClick={chooseAnotherProvider}><ArrowLeft size={14} aria-hidden="true" />Choose another provider</button>
            </> : <>
              <LinkedinVerificationProgress key={verificationReceipt?.at ?? "initial"} progress={progress} checking={checkingLinkedin || (inFlight && operation === "poll")} paused={Boolean(error) || submittingCode} submitting={submittingCode} showCode={showLinkedinCode} browserSession={startedLinkedinMethod === "cookies" && !verificationReceipt} />
              {showLinkedinCode ? <>
                <label className="settings-field">Verification code<input name="pin" inputMode="numeric" pattern="[0-9]{4,10}" autoComplete="one-time-code" value={linkedinPin} disabled={inFlight} onChange={event => { setLinkedinPin(event.target.value); setEnteringLinkedinCode(true); }} autoFocus required /></label>
                <button className="settings-button settings-button-primary connection-primary" name="operation" value="pin" disabled={inFlight}>{submittingCode ? "Submitting code…" : "Submit verification code"}</button>
              </> : verificationReceipt || startedLinkedinMethod !== "password" ? <details className="connection-help linkedin-verification-help">
                <summary>{verificationReceipt ? "LinkedIn asking you to verify again?" : "Did LinkedIn ask you to verify?"}</summary>
                <p>Only enter a code if LinkedIn sent one for this sign-in. If it asks for approval in the app, approve it there first.</p>
                <button type="button" className="settings-button connection-primary" disabled={inFlight} onClick={() => setEnteringLinkedinCode(true)}>{verificationReceipt ? "Enter a new verification code" : "I received a verification code"}</button>
                <button className="connection-text-button" name="operation" value="poll" data-app-approved="true" formNoValidate disabled={inFlight}>I approved it in the LinkedIn app</button>
              </details> : <button type="button" className="settings-button connection-primary" disabled={inFlight} onClick={() => setEnteringLinkedinCode(true)}>I received a verification code</button>}
              {(showLinkedinCode || (!verificationReceipt && startedLinkedinMethod === "password")) && <button className="connection-text-button" name="operation" value="poll" data-app-approved="true" formNoValidate disabled={inFlight}>I approved it in the LinkedIn app</button>}
              {!showLinkedinCode && <p className="connection-caption">You can return to Accounts and check this sign-in later.</p>}
              <button type="button" className="connection-text-button connection-provider-back" disabled={inFlight} onClick={() => setChoosingLinkedin(true)}><ArrowLeft size={14} aria-hidden="true" />Back to connection options</button>
            </>}
          </>}
        </>
        : !blocked && <>
          {channel === "email" ? <p className="connection-notice">Personal Gmail connections aren’t available here yet. Ask your agency owner for help, or connect LinkedIn.</p> : <>
            <fieldset className="email-provider-picker" disabled={inFlight}>
              <legend>How would you like to connect?</legend>
              <div className="email-provider-options">{([
                ["password", "Email & password", "Sign in and enter a verification code if asked."],
                ["cookies", "Browser session", "Use a LinkedIn session exported from Chrome."],
              ] as const).map(([value, title, description]) => <label key={value} className={`email-provider-option ${linkedinMethod === value ? "is-selected" : ""}`}>
                <input type="radio" name="linkedinMethod" value={value} checked={linkedinMethod === value} onChange={() => { setLinkedinMethod(value); setPasswordVisible(false); setResult(current => ({ connection: current.connection })); }} />
                <span><strong>{title}</strong><small>{description}</small></span>
              </label>)}</div>
            </fieldset>
            {active ? <div className="connection-provider-wait" role="status"><strong>Your previous connection is still pending</strong><p>You can choose a method now. Check the previous attempt before starting again; we’ll enable sign-in after it ends.</p><button type="button" className="connection-text-button" onClick={() => setChoosingLinkedin(false)}>View connection progress</button></div> : <>
            <label className="settings-field">LinkedIn email<input disabled={inFlight} name="email" type="email" value={linkedinEmail} onChange={event => setLinkedinEmail(event.target.value)} aria-describedby={`${panelId}-email-help`} autoComplete="off" required /></label>
            <p id={`${panelId}-email-help`} className="settings-help">Use the email you sign into LinkedIn with. It can differ from your work or Covora email.</p>
            {linkedinMethod === "cookies" ? <>
              <div className="connection-session-guide">
                <strong>Bring your signed-in session</strong>
                <ol><li>In Chrome, sign into your own account at <a href="https://www.linkedin.com/" target="_blank" rel="noopener noreferrer">linkedin.com <ExternalLink size={12} aria-hidden="true" /></a>.</li>
                  <li>Use the <a href="https://chromewebstore.google.com/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm" target="_blank" rel="noopener noreferrer">Cookie-Editor extension</a> on that LinkedIn tab and choose <strong>Export → JSON</strong>.</li>
                  <li>Return here in the same browser. Paste the export below and enter that account’s profile URL.</li></ol>
                <p>The session gives access to your LinkedIn account. Only import your own session or one the account owner has authorized.</p>
              </div>
              <label className="settings-field">LinkedIn profile URL<input disabled={inFlight} name="profileUrl" type="url" value={linkedinProfile} onChange={event => setLinkedinProfile(event.target.value)} placeholder="https://www.linkedin.com/in/your-name" required maxLength={500} autoComplete="off" /><small>We’ll check that the connected profile matches this URL.</small></label>
              <label className="settings-field">Session cookies (JSON)<textarea disabled={inFlight} name="cookies" rows={4} required maxLength={65536} spellCheck={false} autoComplete="off" placeholder="Paste the JSON export from your LinkedIn tab" /></label>
              <input type="hidden" name="userAgent" />
              <p className="settings-help">If you sign out of LinkedIn or the session expires, you may need to reconnect.</p>
            </> : <div className="settings-field">
              <label htmlFor={`${panelId}-password`}>LinkedIn password</label>
              <div className="connection-password-field">
                <input id={`${panelId}-password`} disabled={inFlight} name="password" type={passwordVisible ? "text" : "password"} autoComplete="off" autoCapitalize="none" spellCheck={false} required maxLength={512} />
                <button type="button" className="connection-password-toggle" aria-label={passwordVisible ? "Hide password" : "Show password"} aria-controls={`${panelId}-password`} aria-pressed={passwordVisible} disabled={inFlight} onClick={() => setPasswordVisible(visible => !visible)}>
                  {passwordVisible ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}<span>{passwordVisible ? "Hide" : "Show"}</span>
                </button>
              </div>
            </div>}
            <label className="settings-field">Country code<input disabled={inFlight} name="country" value={linkedinCountry} onChange={event => setLinkedinCountry(event.target.value.toUpperCase())} placeholder="US" pattern="[A-Za-z]{2}" maxLength={2} required /><small>Where you’re connecting from: US for United States, IN for India, GB for United Kingdom.</small></label>
            <button className="settings-button settings-button-primary connection-primary" name="operation" value={linkedinMethod === "cookies" ? "start-cookies" : "start"} disabled={inFlight}>{isStarting ? "Connecting…" : linkedinMethod === "cookies" ? "Connect with browser session" : "Connect LinkedIn"}</button>
            <p className="connection-caption">{linkedinMethod === "cookies" ? "Your session is forwarded to connect your account. Covora doesn’t save the cookies." : "Your password is used for this sign-in and isn’t saved by Covora."}</p>
            </>}
          </>}
          {canReview && <button className="connection-text-button" name="operation" value="review" formNoValidate disabled={inFlight}>Check previous sign-in</button>}
        </>}
      {canCancelLinkedin && !confirmLinkedinCancel && !removing && <button type="button" className="connection-text-button connection-provider-back" disabled={inFlight} onClick={() => { setConfirmLinkedinCancel(true); setResult(current => ({ connection: current.connection })); }}>Use another account</button>}
    </div>
  </form>
  </div>
  <footer className="settings-dialog-footer connection-dialog-footer connection-dialog-navigation">
    <button type="button" className={`settings-button ${connected ? "settings-button-primary" : ""}`} disabled={inFlight} onClick={onClose}>{connected ? "Done" : "Back to accounts"}</button>
    {channel === "linkedin" && active && canContinue && configured && !confirmLinkedinCancel
      ? <button form={`${panelId}-form`} formNoValidate className="settings-button settings-button-primary" name="operation" value="poll" disabled={inFlight}>{inFlight && operation === "poll" ? "Checking…" : "Check connection status"}</button>
      : <p>Connecting an account doesn’t start outreach.</p>}
  </footer>
  </>;
}
