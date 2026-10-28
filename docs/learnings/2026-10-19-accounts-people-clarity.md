# Accounts: distinguish people from client connection settings

## Symptom
Agency owners could not tell whether the large connection cards belonged to the client or a specific person, and could not find the path for adding a portal user.

## Root cause
Client-wide assignment controls dominated the People tab. Invitation creation required moving to Team. Personal status badges relied on icons and had no list headings.

## Approach that worked
Keep the existing workspace shell and styles. Show the selected client, person identity and portal role explicitly. Label each person's Email and LinkedIn status and explain their next step. Place client connection settings in a keyboard-accessible disclosure, separate from personal status. Add a scoped invitation dialog using the existing InviteForm and server action; keep the sender-only flow distinct. Provide search and a Team link for pending invitations.

## Rule for next time
Client configuration, portal membership and personal account authorization are different states. Label whose state is displayed and who can take the next action. Do not imply an assigned agency connection authenticates every person. Preserve server-derived canConnect and current role checks.

## Evidence
- 162 existing tests passed; lint, typecheck, source boundary, runtime dependency audit (zero findings) and production build passed.
- Browser checks against local auth/API: agency owner, member, viewer, denied foreign client, anonymous redirect, invitation client/role scope, dialog focus restoration, sender-only explanation, self-connection identity, search, keyboard disclosure and 390px mobile fit passed.
- Reviewed desktop, mobile and invitation screenshots.
- No real invitations submitted, no external accounts connected and no messages sent in verification. Invitation submission remains the existing tested implementation; this change reuses its form/action.
- Browser verification used development mode because the existing production transport intentionally rejects an HTTP local API. Production build checked separately.
- No schema, provider assignment, preview-mode or sending-permission changes.
