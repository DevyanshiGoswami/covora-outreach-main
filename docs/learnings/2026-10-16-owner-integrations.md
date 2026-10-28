# Owner-managed integrations

## Symptom

Owners could select deployment-configured workspace connections, but could not configure their own service keys in the portal.

## Root cause

The initial onboarding implementation supported an environment-backed catalog only.

## Approach that worked

Added an Integrations section to the existing agency workspace, with the same navigation, tabs, cards and dialogs. Only an explicit agency owner can load it or submit its server actions. Keys are entered transiently, cleared on submission, forwarded to the fixed backend, and never returned in action state or page props.

The dedicated backend verifies credentials before storing them with authenticated encryption. Connection IDs identify metadata; credential references and encryption identifiers stay out of frontend DTOs. Updates use record versions, and database operations recheck the owner version. Failed replacements preserve the prior saved key. Assigned connections cannot be deleted. Existing workspace assignment and channel isolation continue to apply.

The user explicitly requested recognizable service names in the admin connector UI. A narrowly tested source-boundary exception permits the two display literals in that component only. Client-facing labels, domains, metadata and other components remain under the existing boundary.

## Rule for next time

Provider configuration is a distinct owner capability from client account authorization. A connector needs credential storage, verification, replacement behavior, assignment protection and authorization checks on every boundary, in addition to its form.

## Evidence

- 146 frontend tests; backend 279 unit tests, 6 tooling tests and 118 database tests passed.
- Both builds, lint/type checks and runtime dependency audits passed.
- Isolated browser tests exercised saving both connectors, failed and successful key replacement, secret input clearing, persistence after refresh, connection checks, removal, client assignment, removal protection, and mobile/dark layouts.
- A client administrator receives the unavailable-page screen on the owner Integrations URL; the backend independently rejects client-role access and direct secret RPCs.
- Real service credentials were not used. Browser provider responses were simulated on separate local test ports, with synthetic records cleaned afterwards.

## Follow-up: actionable verification failures

- **Symptom:** a failed connector save displayed one generic message covering both verification and database errors.
- **Root cause:** the frontend discarded the backend failure classification; the original key check also accepted only one of two documented success statuses. The earlier request logs cannot establish which condition caused a particular failed attempt.
- **Approach that worked:** accept both documented statuses for the key-check endpoint, classify authentication, permission, rate-limit and availability failures, and map only known codes to fixed frontend messages. Keep raw service errors and keys out of responses and logs.
- **Rule for next time:** preserve safe failure categories across server boundaries and require a fresh observed request before claiming the cause of a live failure.
- **Evidence:** provider tests cover each status category; database tests preserve failed-key replacement behavior and denied client access; frontend tests reject unknown codes and discard upstream details.

## Follow-up: visible client assignments

- **Symptom:** owners could assign a connection but the People tab showed only channel availability, leaving them unable to identify the saved selection.
- **Root cause:** the integrations response omitted the mapping from the client's saved binding to the catalog entry.
- **Approach that worked:** return owner-only assignment metadata after checking current client access. Match channel, credential reference and remote workspace internally; expose only the option ID, display label and enabled flag. Show both channels above the people list and in the existing dialog, preselect the saved option per channel, and mark it Currently assigned. Disabled or unlisted bindings remain visible.
- **Rule for next time:** assignment controls need a persistent read-back of saved state, distinct from credential availability and account connection health.
- **Evidence:** database tests cover saved and deployment-configured connections, disabled/unlisted bindings, wrong-workspace matching, non-owner metadata exclusion and cross-client denial. Browser checks confirm persistence after refresh, the selected LinkedIn option, an unassigned email channel, and desktop/mobile layout without modifying client assignments.

## Follow-up: configure assignments in their cards

- **Symptom:** assignment cards displayed current state but required opening a separate Workspace connections dialog to make changes.
- **Root cause:** configuration controls remained detached from the assignment summary.
- **Approach that worked:** put a channel-specific selector, Assign/Change action, pending state and error feedback inside each owner-only card; remove the redundant button and modal. Keep the saved assignment visible until the server confirms a change. Reuse the existing authorized server action.
- **Rule for next time:** place configuration beside the state it changes when each card already represents a single manageable resource.
- **Evidence:** existing frontend tests, lint, types, boundary, build and audit passed. Browser checks verified saved preselection, enabling Assign after an unsaved selection, persistence of saved state after refresh, removal of the modal entry point and desktop/mobile layout. Saved client assignments were not changed during browser verification.
