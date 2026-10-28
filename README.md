# Covora Outreach

Client outreach results in the visual style of Covora's LinkedIn growth dashboard: navy summary panel, cobalt accents, clear metric cards, campaign tables and a plain-text inbox. Built with Next.js 16.3.8 and Supabase SSR. The frontend uses a dedicated outbound backend and database/auth project; the content portal at `app.covora.app` remains a separate product. See [architecture and cutover](docs/ARCHITECTURE.md).

## Local setup

1. Install Node 22+ and run `npm ci`.
2. Copy `.env.example` to `.env.local`; provide only the dedicated outbound database URL, its public anon key and optional app name. Set the server-only `OUTBOUND_API_ORIGIN` to the dedicated backend origin (for example, `https://api.outreach.example.com`). HTTPS is required outside development; local development permits loopback HTTP. Do not include a path, credentials or query string.
3. The `covora-outreach-api` repository owns migrations and isolated local database setup. Never run migrations from this frontend or point a development checkout at the content portal database.
4. Run `npm run dev` and visit http://127.0.0.1:3001/demo for fictional preview data, or `/login` for a local test account.

The demo exists only in development. Production requests to `/demo` and `/demo/settings` return 404. Missing configuration takes the user to a setup message; it never substitutes sample data for client records.

## Access and data

Email/password sign-in uses accounts provisioned in the dedicated outbound auth project. Content-portal accounts and passwords are not automatically copied or accepted. Agency owners can provision client administrator invitations through the dedicated backend. New invitees activate their account and set a password on the existing invitation screen; this app sends no auth emails. A verified session and the guarded `client_outreach_workspaces` projection select the workspace. It includes only active Outbound memberships with the `outreach_app` feature enabled, or explicitly granted agency-owner access. Legacy profile roles grant no access. People with multiple authorized memberships get a company chooser; a guessed company ID never selects another workspace.

Campaign results are read from `client_outreach_*` views using the signed-in user's JWT. The membership projection is the only auth-context read; legacy profile, client and feature tables are not exported to this app. No privileged database key or sending-engine credential belongs in this app. Read marking uses the authenticated, tenant-checked `mark_outreach_messages_read` RPC. Conversation ownership and replies use the dedicated backend API after current tenant/role checks; the frontend has no privileged database writes or direct sending-engine access.

`/settings` adds assisted account setup. Client administrators, assigned operators and explicit agency owners can request help; members and viewers can follow status only. `/agency/setup` lists only authorized operator/owner workspaces and lets those roles update request status and client-visible notes. Google Workspace and Microsoft selections are assisted requests, not OAuth. Closing a request never certifies connection or sending readiness.

The Email tab also lists registered outreach inboxes separately from setup requests. Client roles can read the address, display name, observed state and check times. Explicit agency owners and assigned operators use `/agency/setup` to register an **existing** inbox and check its connection. Both actions require the selected workspace to be configured. Registering an identity does not create or connect a mailbox.

Account reads and writes use `/api/outbound/accounts`; checks use `/api/outbound/accounts/verify`. The app forwards only the verified current user bearer token to the fixed server-only origin. The neutral API projection includes no private identifiers or credentials and requires no generated schema changes. Account and setup requests load independently; a failed inbox read displays an unavailable state while the setup flow stays available.

`last_checked_at` records the last successful observation, `last_connected_at` the last positive active connection, and `last_attempt_at` the last verification attempt. A failed attempt (`check_error`) displays **Check unavailable** even when the earlier state was connected. Paused, maintenance and setting-up observations remain distinct; they are not presented as disconnections. Observations older than 24 hours display **Check overdue**. Client-side freshness updates every minute. Connection status does not certify sending readiness. The development demo uses synthetic statuses and cannot register or check real inboxes.

Setup reads and writes go through the dedicated backend `/api/outbound/setup` endpoint. Server actions recheck membership, forward only the verified current user bearer token, refuse redirects and disable caching. The backend independently checks permissions. Missing `OUTBOUND_API_ORIGIN` produces an actionable unavailable state; the app never substitutes success or sample records.

`/settings/team` is available to active client administrators and explicit agency owners. Client administrators manage members/viewers only; agency owners can also grant client administrator/operator roles. Team changes include the current membership version so stale edits fail with a refresh instruction. Revocation removes access through that workspace membership; separate agency access and the outbound sign-in account are unchanged. This API does not manage the content portal.

Managers create an invitation link and copy it themselves; this milestone sends no invitation email, creates no Auth identity, and does not reset passwords. Links expire after seven days and are shown only when created. Ordinary invitation lists never contain a secret. Reissuing an invitation replaces the previous pending link.

