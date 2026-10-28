# Agency tab navigation

## Symptom

Switching from Clients to Integrations felt delayed after the message-read
database optimization. The old content and tab selection stayed visible until
the new server response arrived.

## Root cause

The Integrations route loaded all client-card statistics after fetching connector
metadata, despite never displaying those statistics. It also waited for workspace
resolution before starting the independent agency-access request. The tab buttons
called router navigation without showing a pending state.

## Approach that worked

- Resolve workspace membership and agency access concurrently. Both checks still
  complete before connector data is requested or rendered.
- Skip portfolio metrics on Integrations while retaining the authorized client
  directory and sidebar count. Clients continues to load its normal metrics.
- Use a navigation transition and optimistic tab selection for both the sidebar
  and tab buttons. Show an accessible loading panel in the existing layout;
  hide old actions and disable refresh while navigating. The committed URL and
  server props remain authoritative when navigation completes or goes back.

## Rule for next time

Load only the data used by the selected screen. Give immediate navigation
feedback, while preserving server authorization and truthful loading/error states.
Do not cache permission results across users or requests to hide network latency.

## Evidence

- A local server fetch trace for two live client workspaces fell from 11 requests
  to 5. The six removed requests were campaign/message statistics. Authentication,
  workspace membership and both agency API reads remain.
- Local development page timings varied; this is evidence of removed work, not a
  claimed production page-load speedup.
- 162 unit tests passed, including a new test proving directory-only reads make
  no statistics queries and still exclude unauthorized memberships.
- Browser checks with an artificial 1.2-second navigation delay confirmed immediate
  tab/loading feedback, no stale actions, completed navigation, sidebar and keyboard
  operation, back/forward, reload, mobile fit, anonymous/member denial and no browser
  exceptions. No account connection or provider mutation was used in these checks.
- Lint, types, source boundary, full dependency audit and production build passed.
