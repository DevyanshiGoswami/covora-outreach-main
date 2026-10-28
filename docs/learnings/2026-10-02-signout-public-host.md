# Compare logout requests to the public request host

**Date:** 2026-10-02 · **Area:** auth

## Symptom
Password login worked, but the browser's Sign out form returned 403 locally.

## Root cause
The route compared the browser Origin to the framework's internally normalized request URL. The internal hostname differed from the public 127.0.0.1 host.

## Approach that worked
- Compare the parsed browser Origin host with the request Host header.
- Reject missing or malformed origins and cross-site requests.
- Use a relative Location header after local-scope sign-out so redirects retain the public host.
- Re-run the actual browser form flow, not only direct database authentication tests.

## Rule for next time
Verify browser form origin checks and redirects against the public request host.

## Evidence
`src/app/auth/signout/route.ts`; the original browser POST returned 403 despite valid same-origin navigation, prompting the host comparison change.
