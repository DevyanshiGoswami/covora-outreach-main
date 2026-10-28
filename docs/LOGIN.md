# Covora Outreach sign-in

`/login` is the portal entrance. The username is always the client's email address; the dedicated outbound identity service verifies the password. Content-portal credentials are not inherited; an outbound administrator must provision access in the dedicated project. Successful sign-in enters the authenticated workspace at `/`, with access resolved from active product memberships on every server request. The page redirects an already authenticated user to their workspace or an allowlisted return destination.

Lead alert links use `/?client=<uuid>&view=inbox`. A signed-out visit preserves that destination through the login page and form; successful sign-in returns to the selected inbox. Only that exact query shape, `/`, and the exact `/invite` path are accepted. Extra parameters, fragments, encoded paths and external URLs fall back to `/`. Returning to a workspace never grants access: current memberships are rechecked on arrival, and a removed or foreign workspace remains unavailable.

The login uses visible labels, password-manager autocomplete, paste support, an accessible show/hide password button, pending feedback, and neutral failure messages. Credentials stay in the current form and authentication request; they are not stored in browser storage, placed in URLs, or logged by server actions. Failed attempts retain form input, and submission hides any revealed password.

The page follows the existing brand colors and theme tokens. The desktop introduction gives way to a single form on small screens. The development sample has a Sign in link in its sidebar; sample access and its login-page link are absent in production. A valid login never falls back to sample data.

Accounts are managed by Covora in the dedicated outbound auth project. Default SSR cookies are scoped by project and have no cross-subdomain Domain override, so old-project cookies are ignored after cutover. Signing out affects the current outbound session only. Invitation tab storage is also project-scoped. This change does not introduce public signup or send invitation/recovery emails. The support text directs clients to their account manager for access or a password reset. Local pilot credentials are provisioned separately in the isolated backend and handed off in a private file outside repositories; no credentials are included here.

## Historical verification — October 4, 2026

These checks describe the earlier local milestone. Current architecture and deployment gates are in [ARCHITECTURE.md](ARCHITECTURE.md). They do not establish a completed independent production cutover.

- 53 frontend tests, lint, TypeScript, source boundary and production build pass.
- Production browser checks cover a real local password login with uppercase email, the correct workspace, session reuse, foreign workspace denial, sign-out, signed-out route protection, external redirect rejection and exact invitation return.
- Invalid credentials produce neutral feedback while preserving input. Password visibility works by pointer and keyboard, has a visible focus ring and a 44px target, and supports password managers.
- Desktop and mobile light/dark layouts checked, including 320px overflow; no browser runtime errors.
- Runtime dependency audit is clean. Full audit retains the five existing high-severity development-toolchain findings; no dependencies were changed.

The pilot is local only. No deployment, production identity change, authentication email, campaign sync or prospect message was performed. Sending remains disabled and campaign results await connected accounts.

### Lead alert continuation

- After the narrow return-path extension, all 56 frontend tests, lint, TypeScript, source boundary and production build pass.
- Browser checks with synthetic local Auth/data responses verify signed-out alert links, password sign-in to the selected inbox, foreign-workspace denial and external-return rejection. No browser or server errors; no real identity credentials or emails used.
- Runtime audit remains clean; full audit still reports the five existing development-toolchain findings above.
