# Integrate account onboarding into the existing portal

## Symptom

Account onboarding initially appeared in a separate UI in the sibling API repository, instead of the existing client application.

## Root cause

The API checkout was treated as the complete product before inspecting the sibling frontend repository.

## Approach that worked

Reused the existing workspace shell, agency portfolio, Accounts tabs, dialogs, login, invitation screen, and theme variables. The API repository retains provider calls and privileged identity provisioning. Public frontend settings contain only the dedicated auth URL, public key, and fixed backend origin.

Accounts → People adds a person and starts their email or LinkedIn connection. Agency workspace adds clients and creates private client administrator invitations. Agency owners authenticate configured managed workspaces from Accounts → People → Workspace connections. Client administrators and assigned operators manage people in their live workspaces; members/viewers remain read-only. Preview workspaces cannot invoke these mutations.

New-account invitation proofs use fragments and project-scoped per-tab storage. Account activation, password setup and explicit workspace acceptance are separate steps. Existing signed-in identities cannot be replaced by an activation link.

## Rule for next time

Inspect sibling repositories, route ownership, existing design components, and auth boundaries before adding a new application shell. Reuse the established UI for incremental product features.

## Evidence

- 144 frontend tests passed, including role/preview denial, consent URL validation, DTO validation and project-isolated activation storage.
- Production frontend build, lint, typecheck and source boundary checks passed; runtime dependency audit reported zero vulnerabilities.
- Local browser check exercised the existing login, client creation, invitation activation, password setup, explicit acceptance, adding people as owner and client administrator, refresh continuity, mobile overflow, and cross-client access denial.
- Live external account connection still requires deployment-managed credentials and a consented account check. The local browser check verifies the configuration-required state without making external account calls.
