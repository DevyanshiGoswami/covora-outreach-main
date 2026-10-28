# Returning to email provider selection

## Symptom

Choosing the wrong email provider and starting sign-in hid both provider choices. A pending or unconfirmed attempt offered only resume/check actions, leaving users without a clear way back.

## Root cause

Provider selection was rendered only in the initial, failed, or expired state. The dialog treated navigation back to the chooser as equivalent to starting a new remote sign-in. Closing a browser window cannot establish that remote consent was cancelled.

## Approach that worked

- Replace email radio inputs with labelled Google Workspace and Microsoft logo buttons, with keyboard focus and a selected indicator. Keep an explicit Continue action so choosing a logo alone never starts consent.
- Offer **Choose another provider** during pending and unconfirmed attempts. This returns to the chooser, attempts to close the popup opened by this dialog, and preserves the saved connection attempt.
- Let users pick the replacement provider while the old attempt is being checked. Enable Continue only when the prior attempt has definitively failed or expired. Keep polling/review on the existing authorized API flow; never manufacture a cancelled or connected state in the browser.
- Include the validated existing attempt deadline in pending email action responses. Show the deadline when changing providers or reviewing an unresolved connection.
- On failure or expiry, expose both logos again. On verified completion, show the existing connected status and remove the provider controls.

## Rule for next time

Navigation state and connection state are separate. A user must be able to leave a sign-in step without losing its saved outcome or starting a second consent session. Treat popup closure as a browser event, not proof of provider cancellation. Preserve the explicit actor, tenant and unknown-outcome restrictions.

## Evidence

Browser verification uses an isolated local auth/database project and simulated provider transport. The regression covers selection changes before consent, Google-to-Microsoft recovery, closing/reloading during consent, failed and unknown outcomes, no duplicate initiation while pending, verified completion after refresh, keyboard controls, popup blocking, mobile layout and viewer/personal-mailbox restrictions. No real mailbox connection or cloud database change is required for these checks.

The provider-choice regression and screenshots are in `/private/tmp/covora-provider-choice-test`; the browser runner is `/private/tmp/covora-email-flow-browser/provider-choice-regression.mjs`. The popup/keyboard/mobile/viewer cases passed in `provider-choice-followup.mjs` after the synthetic workspace hit its existing start-rate limit during the combined run. Frontend lint, types, boundary checks, all 180 unit tests, the runtime dependency audit (zero vulnerabilities) and the production build passed. The running local portal was also checked without initiating provider consent.

## Limit

The current connection service does not expose cancellation in this integration. A new provider selection may need to wait for the earlier consent session to end; the UI communicates that wait instead of silently replaying an unresolved request.
