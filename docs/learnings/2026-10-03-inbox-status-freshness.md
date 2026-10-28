# Show verified inbox observations separately from setup progress

## Symptom
A completed setup request or an old connected observation could look like a current, healthy inbox. A failed account fetch could also hide independently available setup requests.

## Root cause
Setup progress, connection observations and verification attempts describe different events. A single status cannot represent all three accurately, and the user's device clock is not a reliable freshness reference.

## Approach that worked
- Render outreach inboxes and setup requests as separate sections with independent loaders and error states.
- Keep the last successful observation visible, but prioritize “Check unavailable” after an unsuccessful attempt and “Check overdue” after 24 hours.
- Base freshness on the server response time plus monotonic elapsed browser time. Keep demonstration time fixed so sample status does not silently change with the real date.
- Expose registration and checking only to active assigned staff. Recheck membership, selected company, account presence and configuration in server actions; the API independently authorizes writes.
- Preserve neutral, explicit DTO projections and separate transport deadlines for ordinary operations and the longer connection check.

## Rule for next time
Keep workflow progress, observed health and observation freshness distinct, and never let a failed check refresh a positive badge.

## Evidence
`tests/accounts.test.ts` covers strict response projection, foreign company rejection, role permissions, independent loader failures, freshness precedence and request timeouts. Account screens were verified at desktop, tablet and narrow mobile widths, with keyboard navigation and dark mode.
