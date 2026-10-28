# Open Google sign-in from the first connection click

## Symptom
People expected the connection button to open Google immediately. The form instead started an asynchronous session and displayed a second link; startup failures were generic.

## Root cause
No window was opened during the browser click gesture, and the client did not map actionable connection failures.

## Approach that worked
Open a detached waiting window synchronously when submitting email start, then navigate it only to a validated Google OAuth URL after the authorized server action succeeds. Close it on failure, preserve a manual link when a popup is blocked, and never open windows from background polling. Map fixed failure codes and HTTP statuses to neutral, actionable guidance. Keep permission checks, session ownership and account identity validation intact.

## Rule for next time
Browser popup timing and remote authorization are separate concerns. Open windows during user gestures; do not imply that a polished UI makes an underprivileged service key capable of connecting accounts.

## Evidence
- 164 tests, lint, types, source boundary, runtime audit and production build.
- Browser checks with local auth and simulated connection responses: one-click detached window, Google URL navigation, missing-scope feedback and window closure, blocked-popup fallback, and non-Google URL rejection. No real OAuth calls or connection writes in browser verification.
- Live end-to-end connection remains blocked by external key permissions and the client's legacy assignment. The owner must update the key; this release does not claim any mailbox was connected.
