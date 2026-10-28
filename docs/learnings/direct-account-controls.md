# Direct email and LinkedIn controls

## Symptom

The People page required opening Manage accounts and then expanding a second control to choose email or LinkedIn. Users could not disconnect a sender to connect another mailbox.

## Root cause

The dialog combined both channels and the contract exposed only self-connection permission, without a removal permission or lifecycle.

## Approach that worked

Each channel now shows its identity, status, and direct action. Connect opens only that channel’s sign-in form. Disconnect opens a confirmation naming the person, client and exact account. Cancel makes no provider request.

The backend separately supplies removal permission. Client administrators and agency owners can remove client accounts without gaining permission to sign in as those people. Members control their own accounts; viewers have no connection actions.

Unconfirmed removals show Check disconnection and prevent reconnecting. Confirmed removal restores Connect. The email form accepts an explicitly entered sending mailbox independently from the person’s Covora login. Existing provider-logo selection, consent checks and sign-in-session fencing are retained.

## Rule for next time

Show actions beside the identity they affect, and enforce each permission independently at both server boundaries. Never present an uncertain external removal as completed or automatically retry it.

## Evidence

183 frontend tests, lint, typecheck, source boundary, production build and runtime dependency audit passed. Browser tests covered both channel removal/reconnect flows, changing the sending mailbox, Cancel, refresh, role restrictions and mobile layout. Desktop and mobile screenshots were inspected. Provider transport was simulated; no real account was disconnected. The updated local portal was checked read-only at port 3041.

## Release requirement

Deploy the matching backend account-disconnection migration and API before this frontend. Older API responses safely hide removal buttons when removal permission is absent. Changes are local; production has not been updated.

## Layout correction

### Symptom

The direct actions made each person row too tall: two nested account cards sat beside a mostly empty Next step column.

### Root cause

Both channels were stacked into one column. Card padding and a separate button row amplified the whitespace.

### Approach that worked

Use Person, Email and LinkedIn columns, with a plain status and an inline action for each channel. Show account identities beneath the relevant status and necessary access guidance beneath the person's details. Container queries stack the channels when the section becomes narrow. Keep descriptive accessible action names, dialog focus restoration and 44px touch targets.

### Rule for next time

Review the whole populated row at desktop and mobile widths before adding nested surfaces. Actions tied to a status should share its line when space permits.

### Evidence

The local desktop row measured 108px. Read-only browser checks covered both channel dialogs, focus restoration, light/dark screenshots and 320–1440px layouts without horizontal overflow. All three existing channel-action permission tests, lint, typecheck, source boundary, isolated production build and runtime dependency audit passed. No account was connected or removed during verification. Screenshots and the build log are in `/private/tmp/covora-compact-people`.
