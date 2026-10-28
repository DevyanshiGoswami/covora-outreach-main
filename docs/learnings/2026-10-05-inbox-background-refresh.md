# Inbox background refresh

## Symptom

An open Inbox kept its initial conversation list after synchronization added messages.

## Root cause

The client component owns its list and selected history in React state. Refreshing the route preserves that state; the existing selection loader also marks messages read and moves focus, while channel loading resets selection and filters.

## Approach that worked

Use the existing authorized read actions every 60 seconds and on focus/visibility restoration. Refresh only visible, idle views without an open draft or unresolved attempt. Recheck this condition after requests finish; discard results if selection, channel or an explicit action changed. Keep drafts, filters, loaded rows and focus. Restart pagination at the refreshed first page to avoid a gap when new conversations arrive. Never call the read-status mutation from background refresh.

## Rule for next time

Treat background reads separately from user navigation. Preserve uncertain reply attempts and composition, and verify both request-start and response-application races. A failed read must not replace real data with an empty inbox.

List and selected-detail reads are independent snapshots. Always apply a successful list even if the selected conversation becomes unavailable. Reject detail older than the known or newly listed version; retain the existing history and require a current detail read before replying. A matching successful detail read clears that block.

## Evidence

The original 78-test suite, lint, types, boundary checks, dependency audits and production build passed. Three additional regressions cover independent snapshot versions, detail recovery and list progress when selected detail is withdrawn or throws. Existing conversation/draft tests retain tenant, command and unknown-outcome checks. Isolated synthetic browser verification confirms a real interval update, focus refresh, draft-race rejection, unchanged read-status writes, no sending, desktop/mobile layout and zero console errors.
