# Combined agency and client integration flows

## Symptom

The owner invitations and account onboarding branches each changed agency navigation. Combining them required preserving Clients, Integrations, and Agency owners, including links on the owner management page. A client invitation's account-switch form also returned 403 in Chrome.

## Root cause

The branches introduced separate navigation entries and styling. The client invitation page used `no-referrer`, causing a normal form submission to carry `Origin: null`; the existing sign-out CSRF check correctly rejected it.

## Approach that worked

Combined both branches on `feat/agency-client-integrations` in the organization checkout. Retained the original portal, normal home-first sign-in, account assignment cards, and separate owner/client invitation paths. Used the backend's explicit owner context for the agency owner link, including owners with no clients yet. Added integration links to the owner page for desktop and mobile.

Aligned the client invitation's referrer policy with the existing app policy, `strict-origin-when-cross-origin`. Kept sign-out origin checks unchanged. Invitation and activation secrets remain in fragments and project-scoped per-tab storage; neither is added to a query string.

## Rule for next time

Combine navigation additions explicitly and exercise both owner and client invitation journeys after integrating branches. Check authorization by the rendered denial and backend response, accounting for streamed pages that can carry a 200 response. Verify browser account-switch forms as well as server-action acceptance.

## Evidence

- 159 frontend tests passed, along with lint, types, source boundary, and production build; runtime dependency audit reported zero vulnerabilities.
- 132 isolated database tests, 286 backend unit tests, and six tooling tests passed with the combined migrations through 0112.
- Browser checks cover normal home landing, all three agency destinations, both connector dialogs, mobile layout, client creation/invitation/activation/password/acceptance, role permissions and cross-client denial.
- A browser reproduced the account-switch 403 with `Origin: null`; the same flow returned 303 with the correct same-site origin after the policy correction. Owner invitation activation, password setup, acceptance, and sign-out also passed again.
- Real account connections and provider entitlements remain live verification work. No production data, migration, deployment or outreach send was performed.
