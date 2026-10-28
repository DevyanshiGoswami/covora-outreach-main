# Agency owner invitation UI

## Symptom
The client Team screen cannot grant agency-wide ownership or guide a new owner through account activation.

## Root cause
Client roles and agency ownership have separate authority. Existing login continuation only allowed the original client invitation path.

## Approach that worked
Add an Agency owners screen and a separate owner invitation route. Use bearer-authenticated server actions and backend authorization on every request. Allow only the two exact new login destinations. Preserve link secrets in project-scoped tab storage, strip URL fragments, and require explicit acceptance. Existing accounts use their own password.

## Rule for next time
Label agency ownership separately from client administration. Never expose a management action only by checking UI state. Invitation creation and password setup must not silently grant ownership.

## Evidence
Frontend tests cover secret handling, exact redirect paths, fixed API routes, and response validation. Backend role tests verify the actual grants. See the sibling backend's `docs/agency-owners.md` for release order and limitations.

## Browser verification
Chrome passed invitation creation, activation, password setup, explicit acceptance, sign-out/re-login, agency navigation, client-admin denial, and mobile overflow checks. The new page uses the existing invitation page's referrer policy: a no-referrer policy caused browser form POSTs to send Origin:null, correctly rejected by sign-out CSRF checks. Fragment-only tokens remain stripped; CSRF validation was preserved.
