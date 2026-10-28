# Use another LinkedIn account

## Symptom
People could review an unfinished sign-in but could not end it to connect a different LinkedIn email.

## Root cause
Changing fields does not cancel a saved remote attempt. The screen exposed a locked email without an explicit cancellation action, and returning to connection options could persist into a new login.

## Approach that worked
Show the saved sign-in email independently of the profile address. Offer Use another account only from server-derived permissions, then request explicit confirmation. Bind cancellation to the shown connection ID and recheck access on the server. Clear old input after confirmed removal, and take a fresh login directly into verification. An uncertain removal exposes Check cancellation, including after refresh; it never silently sends another removal request. Stop background polling while the person considers cancellation.

## Rule for next time
A disabled identity change needs an actionable path to replace the connection. Keep permission, cancellation, and verification separate; do not mark a failed login connected just because removal was rejected.

## Evidence
Browser coverage exercises a failed attempt, confirmation without credentials, changing email, verification after refresh, uncertain removal with no duplicate mutation, and mobile layout. Backend regressions verify roles, tenant isolation, active leases, stale dialogs, and history after disconnect. Provider transport is simulated in automated tests.
