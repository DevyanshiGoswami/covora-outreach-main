# A useful first workspace without invented progress

## Symptom

A newly authorized company with no assigned campaigns opened to empty metrics and an empty chart. The page offered little guidance about the first step.

## Root cause

Overview used the same results layout for both empty workspaces and companies with campaign history. A successful empty response was not distinguished from useful recorded activity.

## Approach that worked

Show a server-rendered welcome only for an authorized company whose complete response contains no campaigns, activity, messages, leads, steps, LinkedIn records or unread messages. Keep partial results in the existing flow. Data-loading errors still reach the existing error boundary.

Use three preparation steps with no completion indicators or claims of connection or sending readiness. Accounts remains the primary destination and carries the verified company ID. Show the Team destination only for existing team-manager roles. Other views, including LinkedIn activity, keep their existing behavior.

## Rule for next time

An empty results response supports preparation guidance, not a claim about operational readiness. Preserve every recorded or partial result, use the authorized company in navigation, and check the no-access path as well as the attractive empty state.

## Evidence

- All 59 frontend tests, lint, TypeScript, source boundary, diff checks and production build pass.
- Render/selector regressions cover denied access, partial results, unread messages, zero-activity campaigns, historical records, LinkedIn records and every supported role’s navigation permissions.
- A production browser run used only an in-memory synthetic Auth/REST server on a separate port. It verified new, active and historical workspaces; a viewer’s Team restriction; the company-preserving Accounts link; existing LinkedIn results; foreign/no-membership denial; and an injected data-loading failure that remained an error.
- Light and dark layouts passed overflow checks at 320, 390, 820 and 1440 pixels. Screenshots were visually reviewed. No console warnings or page errors occurred before the deliberately injected failure.
- Runtime dependency audit is clean. The existing five high findings in the development lint toolchain remain visible and unchanged.
- No real database, sending service, credentials, environment files or deployment configuration were changed.
