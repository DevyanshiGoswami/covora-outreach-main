import type { ConnectionNextStep } from "./onboarding";

export type CodeSubmission = "submitted" | "rejected" | "not_requested" | "not_submitted" | "unconfirmed";
/** A successful submission only acknowledges delivery; it does not prove sign-in. */
export function linkedinCodeSubmission(result: { state?: unknown; nextStep?: unknown; failureCode?: unknown }): CodeSubmission {
  if (result.failureCode === "linkedin_code_rejected") return "rejected";
  if (result.failureCode === "linkedin_code_not_requested") return "not_requested";
  if (result.failureCode === "linkedin_check_in_progress") return "not_submitted";
  return !result.failureCode && result.state === "pending" && result.nextStep === "connecting" ? "submitted" : "unconfirmed";
}

export type VerificationReceipt = { kind: CodeSubmission | "app_approved"; at: number };
export function needsLinkedinCode(entering: boolean, step: ConnectionNextStep | undefined, receipt?: VerificationReceipt): boolean {
  // Status reads can repeat the earlier code request after a submission. Keep
  // the receipt until a new deliberate action; never automatically resend a PIN.
  return entering || (step === "verification_code" && (!receipt || ["rejected", "not_submitted"].includes(receipt.kind)));
}

export function linkedinProgress({ submitting, showCode, step, receipt, paused, method }: {
  submitting: boolean; showCode: boolean; step?: ConnectionNextStep; receipt?: VerificationReceipt; paused: boolean; method?: "cookies" | "password";
}) {
  if (submitting) return { title: "Submitting your code", detail: "Please wait while we send it securely. You don’t need to click again.", badge: "Submitting code…", waiting: true };
  if (showCode) return { title: "Enter your LinkedIn code", detail: "Use the latest code sent to the email or phone on your LinkedIn account. You can also approve the sign-in in the LinkedIn app.", badge: "Your action needed", waiting: false };
  if (paused) return { title: "Check your connection status", detail: "Automatic checks are paused. Use Check connection status below to get the latest result before trying again.", badge: "Check needed", waiting: false };
  if (step === "syncing") return { title: "Finishing your connection", detail: "LinkedIn is still completing setup. No action is needed here; we’ll show confirmation when the account is connected.", badge: "Finishing setup", waiting: true };
  if (receipt?.kind === "submitted") return { title: "Code submitted. Waiting for LinkedIn", detail: "Your code has been sent. You don’t need to enter it again while we check for confirmation.", badge: "Waiting for LinkedIn", waiting: true };
  if (receipt?.kind === "unconfirmed") return { title: "Checking whether your code went through", detail: "Submission hasn’t been confirmed. We’ll check the connection before you try another code.", badge: "Awaiting confirmation", waiting: true };
  if (receipt?.kind === "app_approved") return { title: "Checking your app approval", detail: "We’re waiting for LinkedIn to confirm the sign-in you approved. No verification code is needed here unless LinkedIn asks for one.", badge: "Waiting for LinkedIn", waiting: true };
  if (method === "cookies") return { title: "Connecting your browser session", detail: "You’re using an existing LinkedIn sign-in, so a new email code isn’t normally needed. We’ll confirm the connection automatically.", badge: "Connecting", waiting: true };
  if (method === "password") return { title: "Waiting for LinkedIn", detail: "If LinkedIn sent a code or an approval request, complete it using the options below. Otherwise, we’ll keep checking your sign-in.", badge: "Awaiting confirmation", waiting: true };
  return { title: "Checking your LinkedIn connection", detail: "We’ll show confirmation when the account is connected. Only complete verification if LinkedIn asks you to.", badge: "Awaiting confirmation", waiting: true };
}
