# LinkedIn verification feedback

## Symptom

People could receive a verification code without seeing an input. Approving in the LinkedIn app left the portal flashing Connecting, Checking and Syncing while it repeatedly refreshed the page.

## Root cause

Code entry depended on an exact remote status observation. Every background read used foreground loading indicators, cleared codes on intermediate statuses and revalidated multiple routes plus an additional router refresh.

## Approach that worked

- Provide an explicit received-code option and an app-approval status check.
- Preserve an opened code form and typed code through intermediate reads; clear it on submission or a terminal result.
- Keep automatic status reads in the background, including a check when the user returns to the tab.
- Queue deliberate actions behind an in-flight read instead of dropping the click.
- Revalidate account rows only when their saved state changes. Remove duplicate route refreshes.
- Stop polling once connected. An app-approval click checks evidence and never marks an account connected on its own.
- Update Next.js to 16.4.2 to satisfy the newly reported dependency audit findings.

## Rule for next time

Keep verification entry available to the person receiving the prompt. Separate background refresh from foreground submission, and refresh the route only when the saved account state changes.

## Evidence

Browser checks cover a delayed status response, typed code preservation, an explicit submission queued behind that response, a rejected code, app approval without another PIN, no premature Connected state, cessation of polling, row updates, mobile layout and back navigation. Synthetic test values are used throughout.
