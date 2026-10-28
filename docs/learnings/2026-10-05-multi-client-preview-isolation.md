# Separate preview fixtures by workspace

## Symptom
A second authenticated client needs the same sample metrics and interactions with different inbox identities and conversation context.

## Root cause
A shared presentation can accidentally reuse another client's content or fixture identifiers if it selects by a display name or shares mutable results.

## Approach that worked
Keep explicit client configuration in a server-only module, select it only after the active preview membership check, and give each configured client a distinct fixture-ID namespace. Generate fresh result objects per request. Keep the already approved UI, real lead reads, and local-only reply flow unchanged.

## Rule for next time
A company name, domain, or URL flag must never select a preview. Unknown, inactive, live-mode, or unauthorized workspaces fail closed. Sample prospects use example.com; configured sender identities remain server-side until authorized rendering.

## Evidence
Production-mode factory tests cover all four EPM inboxes, recruiting context, exact-client authorization, disjoint campaign/lead/conversation/message IDs, and fresh objects between calls. An independent before/after comparison confirmed the existing Ice Shaker preview output is unchanged.
