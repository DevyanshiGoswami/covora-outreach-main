import assert from "node:assert/strict";
import test from "node:test";
import { invitationFailureReason, logInvitationStep, reasonCode } from "../src/lib/invitation-log";
import { TeamServiceError, teamApiRequest } from "../src/lib/team-transport";

const token = "a".repeat(64);
test("invitation failures are logged as short reasons, never message text or tokens", async t => {
  const down = await teamApiRequest("http://api.invalid", "jwt", { kind: "inspect", body: { token } }, async () => { throw new TypeError("fetch failed"); }).catch(error => error);
  assert.equal(invitationFailureReason(down), "api_unreachable");
  const refused = await teamApiRequest("http://api.invalid", "jwt", { kind: "inspect", body: { token } }, async () => Response.json({}, { status: 403 })).catch(error => error);
  assert.equal(invitationFailureReason(refused), "api_403");
  const expired = await teamApiRequest("http://api.invalid", "jwt", { kind: "accept", body: { token } }, async () => Response.json({}, { status: 401 })).catch(error => error);
  assert.equal(invitationFailureReason(expired), "session_expired");
  assert.equal(invitationFailureReason(new TeamServiceError("Shown to the person")), "team_error");
  assert.equal(invitationFailureReason(Object.assign(new Error("Onboarding request unavailable"), { status: 500 })), "api_500");
  assert.equal(invitationFailureReason(new Error("Session required")), "session_expired");
  assert.equal(invitationFailureReason("odd"), "unexpected");
  assert.equal(reasonCode("otp_expired"), "otp_expired");
  assert.equal(reasonCode("Token has expired or is invalid"), "unknown");
  const lines: string[] = [];
  t.mock.method(console, "warn", (...args: unknown[]) => { lines.push(args.join(" ")); });
  logInvitationStep("activate", "failed", "Includes a sentence " + token);
  assert.deepEqual(lines, ['[invitation] {"step":"activate","outcome":"failed","reason":"unknown"}']);
});
