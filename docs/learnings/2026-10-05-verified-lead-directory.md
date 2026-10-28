# Campaign lead directory

## Symptom
Clients could review campaign results and conversations but could not browse the underlying campaign leads with contact and verification filters.

## Root cause
The content product's separate lead lists were not the outbound campaign directory. Contact availability also does not prove verification.

## Approach that worked
Added a dedicated Verified Leads route using the current workspace membership and a fixed, bearer-authenticated backend endpoint. The browser receives only a validated neutral projection. Search, role, company, campaign, email, profile and outreach filters compose through URL state; sorting resets pagination and pages contain 36 rows. Missing evidence remains unknown. Failures render a retry state instead of an empty successful result.

## Rule for next time
Keep imported campaign contacts separate from unrelated product lists. Treat verification as evidence, preserve workspace identity through navigation, and validate all rows and global filter options before rendering.

## Evidence
92 frontend tests, typecheck, lint, brand boundary, dependency audit and production build passed. Browser verification covered combined contact filters, role filtering, empty search and clearing, details, 36/12 pagination, light/dark themes, and contained table scrolling at 390px and 320px. Independent review found no remaining concrete issues. Live release verification is recorded separately in the task outputs.
