# Inbox identity and message presentation

## Symptom
Reply lists used the same blue initial circle for every contact, with weak separation between identity, preview and status. Message headers were similarly sparse.

## Root cause
The two inbox components duplicated presentation markup. Neither had a shared contact mark or message-header hierarchy. Read-state labels also needed to reflect their actual scope.

## Approach that worked
Use a shared local monogram with a restrained, deterministic color palette; show the supplied contact address beneath the name; and separate channel, ownership and outcome from the preview. Message cards display actual sender information, a timestamp, direction and plain-text body. Native details disclosures expose historical addressing only when supplied by the source. Unknown legacy directions remain neutral.

## Rule for next time
Do not invent profile photos, company details, historical recipients or delivery receipts to enrich a message. Match read labels to the source: personal read state can say “Read by you”; a shared workspace timestamp must use a workspace label. Preserve the existing list-button focus behavior and drafts while changing presentation.

## Evidence
- Lint, typecheck, source boundary and 53 existing tests passed.
- Browser checks covered 1440px and 1280px desktops, 820px tablet, and 390px/320px mobile layouts, with no horizontal document overflow.
- Light/dark message cards and native message disclosures inspected. Email and LinkedIn rendering confirmed; no external avatar requests.
- Mobile back navigation restored focus to the selected row; Enter reopened the conversation, focused its heading and preserved the draft. No real messages were sent.
- Runtime dependency audit: zero findings. Full audit: five existing high development-toolchain findings; no dependencies changed in this UI work.