The `/invite#token=…` fragment moves into per-tab sessionStorage scoped to the configured auth project and is removed from browser history before inspection. `/invite` reveals workspace information only after authenticated API verification and requires explicit acceptance. The token survives existing-account login using the exact `/login?next=/invite` return path; arbitrary redirect destinations are rejected. Success clears the token. People without an existing verified Covora Outreach account get assisted-access guidance. Team and invitation DTOs remain API-only, so no additional database views are exported into this app.

The schema is generated from the dedicated outbound backend's generated TypeScript through an AST allowlist:

```sh
npm run schema:sync -- /path/to/covora-outreach-api/src/lib/database.types.ts
```

The exporter removes unrelated tables, token columns, relationships, and write capabilities. Do not edit the generated projection by hand.

## Metrics

- Campaign KPI cards and campaign tables are explicitly **all time**. Human replies exclude automatic replies once. Reply rate uses contacted people within each campaign; totals do not deduplicate a person across campaigns.
- 7-day, 30-day and all-time controls filter the daily activity chart in UTC. Reported daily replies may include automatic responses and repeat people across days. They cannot support a reliable date-filtered unique reply rate.
- Opens remain hidden (`SHOW_OPENS = false`). Step statistics show a dash when unavailable. A step's delay describes the wait **after** that step.
- LinkedIn numbers are “Logged by you.” The dedicated project starts without content-portal logs; the compatible read surfaces remain empty until data is explicitly recorded or imported in the outbound backend. Confirmed send logs and legacy DM logs are separate sources. Legacy replied/meeting counts are exact current statuses grouped by original log day, not outcome dates or a cumulative funnel. Unsupported outcomes remain unavailable.
- Detail reads paginate in batches of 500 with a 10,000-row ceiling. A visible notice identifies potentially partial views. Data is loaded only for the selected screen.

## Checks

```sh
npm test
npm run lint
npm run typecheck
npm run check:boundary
npm audit --omit=dev --audit-level=high
npm audit --audit-level=high
npm run build
```

`check:boundary` scans source, paths, config and documentation case-insensitively for prohibited vendor naming without embedding that name in its own source. Generated build and dependency directories are excluded; served production HTML, RSC and browser bundles must also pass a separate authenticated scan.

The scoped lint dependency replacement preserves the supported directory patterns and actual route-link lint rule. Both dependency audits must pass; no audit suppression or gate removal is permitted.

## Release status

The frontend is published at `https://covora.app` with a private source repository. This branch prepares its move to the independent outbound backend and auth project; local checks do not mean that production has been switched. Before promotion, verify the dedicated schema, provision authorized outbound accounts, validate the deployment configuration, and test the staged deployment with synthetic or explicitly authorized identities. Never copy old sessions, passwords, memberships, logs or client data as an implicit migration.

Implemented flows include campaign results, plain-text conversation history, assisted account setup, registration and checks for existing inboxes, team invitations and client administrator onboarding, conversation ownership and collaborative replies. Sending and synchronization require independent backend configuration and explicit activation; UI availability does not establish readiness. Accounts now includes a People tab for adding people and connecting Google Workspace email or LinkedIn. Agency owners can add client workspaces, create client administrator invitations, and authenticate managed workspace connections. Provider configuration remains in the dedicated backend; onboarding imports are not implemented.

Existing `app.covora.app` hosting, DNS, identities, schema, jobs, data and credentials are outside this cutover. Historical local verification notes under `docs/` record earlier milestones and are not current release authorization.


## Agency integrations

Agency owners can open **Agency workspace → Integrations** to configure email and LinkedIn service connections. Enter a name and API key; the LinkedIn connection also requires its workspace ID. The backend verifies the connection before storing the key with authenticated encryption. No saved key is returned to the frontend. The form clears its secret field when submitted.

Owners can check a saved connection, replace its key for the same workspace, or remove an unassigned connection. A failed replacement preserves the saved key. Client roles and assigned operators cannot access this tab or its mutations. Saved connections can be assigned directly in the **Email** and **LinkedIn** cards under **Accounts → People**. LinkedIn workspaces retain their existing client assignment restriction.

Apply backend migrations 0107–0108 to the isolated local database before using the tab. The frontend requires only the same public auth configuration and fixed backend origin as before. Local tests use simulated service responses; live credentials and account-login entitlement still need verification.

### Workspace comments

EPM's **Comments** tab lets its active workspace members request changes and follow the conversation. Requests have Open, In progress and Resolved statuses, with replies, dates and author attribution. Viewers remain read-only; the Covora team manages statuses. The independent backend must apply its Comments migration and explicitly enable EPM before this page accepts requests. Comments remain real records when campaign results are shown in preview. No outreach or notifications are triggered.
