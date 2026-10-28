# Account connection release — 22 October 2026

## Symptom

The production portal did not contain the account controls tested locally.

## Root cause

Account work was on a feature branch while the main portal gained the EPM Comments screen.

## Approach that worked

Merge main into the release branch and preserve Comments. Release the matching backend schema and API first, followed by the existing portal with compact People rows, direct channel actions, confirmed disconnection, reversible email-provider choices and visible progress/back controls. Browser session is the first and default LinkedIn method; email and password remains available second.

## Rule for next time

Deploy the matching database and backend before UI actions that depend on them. Verify the production public Auth configuration and backend origin together. Keep the existing portal layout and current client features.

## Evidence

The release includes the existing simulated consent, pending/verification, recovery, disconnection, role and mobile checks. Final CI results and production deployment revisions are recorded with the release PR. Live sign-in and additional provider verification still require the account holder. No account is implicitly removed because a connection failed.
