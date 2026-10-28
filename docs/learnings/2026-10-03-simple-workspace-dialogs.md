# Compact workspaces and native dialog lifecycle

## Symptom

Settings pages repeated a full form for every row. The first replacement dialogs immediately closed in development, and saving a versioned member form could erase its success feedback. Mobile also hid the selected company inside navigation and shrank chart labels until they were unreadable.

## Root cause

The original screens exposed every editing control at once. Native `dialog.close()` queues an event; React StrictMode can reopen the dialog before that queued event fires. Form state belonged to a component keyed by the saved record version. A viewport-only chart breakpoint missed the width consumed by the desktop sidebar.

## Approach that worked

Use a shared sidebar and compact lists with forms mounted only for the selected action. Ignore stale native close events when a dialog is open, explicitly focus the first editable control after `showModal`, and return focus to the opener. Keep pending dismissal tied to the action state. Preserve a successful one-time invitation link until the user closes its copy screen; show ordinary save feedback in the parent so record remounts do not erase it. Keep the current company visible in the mobile header. Switch chart geometry by its container width, using compact axis counts and exact values in the data disclosure.

## Rule for next time

Verify native dialogs in the actual development runtime, including open, initial focus, Escape, pending actions and successful version changes. Native modal focus may enter browser chrome; the page behind it must remain unavailable. Check charts at their content width, including the sidebar at tablet sizes. Label freshness using the actual source dataset.

## Evidence

The UI revision covers Overview, Campaigns, Inbox, LinkedIn, Accounts, Team and the agency setup queue. Browser checks and screenshots are recorded in the local task's `outputs` directory; the verification ledger is `covora-ui-simplification-verification.json`. No API authorization, schema, provider connection or sending behavior changes are part of this revision.
