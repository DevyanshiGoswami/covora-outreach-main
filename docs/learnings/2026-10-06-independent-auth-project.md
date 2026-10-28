# Move auth projects without carrying browser state across

## Symptom

Moving the outbound app to its own backend required checking whether an existing browser session or invitation could silently continue under the previous product's identity service.

## Root cause

The installed auth SDK already namespaces default session cookies by project, but invitation sessionStorage used a single application-wide key. Documentation and invitation/team copy also assumed a shared sign-in account. Environment values could be individually valid while pointing at different releases.

## Approach that worked

Retain the SDK's project-scoped, host-only cookie defaults and verify their behavior with synthetic SSR sessions. Partition invitation storage by configured auth origin, discard the obsolete unscoped token, and make the independent account wording explicit. Validate the expected project URL, matching public key and exact HTTPS backend before deployment; leave actual token verification and tenant authorization to the dedicated services.

## Rule for next time

Treat a change of identity project as a coordinated configuration cutover. Check all browser state that survives navigation, not just auth cookies. Keep another product's cookies and infrastructure untouched, and never infer that its account or membership grants access in the new project.

## Evidence

`tests/auth-project-isolation.test.ts` covers old plain/chunked cookies, new-project authentication and scoped sign-out using the installed SDK. `tests/team.test.ts` covers legacy/project-scoped invitation caches and secret removal. `tests/deployment-config.test.mjs` covers mismatched targets, privileged keys, public-key pairing and redacted failure output. No live identity, production setting or external message is needed by these tests.
