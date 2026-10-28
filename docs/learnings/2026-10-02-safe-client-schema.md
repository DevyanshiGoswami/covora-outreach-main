# Project a shared schema instead of copying it

**Date:** 2026-10-02 · **Area:** auth / data access

## Symptom
The results app needed the portal's generated types, but the shared client table also contains credentials and unrelated integration fields.

## Root cause
A full schema export or full-row auth-context query can carry fields that are unnecessary for a client results interface. Type safety alone does not establish a safe data boundary.

## Approach that worked
- Generate the app schema from the portal's generated source using TypeScript AST field allowlists.
- Export only neutral results views, minimal auth-context columns and the read-mark RPC; eliminate relationships and table write types.
- Verify auth on the server and keep explicit tenant filters in addition to database policies.
- Keep the synthetic preview in a development-only route, separate from authorization and real-data fallbacks.
- Test projection failure when forbidden fields enter a view; scan browser payloads as well as repository source.

## Rule for next time
Use an explicit field projection at both the type boundary and every auth-context query.

## Evidence
`scripts/export-schema.mjs`, `tests/schema-boundary.test.mjs`, `src/lib/auth.ts`, `src/lib/data.ts`, and `src/app/actions.ts` implement and test these boundaries.
