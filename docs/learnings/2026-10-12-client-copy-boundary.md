# Client copy boundary

## Symptom

The source scan passed, but imported campaign names, list labels and operator notes could still reach client pages with supplier branding.

## Root cause

The check covered only one encoded name in local files. Runtime metadata passed through otherwise valid tenant-scoped response projections without a presentation policy.

## Approach that worked

Use one encoded supplier registry for runtime presentation and source checks. Apply neutral campaign/list labels and fixed operational guidance at existing validated data boundaries, before values enter browser props. Keep IDs, filters, ownership, message bodies and recipient/sender identities intact, including names that overlap a supplier name. Broaden source checks to cover current suppliers and protect normal language and dependency metadata from false positives.

## Rule for next time

A source scan is necessary but cannot guarantee the wording of imported data. Every new product-owned display field must use the shared presentation boundary or an explicit neutral enum. Every added supplier needs registry and fixture coverage. Never turn brand cleanup into rewriting actual correspondence.

## Evidence

- `tests/client-brand-boundary.test.mjs` exercises source text, domains, filenames, excluded dependencies and ordinary channel wording.
- DTO regression cases exercise campaign/list labels, setup notes and reply availability without changing tenant IDs, sender names, contacts or messages.
- No database migration, authentication change, campaign edit or legacy portal change is required.
