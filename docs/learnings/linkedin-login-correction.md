# Clear LinkedIn retry failures

## Symptom
Correcting a LinkedIn sign-in email after a failed attempt showed a generic message suggesting a short wait, even though waiting could not fix it.

## Root cause
The backend retained the first login-email reservation. The frontend discarded the specific error body on HTTP 400 and displayed a general cooldown message.

## Approach that worked
The backend now permits correction only after definite failures without a remote identity. The action transport reads fixed failure codes and renders neutral, predefined instructions for a real cooldown, an identity requiring review, or an email reserved by another person. Arbitrary external/database text never reaches the page. The email field now explains that the LinkedIn login may differ from the person's work or portal email.

## Rule for next time
Keep field correction in connection retry tests. Map known error codes; do not describe every rejected request as throttling. Preserve authorization and uncertain-result safeguards.

## Evidence
180 frontend tests, lint, types, source boundary and runtime audit passed. Temporary webpack production build passed. Browser regression verified rejection → cooldown → corrected email → connection, refresh persistence, sensitive-field clearing, mobile fit and viewer restrictions using a simulated service and a separate local database. Changes are local; no production release. Real connection confirmation remains a user test.
