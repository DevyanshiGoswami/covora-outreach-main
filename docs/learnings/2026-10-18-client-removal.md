# Client removal in the existing agency portal

## Symptom
Agency owners could add clients, but had no removal action on their client cards.

## Root cause
Removing a client also affects existing sessions, invitations and queued activity, so a local list filter would be misleading.

## Approach that worked
Add an owner-only Remove client button inside each existing agency client card, including previews. Reuse the existing accessible settings dialog and danger-button styles. Require the exact company name, display the consequences, and call the fixed backend endpoint with the verified user's session. The server action separately checks agency-owner access; the database verifies both access and the current name again. Successful removal revalidates the root layout so lists and selectors refresh.

The confirmation explains that access is revoked, history is retained, and campaigns in connected services must be stopped separately. A pending send produces a fixed retry message. Errors never echo arbitrary service diagnostics. After success, focus returns to Add client because the removed card no longer exists.

## Rule for next time
Preserve the established portal and shared dialog components. A hidden button is not authorization. Treat removal as retained history with revoked access; do not describe it as permanent deletion or remote campaign shutdown.

## Evidence
159 frontend tests, lint, types, source boundary, runtime audit and production build passed. Browser checks use an isolated local database: exact-name validation, cancel, mobile fit at 390px, successful removal, persistence after refresh, denied access from an existing client session and continued access to another client. No production customer is removed for testing.
