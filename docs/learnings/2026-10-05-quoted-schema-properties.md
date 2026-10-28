# Normalize generated property names before schema discovery

## Symptom

Regenerating the frontend projection from the release candidate silently omitted the LinkedIn daily view when generated property names were quoted.

## Root cause

Required-field lookup removed source quotes, while dynamic view discovery used the raw source text. A quoted name did not begin with the expected prefix. The same schema therefore projected differently depending on generator formatting.

## Approach that worked

Use a single TypeScript AST property-name helper for both required-field lookup and view discovery. Identifier and string-literal nodes expose their semantic name through `text`, including escaped characters. Keep the existing view allowlist, stripped relationships, empty table/write surfaces and forbidden-field rejection.

Regenerate the frontend file only through the export script from the canonical release candidate. Compare the saved bytes with a fresh projection of that exact source.

## Rule for next time

Schema discovery must compare semantic AST names, not the source spelling. Test both generator quoting styles and escaped property names. A successfully parsed projection can still be incomplete, so assert required dynamically discovered surfaces too.

## Evidence

- The new quoted-key regression preserves all eight allowed views, including the LinkedIn daily view, with double quotes, single quotes and an escaped character in the view name.
- Required-field failures and forbidden-field rejection remain enforced for quoted input. Unrelated tables, relationships, write privileges and functions remain excluded.
- The regenerated file is byte-identical to `projectSchema` applied to the canonical release candidate, with SHA-256 `a77d89aef2be1b8d8e83f874d54a55092369fc91e0d1ab1bea10ba4925165126`.
- All 60 tests, lint, TypeScript and source boundary checks pass. An isolated production build with empty authentication/API configuration passes, leaving the running development preview untouched.
- No UI, live configuration, database or deployment changes were made.
