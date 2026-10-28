# Agency integrations on the live portal

## Symptom
The integration controls existed only on the local account-onboarding branch. The live upstream application had newer priority-lead and private-escrow changes.

## Root cause
Local work had not been released, and the backend migration numbers overlapped a newly deployed migration. Copying the older frontend wholesale would remove current client-card functionality.

## Approach that worked
Prepare separate release worktrees from the live upstream main revisions. Reapply the authorized onboarding work, preserve the escrow link and original portal styling, and move the dependent backend migrations after the live migration. Deploy the database, backend and then frontend in that order.

## Rule for next time
Identify the deployed upstream repositories, compare migration history and preserve current UI before releasing work from a fork. Treat API-key storage and provider assignment as backend capabilities. Keep client pages free of privileged connection metadata.

## Evidence and release dependency
Frontend base `628735c`; backend base `07176dd`. Companion backend branch `feat/live-admin-integrations` contains `docs/admin-integrations-release.md` with migration and deployment instructions. The frontend tab is `/agency?tab=integrations`; only explicit agency owners may use it. Publish the backend schema/API first. Do not merge this frontend solely because a preview build passes.

The release includes the existing local client/account onboarding dependencies, invitation acceptance and shared Team/People roster. It preserves the live lead review/escrow functionality. Existing developer checkouts and local credentials are not published.

Local verification: 155 frontend tests, lint, type checking, source boundary, production build and full dependency audit passed. The companion backend passed 286 unit, 6 tooling and 126 isolated database tests. Browser checks covered the owner connector forms, required fields, mobile/dark layout, existing escrow navigation, client Accounts and denied client access. Production target verification and deployment remain with the teammate who owns hosting access.
