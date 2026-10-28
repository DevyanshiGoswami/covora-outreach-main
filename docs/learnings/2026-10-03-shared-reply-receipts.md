# Preserve reply intent separately from synced history

## Symptom
An accepted reply cleared the composer before an outgoing message appeared in synced history. A later status refresh could also clear a newly typed draft with the same text as the previous reply.

## Root cause
A durable reply receipt confirms the submitted operation, while message history arrives through a separate sync. Draft text alone cannot distinguish two different submissions. The old sidebar unread total also used a different read model from the shared inbox's per-user state.

## Approach that worked
- Keep the submitted body and command ID together. Pending and unknown outcomes block a new send; refresh reads the durable result without resending.
- Clear text only on the first accepted transition for that exact command, and only if the user has not edited it. Ownership changes and failed requests preserve drafts.
- Show reply activity with plaintext body, actor, time and status separately from synced history. Acceptance is not delivery. The sample flow follows the same receipt-first behavior.
- Use an atomic takeover-and-reply request. Recheck membership in each server action and let the backend enforce ownership, version and latest-message binding.
- Keep the inbox's current per-user unread count and omit the obsolete global sidebar badge.
- Load the shared inbox first. If unavailable, expose mirrored history with replies disabled; if both sources fail, show an error rather than fabricated empty data.

## Rule for next time
Model draft intent, durable command outcomes and synced messages as separate records. Preserve command identity through uncertainty, and never use a successful submission as proof of delivery or a reason to manufacture message history.

## Evidence
`tests/reply-draft.test.ts` covers unknown outcomes, stale completions and identical text entered after acceptance. `tests/conversations.test.ts` covers scoped DTOs, command/body binding, UTF-8 limits, ambiguous transport responses, receipt escaping and honest fallback behavior. The synthetic browser flow verifies both channels, immediate takeover, draft retention, receipt-only acceptance, mobile widths, dark mode and return focus.
