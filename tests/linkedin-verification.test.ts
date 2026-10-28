import test from "node:test";
import assert from "node:assert/strict";
import { linkedinCodeSubmission, linkedinProgress, needsLinkedinCode, type VerificationReceipt } from "../src/lib/linkedin-verification";

test("a submitted code is delivery acknowledgement, never proof of a connected account", () => {
  assert.equal(linkedinCodeSubmission({ state: "pending", nextStep: "connecting" }), "submitted");
  for (const result of [{ state: "pending" }, { state: "pending", nextStep: "verification_code" }, { state: "failed" }, { state: "connected" }, { state: "pending", nextStep: "connecting", failureCode: "linkedin_status_unavailable" }])
    assert.equal(linkedinCodeSubmission(result), "unconfirmed");
  assert.equal(linkedinCodeSubmission({ failureCode: "linkedin_code_rejected" }), "rejected");
  assert.equal(linkedinCodeSubmission({ failureCode: "linkedin_check_in_progress" }), "not_submitted");
  assert.equal(linkedinCodeSubmission({ failureCode: "linkedin_code_not_requested" }), "not_requested");
});
test("cached code requests do not reopen a submitted or unconfirmed code; new code entry stays available", () => {
  for (const kind of ["submitted", "unconfirmed", "not_requested", "app_approved"] as const) {
    const receipt: VerificationReceipt = { kind, at: 1 };
    assert.equal(needsLinkedinCode(false, "verification_code", receipt), false);
    assert.equal(needsLinkedinCode(true, "syncing", receipt), true);
  }
  for (const kind of ["rejected", "not_submitted"] as const) assert.equal(needsLinkedinCode(false, "verification_code", { kind, at: 1 }), true);
  assert.equal(needsLinkedinCode(false, "verification_code"), true);
  assert.equal(needsLinkedinCode(false, "connecting"), false);
});
test("progress separates submission, waiting, actionable code entry and paused checks", () => {
  const input = { submitting: false, showCode: false, paused: false, receipt: { kind: "submitted" as const, at: 1 } };
  assert.equal(linkedinProgress({ ...input, submitting: true, showCode: true }).title, "Submitting your code");
  assert.equal(linkedinProgress({ ...input, step: "verification_code" }).title, "Code submitted. Waiting for LinkedIn");
  assert.equal(linkedinProgress({ ...input, step: "syncing" }).title, "Finishing your connection");
  const paused = linkedinProgress({ ...input, paused: true, step: "syncing" });
  assert.equal(paused.waiting, false); assert.match(paused.detail, /Automatic checks are paused/);
  assert.equal(linkedinProgress({ ...input, showCode: true }).badge, "Your action needed");
  assert.equal(linkedinProgress({ ...input, receipt: { kind: "app_approved", at: 1 } }).title, "Checking your app approval");
});
test("a browser session waits for connection confirmation without expecting a code", () => {
  const input = { submitting: false, showCode: false, paused: false, method: "cookies" as const };
  for (const step of ["connecting", "check_status", undefined] as const) {
    const progress = linkedinProgress({ ...input, step });
    assert.equal(progress.title, "Connecting your browser session");
    assert.match(progress.detail, /email code isn’t normally needed/);
  }
  assert.equal(linkedinProgress({ ...input, step: "syncing" }).title, "Finishing your connection");
  assert.equal(linkedinProgress({ ...input, showCode: true, step: "verification_code" }).badge, "Your action needed");
  assert.equal(linkedinProgress({ ...input, method: "password" }).title, "Waiting for LinkedIn");
  assert.equal(linkedinProgress({ ...input, method: undefined }).title, "Checking your LinkedIn connection");
});
