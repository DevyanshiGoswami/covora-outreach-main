# LinkedIn browser-session setup

## Symptom

People could connect LinkedIn only with their email, password and a verification code. Some want to use an existing browser session.

## Root cause

The account dialog and action accepted only credentials. A browser-session flow also needs clear export instructions and an expected profile check.

## Approach that worked

The existing account dialog now offers Email & password and Browser session. The second option explains how to export a LinkedIn JSON session in Chrome, links to the Cookie-Editor listing, and requests the profile URL to verify the connected identity. The user agent comes from the same browser. Country-code help includes United States, India and United Kingdom examples.

Only the two authentication cookies are forwarded. Tracking cookies and extension metadata are discarded. Invalid, duplicate, oversized, expired or off-domain authentication cookies produce fixed messages. The backend independently validates and authorizes the request.

Public identity fields and the selected method remain filled after errors. Sensitive fields are disabled during the action and cleared after each attempt. Preventing the native form reset also keeps radio selection consistent with React state. Credentials are not saved in storage, returned in action state, or placed in URLs.

## Rule for next time

React form actions reset uncontrolled inputs after completion. This can clear a user's replacement session while an action is still pending, or leave a radio's visual selection inconsistent with application state. Keep public identity fields controlled, disable sensitive input while processing, prevent native reset, and clear secrets explicitly.

## Evidence

180 frontend tests passed. Lint, types, source boundary, runtime audit (0 vulnerabilities) and production build passed. Browser tests verified invalid JSON, profile mismatch, access rejection, uncertain outcomes, secret clearing, preserved fields and selected method, refresh persistence, password/PIN regression, viewers, keyboard dismissal and 390px/dark layouts. Test data and transport were synthetic.

The connected-screen test initially used a stale accessible-name selector; the targeted check with the current name passed. The PIN regression was repeated after waiting for the existing poll throttle. No production permission or timing guard was weakened.

The option is available on the existing local portal at port 3041. A real browser-session connection has not yet been attempted. Deploy the matching backend migration and adapter before releasing this frontend to the cloud.
