# Active campaign results and visible refresh

## Symptom

A workspace intended to show current campaigns also displayed drafts and historical campaigns. Open result pages kept their initial data until navigation or a manual reload.

## Root cause

The results reader loaded every assigned campaign and all daily activity for the workspace. Campaign visibility and overview metrics did not share a scoped presentation policy. Background refresh previously existed only in the conversation inbox.

## Approach that worked

Apply the exact workspace's active-only policy to overview and campaign reads. Filter campaign status before pagination, and restrict overview daily activity to those same campaign IDs before pagination. An inactive detail URL cannot resolve a selected campaign or load its detail rows. Keep inbox campaign names, conversations and historical lead reads unchanged; the separate verified-lead directory remains independent.

Render an explicit zero-active state instead of onboarding or invented zero performance. Use a 60-second visible-page refresh with one transition in flight, focus/visibility recovery, and cleanup on unmount. Pause while editing or a dialog is open. Route refresh merges new server results while preserving client search state; keep it off conversation and setup surfaces. Show existing campaign sync timestamps separately from the page's refresh interval.

## Rule for next time

A results filter must cover server pagination, campaign totals, daily activity, detail URLs and empty states together. A filtered empty result does not establish that a workspace is new. Keep campaign visibility separate from access to existing correspondence and verified contacts. Do not describe page polling as an immediate upstream sync.

## Evidence

Regression tests exercise the actual results reader with more than 10,000 excluded campaigns and daily rows, strict active status, inactive detail URLs, zero-active results, tenant filters, unchanged other workspaces and preserved inbox history. Refresh tests cover overlap, hidden/editing pauses, resumption and disposal. Full tests, lint, typecheck, source boundary, dependency audit and production build pass. Local synthetic browser verification checks the actual minute interval, retained search state, single-request focus bursts, hidden/editing pauses, empty/detail states and desktop/mobile layout; it uses no credentials or external traffic.
