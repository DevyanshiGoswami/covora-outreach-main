# Email provider selection and recovery

## Symptom

A Google-only action leaves Microsoft users without a supported route. Closing or refreshing the portal can also hide a pending sign-in link, and old form errors can remain visible after a later successful check.

## Root cause

The connection UI originally assumed every email used the same consent route. Separate action and polling results competed for the displayed error. Browser popup creation must happen during the user's gesture, before the asynchronous server action.

## Approach that worked

- Keep the existing Accounts → People layout, client/person identity, and role boundaries.
- Let the person explicitly select Google Workspace or Microsoft. Show guidance for personal Gmail and other providers; do not collect unsupported mailbox credentials.
- Open a placeholder during the submit gesture and navigate only to a validated provider URL. If blocked, show a link. After refresh, recover the existing URL through an authorized status check rather than starting another session.
- Use one displayed action result for both manual and automatic checks. Preserve the known connection state when a request fails without a response.
- Only a backend-confirmed mailbox completes setup. Preserve review checks and distinguish setup from sending readiness.

## Rule for next time

A provider choice is only an initiation preference. A pending attempt must resume its existing provider, even if a repeated request asks for another one. Never infer success from a closed popup, and never offer a password fallback for an OAuth error.

## Evidence

The paired backend branch includes the Microsoft consent migration and database tests for tenant/role denial and idempotent resumption. Frontend unit tests cover allowed consent URLs, supported provider choices, personal Gmail restrictions, and fixed failure messages. Local browser verification uses an isolated database and simulated provider transport; it does not establish that live credentials or company consent policies are configured.

## Release scope

This implements P0: manual provider choice, Google/Microsoft OAuth routes, progress, popup recovery, and clearer connection states. P1 domain/MX suggestions and P2 app-password/IMAP/SMTP setup remain future work. No live sending-account password form is introduced.

Release the paired backend migration/API before this frontend. Then use a consenting test mailbox to verify each real provider in the intended client workspace. Production deployment is a separate step.

## Verification on this branch

- 175 frontend unit tests passed; the changed onboarding tests were rerun after final copy changes.
- Lint, TypeScript, source boundary, production build, and runtime dependency audit passed (zero reported vulnerabilities).
- Browser checks passed for Google and Microsoft success, refresh persistence, resuming Microsoft without a second initialization, popup blocking, unsupported personal Gmail/other-provider guidance, wrong-account failure, consumed-status recovery, missing workspace setup, viewer restrictions, owner/self access, and manual connection review. Desktop and 390px mobile layouts were inspected.
- Provider windows and service responses were simulated; no real mailbox was connected during verification.

## Review waiting guidance (October 21)

### Symptom

A rejected initialization appeared as “Needs review” after a mailbox check. Repeated “up to 10 minutes” instructions made it seem each click restarted the wait and claimed there was an open sign-in window.

### Root cause

The backend lost the distinction between rejected and uncertain initiation during review. The frontend discarded the existing attempt deadline and showed generic uncertainty copy alongside the more specific review result.

### Approach that worked

The paired backend migration 0121 makes confirmed rejection recoverable without a consent wait. For genuine uncertainty, display the validated original deadline in the browser's timezone, make the open-window instruction conditional, explain that checking does not extend the deadline, and suppress redundant generic guidance.

### Rule for next time

Recovery guidance should name the verified next action and the existing deadline. An uncertain result must not imply an authorization window was actually opened.

### Evidence

176 tests, lint, types, source boundary, build and runtime audit passed. Browser regression on a fresh isolated database verified rejected-start retry, exactly one new simulated Microsoft sign-in, preserved blocking for unknown outcomes, and the waiting deadline at 390px width. Provider consent was simulated; production was unchanged.

## Clearer account connection dialog (October 21)

### Symptom

Repeated email addresses, a permanent progress strip, four equally prominent provider options, and competing start/check actions made the working connection flow difficult to understand.

### Root cause

Both channels rendered their full forms at once. Status checking also opened a sign-in window when a pending attempt had no URL in browser memory, so the same action could mean two different things.

### Approach that worked

- Show the person once, then compact expandable Email and LinkedIn cards. Keep forms mounted when collapsed so pending status checks continue.
- Make Google Workspace and Microsoft the main choices, with unsupported-provider help behind a disclosure. Personal Gmail displays guidance without an unusable consent action.
- Present one primary action for the current state. Separate reopening a pending sign-in from checking its status: only the explicit reopen action opens a placeholder window.
- Replace ambiguous review badges with “Check needed,” preserve exact review deadlines, and show a concise completion banner once a saved account is connected.
- Use existing portal colors, spacing, modal behavior and permissions. Keep LinkedIn verification and authenticated server actions unchanged.

### Rule for next time

Use the current connection state to choose the next action. A status check should not unexpectedly open authentication. Connection success must still come from the backend, not from closing a popup or collapsing a card.

### Evidence

- 176 unit tests, lint, types, source boundary, production build and runtime audit passed.
- Browser checks on a fresh isolated local database covered Google/Microsoft success, refresh and explicit resumption without duplicate initiation, status checks without popups, popup blocking, unsupported mailboxes, wrong identity, permission failure, uncertainty/deadlines, missing configuration, viewer restrictions and owner self access.
- The initial combined browser run timed out before LinkedIn verification. A separate follow-up verified LinkedIn initiation, PIN submission and confirmed completion; no product permission or rate-limit checks were weakened.
- Desktop, 390px mobile, dark mode, Escape and focus return were checked. The real local mailbox's existing connected state was also inspected without starting a new connection. All new provider-flow tests used simulated transport; production was unchanged.
