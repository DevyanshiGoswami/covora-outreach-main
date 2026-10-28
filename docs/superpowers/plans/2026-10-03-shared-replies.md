# Shared replies implementation plan

Historical milestone: ownership references to the shared portal have been superseded by the dedicated outbound backend and database described in `docs/ARCHITECTURE.md`. This note does not authorize changes to the content portal or claim the independent cutover is complete.

> **For agentic workers:** Implement the approved design with the existing parallel workers; each owns a separate layer and meaningful tests. Root integrates and reviews the complete flow.

**Goal:** Let authorized clients and staff reply to email and LinkedIn conversations inside Covora, with immediate client takeover.

**Architecture:** The frontend remains a neutral, session-authenticated client. The portal backend owns conversation mirrors, tenant authorization, explicit sender bindings, durable commands, sending adapters and audit history. New conversations belong to the Covora queue; clients can immediately take over without approval, while stale or concurrent sends are rejected.

**Tech Stack:** Next.js 16, React 19, Supabase/Postgres RLS, existing server-only integration modules.

**Spec:** Rami's approved discussion and explicit instruction on 2026-10-03 that clients can step in at any time. The detailed neutral HTTP contract is held in the task workspace at `work/outbound-replies/contract.md`.

## Global constraints

- No real messages, production changes or deployment during implementation.
- Client admins and members may reply; viewers stay read-only. Staff must hold current assigned workspace access.
- All remote identifiers, credentials, and execution calls stay in the portal backend.
- Existing-conversation replies only, plain-text rendering, no arbitrary sender/recipient inputs.
- Sending requires an explicit disabled-by-default workspace and sender configuration.
- Unknown outcomes are retained for review, never automatically resent. An already dispatched message cannot be recalled. An operator reconciliation interface is a later milestone.

## Review focus

- Cross-company identifiers, role revocation and disabled features are denied before dispatch.
- Immediate takeover is allowed even while a prior send's outcome is pending; a second dispatch waits.
- A stale tab, newer incoming message or changed configuration cannot authorize an old draft.
- Network timeout or process interruption after dispatch cannot trigger duplicate delivery.
- Missing integrations stay honestly unavailable; synthetic demo behavior never substitutes for real data.

## Task 1: Durable ownership and send commands

Owner: database worker. Files: new portal migration0094, DB reply tests, generated portal types.

- [x] Write denial, idempotency, takeover, latest-message and dispatch-race tests; run before implementation.
- [x] Add private binding/conversation/message/command tables with RLS and explicit grants. Bridge existing email mirrors without granting send access.
- [x] Add neutral read/ownership/enqueue APIs and private claim/dispatch/finalize RPCs. Recheck current authority after preparation.
- [x] Reset only the isolated local database, regenerate types, and pass focused DB tests.

## Task 2: Authenticated API and provider adapters

Owner: API worker + root adapters. Files: portal outbound conversation handlers/routes, private delivery modules, local binding configuration, bounded synchronization worker, unit tests.

- [x] Test strict DTO projection, unauthorized reads/writes, malformed input and command replay.
- [x] Implement fixed bearer-authenticated API with private context consumed only after authorization.
- [x] Test scope, sender, recipient, latest history, uncertain response, no-retry and timeout behavior before implementing adapters.
- [x] Add bounded read-only channel sync for explicitly configured scopes; refuse ambiguous/mismatched identities.
- [x] Pass unit tests and the portal build with no live dispatch.

## Task 3: Premium shared inbox

Owner: frontend worker. Files: neutral conversation model/transport/actions, inbox UI and demo data, focused tests.

- [x] Test DTO/permission/input/unknown-command behavior.
- [x] Add channel tabs, sender identity, ownership, immediate takeover, reply composer and durable send statuses.
- [x] Preserve drafts through errors and ownership changes. Retain read-only mirrored history if the new API is unavailable.
- [x] Provide clearly labeled local demo interactions for both channels, with no remote effects.
- [x] Verify desktop/mobile/dark, keyboard use, cross-tenant denial and read-only viewer behavior.

## Task 4: Integration and final review

Owner: root and independent reviewer.

- [x] Exercise authenticated fixture flows against local backend with mocked sending transport only.
- [x] Run both repositories' required checks and audit dependencies; report existing failures explicitly.
- [x] Inspect production render and source boundary. Restore normal preview, record lessons and commit only scoped files.

## Completed verification

2026-10-03: all implementation tasks completed locally. Frontend: 53 tests, lint, types, source boundary and production build passed. Backend: 758 unit and 385 database tests passed after the final isolated reset/type generation; lint, types and production Webpack build passed. Authenticated browser and simulated delivery integration covered both channels, immediate takeover, viewer/company denial and duplicate/unknown outcomes. Development previews are restored. No real replies or deployments occurred.

Runtime dependency audits are clean. Both full audits retain five existing high development-toolchain findings. The isolated backend requires Webpack locally because its pre-existing dependency symlink is outside the default bundler root. Unknown outcomes require operator review; a reconciliation interface and real-account pilot are separate rollout work.
