# LinkedIn challenge recovery

## Symptom

A failed observation hid verification and left the person with an email reservation
warning and no visible way to continue the previous sign-in.

## Root cause

Recovery was offered only for uncertain states. The retry form contained required
password/cookie fields, which would also prevent a recovery-only submission.

## Approach that worked

Offer **Check previous sign-in** for failed LinkedIn attempts and bypass credential
field validation for that button. The backend independently checks permission and
the exact saved sender before restoring verification. Show the original sign-in
email when recovery succeeds, even if the user edited the retry email beforehand.
Keep code entry and app approval available throughout verification.

## Rule for next time

A status/recovery action must not require a password, session export or verification
code. Preserve the original sign-in identity until its outcome is confirmed.

## Evidence

Browser regression covers an edited email, rejected new login, recovery with empty
credentials, original email display, verification across refresh, mobile layout and
no additional login or delete calls. Unit tests verify actionable error guidance.
