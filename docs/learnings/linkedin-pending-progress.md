# Make pending connections navigable

## Symptom

People were stuck on a pending LinkedIn screen with no clear way to check progress or go back. Every pending attempt displayed a code field, even when no verification code was requested.

## Root cause

The UI inferred the next step from the generic pending state. Status checking also shared the code form's validation, and its cleanup cleared code input during a read.

## Approach that worked

- Add a persistent footer with Back to accounts and Check connection status. Returning to Accounts preserves the attempt; it does not silently cancel or restart it.
- Add Back to connection options while pending. Users can select a method but cannot start another attempt until the current one ends.
- Accept only the neutral, allowlisted progress states from the backend. Show a code field only for an explicit verification_code observation. Automatically check a reopened pending attempt and retain the last confirmed step when a throttled read has no new observation.
- Use formNoValidate for status checks so an empty or invalid code cannot trap the user. Keep code input controlled and preserve it during reads; clear it after submission or when verification is no longer required.
- Restore sign-in fields after a confirmed failure, with fixed actionable copy. Preserve self-authentication and external-sender permissions.

## Rule for next time

Every waiting screen needs a visible status action and an exit. Progress, code requests and confirmed completion must come from backend evidence. Checking progress must not validate or erase an unfinished input.

## Evidence

- 184 frontend tests passed, alongside lint, types, source boundary, runtime dependency audit and production build.
- Simulated browser tests covered reopening without duplicate sign-in, returning to options, a code entered during status checking, invalid code text with Check, explicit PIN submission, syncing, failure/retry, browser-session reconnect and persistence after refresh.
- Client-administrator and viewer restrictions passed. Desktop and 390px mobile screenshots were inspected; footer controls remain reachable and no browser runtime errors occurred.
- Requires the matching backend progress contract and migration 0126. Local verification only; no production deployment or real account login was performed by the tests.
