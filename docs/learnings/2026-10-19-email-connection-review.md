# Email connection review

## Symptom
A completed Google consent could leave a person at Needs review without a useful next step.

## Root cause
A sign-in status response can be unavailable even after the mailbox has been added. Repeating account creation is unsafe, and a manual database repair is not an acceptable normal user flow.

## Approach that worked
Offer Check connection again for stalled email connections. The existing server action rechecks client access and person authority before asking the dedicated backend to verify the reserved mailbox. Confirmation is shown as success; missing, pending and unavailable results explain the next action. The check never opens a new consent popup.

## Rule for next time
Provide a read-only reconciliation path for uncertain external operations. Distinguish inability to verify from confirmed absence and do not show unavailable checks as success.

## Evidence
165 frontend tests, lint, typecheck, source boundary and production build pass; runtime dependency audit reports no vulnerabilities. Browser checks with simulated transport cover confirmed, missing after expiry, waiting and unavailable outcomes, persistence after refresh, no additional popup, and mobile layout. Fresh live Google consent remains user-operated. The backend migration and API release must precede this frontend release.
