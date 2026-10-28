# Distinguish LinkedIn location and session rejections

## Symptom
A location-related connection rejection incorrectly told the user to export new browser cookies.

## Root cause
The backend classified every HTTP 400/422 during a browser-session start as an invalid session.

## Approach that worked
The backend now returns fixed codes for location, explicit session rejection and an unclassified request rejection. The frontend displays clear, neutral instructions for each. Country errors ask the user to check their actual location and the agency connection settings; unknown rejections no longer claim that the cookies are invalid. Arbitrary service text is never rendered.

## Rule for next time
Do not diagnose an expired session from the HTTP status alone. Keep location failures separate from authentication failures, and do not ask users to choose an unrelated country to bypass a failure.

## Evidence
180 frontend tests, lint, types, source boundary, runtime audit and temporary webpack production build passed. Simulated browser checks cover the location message and corrected request flow; real acceptance still requires the user's sign-in. No production changes.
