# Agency controls follow database permissions

## Symptom
The portal used one owner boolean for both navigation and sensitive client controls.

## Root cause
Owner membership was treated as permission to add/remove clients and remove other owners.

## Approach that worked
Keep agency, integrations, owner lists and invitation access tied to active owner membership. Use the backend's explicit `canManageClients` capability for Add client and Remove client, and `canRemoveOwners` for Remove owner access. Recheck capabilities in server actions; the backend database enforces them independently. Missing capability fields fail closed, allowing a safe backend-first rollout. No user email or ID is hardcoded in the frontend.

## Rule for next time
Do not reuse a navigation flag as mutation authority. Newly invited owners receive no sensitive control permissions by implication. Keep the existing UI and hide only the unavailable actions.

## Evidence
161 tests, lint, types, boundary, runtime audit and production build passed. Local Chrome checks cover permitted and restricted owners, preserved integrations/invitations, mobile layout and a stale Add client form rejected after database revocation. The restricted owner retains visibility of client workspaces but sees no add/remove-client or remove-owner buttons.
