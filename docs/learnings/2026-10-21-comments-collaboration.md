# Real comments in a preview workspace

## Symptom
EPM needs to request portal changes while its campaign activity is still presented as a preview.

## Root cause
The existing preview gate correctly prevents outreach writes. Applying that blanket rule to collaboration would also prevent real requests from being saved.

## Approach that worked
Comments use their own EPM-only, disabled-by-default backend setting. The Comments route rechecks current workspace membership and the backend independently authorizes each read/write. Client administrators and members can create requests and reply; viewers can read; assigned operators and agency owners can also update status. The page hides the sample-activity banner because these are real collaboration records.

Request titles and bodies stay plain text. Client retry command IDs are reused for the same draft, database replay is atomic, and status changes require a current version. Drafts and command IDs remain in page state when switching requests; closing or reloading the browser tab with an unsaved draft triggers the browser's standard warning. Successful replies navigate to the latest reply page.

## Rule for next time
Keep collaboration authorization separate from outreach execution. A real client request never enables sending, provisions accounts, or automatically executes the request's text.

## Evidence
`tests/comments.test.ts` covers scope, roles, input bounds, response tenant/thread checks, query bounds, transport methods and neutral errors. The companion backend owns durable persistence, feature gating and real database role/concurrency tests. Browser and release receipts are stored in the task workspace under `outputs/epm-comments-2026-10-21`.
