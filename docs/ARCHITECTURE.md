# Independent outbound architecture

Covora Outreach at `covora.app` is the frontend for a dedicated outbound platform. `covora-outreach-api` owns its database migrations, Auth identities, tenant memberships, account verification, synchronization, sending adapters and notification jobs. The frontend uses only the dedicated project's public key and a verified current-user session. It never holds privileged database or sending-engine credentials.

The content portal at `app.covora.app` is independent. Do not change its hosting, DNS, environment, schema, accounts, records, jobs or credentials for this cutover. There is no content-portal fallback, shared-login bridge, automatic data copy or cross-product role inheritance. Any later import requires a separately reviewed scope; an empty dedicated workspace is an honest initial state.

## Preserved contracts

- Read access remains the neutral `client_outreach_*` views. `client_outreach_workspaces` is the sole membership projection; database authorization is authoritative. `mark_outreach_messages_read` is the only exported database function.
- Server actions use the fixed `OUTBOUND_API_ORIGIN` and the current verified user's bearer token for `/api/outbound/setup`, `/accounts`, `/team`, `/invitations` and `/conversations` and their existing subroutes. Redirects and caches are disabled. The dedicated backend independently verifies that token against its own project and rechecks tenant, role and feature authorization.
- Accounts, team, setup commands and conversation actions keep their existing neutral API DTOs. Schema types are exported from the dedicated backend with `scripts/export-schema.mjs`; private tables, credentials and raw sending-engine identifiers stay outside this repository.
- Sending and synchronization remain disabled until explicitly configured and activated in the backend. An inbox connection badge is an observation, not sending readiness. Reply conflicts and unknown delivery outcomes retain the existing failure-closed behavior.
- The LinkedIn log views keep their shape for compatibility but do not reach into the content portal. Missing measurements remain unavailable; no sample data appears in real workspaces.

## Configuration and session cutover

Deploy these values as one release: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and server-only `OUTBOUND_API_ORIGIN`. Use the dedicated project's canonical HTTPS URL and its public key. Never retain an old backend origin while switching Auth, or retain old Auth while switching the backend. Rebuild after changing public environment values.

Run the offline check in the target deployment environment, using an independently verified project reference and API origin. It reads existing environment values and prints only validation results; it does not load env files, contact services, or print keys:

```sh
npm run check:deployment -- --project-ref <dedicated-project-ref> --api-origin https://api.outreach.example.com
```

The check requires the canonical project URL, a matching public anon JWT and the exact HTTPS API origin, and rejects the content-portal hostname. JWT claims are inspected for configuration mistakes; this offline check does not verify the key's signature or prove service readiness. For a newer publishable key, pass `--public-key-sha256 <trusted-digest>` obtained independently from that project's public key, since its text does not expose a project reference. Never calculate the expected digest from the unverified deployment value itself. Privileged keys fail the check.

Keep the SDK's default auth cookie namespace, which incorporates the canonical project reference. SSR cookies have no Domain override. A new project reads only its own cookies; old cookies are ignored, and local sign-out does not clear another project's cookies. Synthetic tests exercise ordinary and chunked old cookies, authenticated new-project requests, and local sign-out. Do not configure two distinct production projects behind URLs that share the SDK's first-hostname namespace.

Invitation secrets remain in fragments and per-tab storage, now partitioned by auth origin. The obsolete unscoped cache is discarded without reusing its token. Previously issued links are not automatically transferred to the new database; create new invitations only through the authorized dedicated backend. Existing browser tabs may need a refresh after promotion; never use a stale tab as proof of new-project access.

Before promotion, verify schema/RLS and default-off backend gates, run the frontend checks, then test the staged build against the dedicated project: old-session redirect, fresh sign-in, correct workspace, foreign-workspace rejection, team/account reads and local sign-out. Provision new identities through the separately authorized administrator process; this frontend does not create users or send auth emails. Record the exact release and configuration checked. Until that verification and promotion are complete, this branch is a cutover candidate, not proof of a production migration.
