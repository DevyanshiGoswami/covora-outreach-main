# LinkedIn verification progress

## Symptom
Submitting a verification code returned the same generic pending screen. A cached code request could reopen the input, leaving people unsure whether to resubmit.

## Root cause
Submission acknowledgement and remote sign-in completion were represented by a single pending state. Background reads did not remember the deliberate submission, and paused checks were not explained.

## Approach that worked
Use a neutral, server-derived submission outcome and a transient dialog receipt. Show submission, waiting, finalizing and action-needed stages separately. Ignore repeated code prompts after a submission unless the user explicitly opens new code entry. Keep automatic status reads quiet, explain paused checks and longer waits, and only show Connected after an authoritative connection result. App approval remains a status read.

## Rule for next time
A submitted code is not a verified account. Never automatically resend a code, persist it, or infer completion from elapsed time. A fresh dialog reads saved connection status rather than inventing a submission receipt.

Reusing a browser session does not mean a new verification code is expected. Label ordinary waiting as connection confirmation. Remember the method only for a start performed in the current dialog; after reopening, use neutral copy instead of inferring the saved method from the picker's default. An explicit code request must still override ordinary waiting, and the manual fallback remains available for delayed status updates.

## Evidence
Verification tests cover cached prompts, rejected and unconfirmed submissions, app approval and paused reads. Synthetic browser checks exercise delayed submission, one PIN request per click, long waits, status recovery, terminal polling, refresh and mobile layout. No real account changes or outreach are needed to test this flow.
