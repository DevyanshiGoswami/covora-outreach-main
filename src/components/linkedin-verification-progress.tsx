"use client";

import { useEffect, useState } from "react";
import { Check, Clock3, ShieldCheck } from "lucide-react";
import { linkedinProgress } from "@/lib/linkedin-verification";

export function LinkedinVerificationProgress({ progress, checking, paused, submitting, showCode, browserSession }: {
  progress: ReturnType<typeof linkedinProgress>; checking: boolean; paused: boolean; submitting: boolean; showCode: boolean; browserSession: boolean;
}) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 45000);
    return () => window.clearTimeout(timer);
  }, []);
  return <div className="linkedin-verification">
    <ol className="linkedin-verification-steps" aria-label="Connection progress">
      <li className="is-complete"><span><Check size={13} aria-hidden="true" /></span>Sign-in started</li>
      <li aria-current="step"><span>2</span>{showCode || submitting ? "Verify sign-in" : "Confirm connection"}</li>
      <li><span>3</span>Connected</li>
    </ol>
    <div className={`linkedin-verification-status ${progress.waiting ? "is-waiting" : ""}`} role="status" aria-live="polite" aria-atomic="true">
      <span className="linkedin-verification-icon" aria-hidden="true">{progress.waiting ? <Clock3 size={21} /> : <ShieldCheck size={21} />}</span>
      <div><strong>{progress.title}</strong><p>{progress.detail}</p></div>
    </div>
    {progress.waiting && !paused && <p className="linkedin-verification-checks"><span aria-hidden="true" />{checking ? "Checking status now…" : "Checking automatically every 10 seconds"}</p>}
    {slow && progress.waiting && <p className="connection-notice" role="status">{submitting
      ? "Sending is taking longer. Keep this window open while we finish this request. Don’t submit the code again."
      : browserSession
        ? "LinkedIn is taking longer to finish connecting this session. You don’t need to wait for an email code. You can return to Accounts and check again later; your connection attempt won’t be cancelled."
        : "This is taking longer. If LinkedIn has asked you to verify, complete that request. Otherwise, you can return to Accounts and check again later. Your sign-in won’t be cancelled."}</p>}
  </div>;
}
