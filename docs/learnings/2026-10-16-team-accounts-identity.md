# Team and Accounts share a person identity

## Symptom

An accepted client administrator appeared in Team but was missing from Accounts. Agency owners also had no clear indication that the roster belonged to the selected client.

## Root cause

Portal memberships and sending people were separate records. Connection actions checked manager roles without linking a person to the signed-in user. Team invitations also assumed an existing verified login.

## Approach that worked

The dedicated backend links accepted client teammates using verified email within the client, then retains the Auth identity link. Existing sender IDs, names and saved connections are preserved. The API derives self, role, access and connect permissions. SQL rechecks them at preparation, provider-context reads and completion. Invalidated pending sessions require review. Accepted viewers remain reporting-only; pending invitations remain in Team.

The original portal layout remains. Accounts shows the selected company, role and “You.” Managers see client-wide statuses. An explicit sender-only flow handles people without portal access. Team invitations reuse password activation for new identities; existing identities require their own login. No invitation email is sent.

## Rule for next time

Separate portal permissions from sending identities, but link them explicitly. Never infer agency owners as senders in every client. Do not merge different email addresses or transfer saved sending identities when a login email changes. Treat UI permissions as hints; current database authorization is authoritative.

## Evidence

Local database tests cover idempotent reconciliation, ownership, tenant isolation, role changes during sign-in and new-member invitations. Simulated connection flows pass. Browser checks verify XYZ's reconciled administrator, separate external sender, mobile layout and new-member password/acceptance flow. Production builds, lint, type checks, source boundary and runtime audits pass. Live external authentication was not repeated.
