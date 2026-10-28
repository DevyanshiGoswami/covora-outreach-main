# Lead review visibility

## Symptom
A client roster needed to show only the selected research shortlist while the agency retained all other contacts for investigation. Existing preview presentation could also override real email verification.

## Root cause
The old lead directory had no separate agency review path, and a preview-only badge option was applied to imported real records.

## Approach that worked
The client route continues to use its client-visible directory. A distinct agency-only escrow route uses a separately authorized endpoint. Both reads validate current membership and project explicit DTO fields. Real email evidence is displayed in every workspace, with risky and unknown results marked for LinkedIn first. Priority ordering, existing lead-list filters, research reasons and source links remain available.

## Rule for next time
Enforce unpublished-lead visibility in the database and API, including totals and filter options. A presentation mode must never change the factual verification of real imported contacts. Scope table whitespace explicitly when rendering multiline research inside a global table style.

## Evidence
The focused lead escrow tests cover assigned agency roles, tenant rejection, malformed payloads, bounded paging, encoded search, priority links, and conflicting validation flags. The full frontend suite passes. Synthetic browser checks cover desktop and mobile escrow/client tables, research details, accurate email badges, and zero external requests.
