# Replace the lint glob dependency with an explicit directory contract

## Symptom

The full dependency audit blocked release on GHSA-vfj7-8cjw-p6xm. The affected `braces` package entered only through the pinned Next lint plugin's `fast-glob` dependency. The runtime audit was already clean.

## Root cause

Next 16.3.8 uses that dependency in one place: `globSync(string, { onlyDirectories: true })` to resolve optional `settings.next.rootDir`. A raw alias to `tinyglobby` removed the vulnerable dependency but changed exact-directory matching and imported nested projects into the internal-link lint rule. Further fixtures found incompatible numeric ranges and symlink behavior. A replacement must preserve the supported configuration and reject unsupported patterns explicitly.

## Approach that worked

Scope the npm override to `@next/eslint-plugin-next` and use the private, local `@covora/next-lint-glob` adapter backed by official `glob@13.0.6`. Keep every Next lint rule enabled. This app leaves `rootDir` unset, so its normal working-directory lookup is unchanged.

The adapter supports relative/absolute paths, `*`, `?`, and `**`, directory symlinks, and explicit hidden paths. Wildcards retain dot exclusion and case-sensitive matching. A terminal globstar selects descendants rather than its base. Next still maps arrays one entry at a time; a standalone leading negative entry produces no roots, and does not subtract roots selected by another array entry.

Brace expansion, character classes, groups, and extglobs deliberately throw a readable configuration error. This is a narrower supported configuration, not a general implementation of `fast-glob`. Changed call shapes/options also throw so a future plugin upgrade cannot silently expand the adapter's contract.

The `file:../../../vendor/next-lint-glob` override resolves from the pinned plugin package to the repository's adapter. `.npmrc` uses `install-links=true` so npm installs the local package as a regular dependency and records/audits its real `glob` dependency tree. Regenerate the affected lock entry when changing this override: npm can otherwise retain the old package despite reporting it as overridden. Always verify a clean `npm ci` and the actual rule behavior.

## Rule for next time

An audit-clean package alias does not establish API compatibility. Exercise the consuming rule, including a nested-project false-positive fixture, and keep unsupported configuration errors explicit. Do not suppress the full audit or rename a vulnerable package to hide it. Remove this workaround when the upstream lint dependency has a verified compatible fix.

## Evidence

- `tests/lint-root-dirs.test.mjs` covers API changes, explicit and wildcard roots, recursive globstars, arrays/negative entries, unsupported syntax, hidden and symlink directories, and the actual internal-link rule.
- Clean isolated `npm ci` resolves the adapter and reports zero vulnerabilities; both runtime and full audits remain required in CI.
- All 66 tests, lint, typecheck, boundary validation, and an isolated production build pass. No existing package version or integrity changes outside the replaced dependency subtree.
- Original advisory: https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
- Official glob API: https://github.com/isaacs/node-glob/tree/v13.0.6
- Next's bundled ESLint guide documents `settings.next.rootDir` as paths, globs, or arrays; this repository's explicit subset is documented above.
