# Team invitation boundaries

**Date:** 2026-10-03 · **Area:** auth / outreach

## Symptom

An invitation recipient can arrive without an Outbound membership or while signed into the wrong existing account. Standard workspace resolution cannot authorize the invitation preview, and a general login return URL would introduce an unnecessary redirect surface.

Browser verification also exposed two framework interactions: development logs printed invitation Server Action arguments, and the invitation page's `no-referrer` policy caused the native wrong-account sign-out POST to fail its strict Origin check.

## Root cause

Shared identity, workspace entitlement and invitation acceptance are distinct steps. Invitation secrets also need to survive sign-in without becoming server-visible URL parameters or ordinary list fields.

Next.js 16.3.8 logs Server Function names and arguments by default in development. Moving secrets out of URLs does not prevent this logging. A `no-referrer` document policy can also suppress the usable Origin on native form submissions, independently of whether the URL contains a secret.

## Approach that worked

Keep team DTOs behind the verified user-bearer API. Resolve manager authority and the target's current role/version for each mutation; the database independently checks the transaction. The client administrator's available roles exclude administrator/operator grants, and operators cannot manage teams.

Capture a 64-character invitation secret from the URL fragment into per-tab sessionStorage and remove the fragment immediately, including storage-failure paths. Pass it only in POST bodies for authenticated inspection and explicit acceptance. Signed-out pages receive no workspace metadata. Login and local sign-out preserve only the exact `/invite` destination. Accepting clears the token without changing the existing password or creating an account.

Disable argument logging explicitly with `logging: { serverFunctions: false }` in `next.config.ts`. Keep invitation secrets out of logs even for local fixtures. Use `strict-origin-when-cross-origin` on the invitation page while keeping the sign-out endpoint's exact Origin/Host check; fragments are stripped before any recovery navigation.

## Rule for next time

Do not treat a valid session as membership, a valid-looking token as permission, or a preview as acceptance. Keep one-time secrets out of lists, logs and query strings. Remount role forms when the authoritative membership version changes and reject stale writes before forwarding them.

Inspect installed framework logging defaults whenever Server Actions carry secrets. Verify actual development logs with a synthetic invitation after restarting the server. Exercise native recovery forms in a real browser; a stricter referrer policy can break an otherwise correct CSRF boundary.

## Evidence

Focused tests cover role bounds, safe return paths, version inputs, tenant-scoped response projection, secret removal, storage failure, and exact API methods/paths. Real local API and browser verification passed invitation creation, wrong-account recovery, acceptance, role changes, revocation, and company switching.

The installed `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/logging.md` documents default Server Function argument logging and its opt-out. The parent task observed the argument logging and wrong-account sign-out failure in the browser/development terminal, and verified actual invitation POSTs after restart without argument logs or raw secrets. No real secret is recorded here.
