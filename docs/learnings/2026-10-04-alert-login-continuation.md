# Preserve an alert inbox destination without widening login redirects

**Date:** 2026-10-04 · **Area:** auth, navigation

## Symptom

A signed-out visitor following `/?client=<uuid>&view=inbox` reached the login page, then the default overview. The selected company and inbox view were lost.

## Root cause

The server workspace guard redirected to `/login` without a destination, while the login allowlist supported only the root and exact invitation route. Adding a general URL parameter would unnecessarily widen the redirect boundary.

## Approach that worked

- Extend the shared destination validator with only the alert's exact local query shape. Reject external targets, extra fields, fragments, malformed IDs and ambiguous inputs before URL normalization.
- Have the root inbox page supply that destination to the auth guard. Other callers keep the existing default behavior.
- Validate again on the login page and after form submission; preserve the existing exact invitation path and fragment-only invitation secrets.
- Leave workspace resolution and data authorization unchanged. A return destination selects an already authorized membership; it cannot grant one.
- Wait for the rendered inbox shell during browser checks. Next navigation can have its final URL while the streaming loading fallback is still visible.

## Rule for next time

Preserve only the exact local destination a feature requires, validate it again after sign-in, and recheck membership on arrival.

## Evidence

- `tests/login-navigation.test.ts` covers the complete query/form round trip, redirect injection/extra-field rejection, selected membership and revoked/foreign membership denial.
- All 56 frontend tests, lint, type checking, source-boundary check and production build pass.
- Production-browser smoke with synthetic local Auth/data responses verifies signed-out continuation, password sign-in to the selected inbox, unauthorized-workspace denial and external-return rejection, with no browser/server errors. No real identity credentials or messages were used.
- Runtime dependency audit reports zero findings; full audit retains five existing high-severity development-toolchain findings. No dependencies changed.
