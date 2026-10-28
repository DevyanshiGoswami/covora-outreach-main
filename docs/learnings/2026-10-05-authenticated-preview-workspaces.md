# Authenticated workspace previews

## Symptom
A walkthrough needs sample performance and conversations alongside a real imported lead roster and real workspace access.

## Root cause
Using the development demo route for an authenticated client would replace production navigation. Reusing live account or reply DTOs to imply connections would confuse illustrative state with confirmed observations.

## Approach that worked
Read presentation mode from the guarded workspace membership. Bind the server-only sample factory to the configured client as a second check. Keep production routes and real imported-list reads, and label every sample section. Treat conversation operations as local simulations, skip background refresh, and deny preview workspaces again in live server actions. Render demo connection cards separately from account health DTOs.

## Rule for next time
A presentation mode never grants membership, verification, sending readiness, or access to another client's data. Preview configuration failure must not fall through to live services. Imported list records retain list provenance and an honest contact/verification state.

## Evidence
Focused workspace presentation tests verify tenant binding, live-read isolation, and rejection of live capabilities. The production-mode factory test verifies sample-only prospects and coherent totals. Lead directory tests cover list provenance, filtering, backward compatibility, and invalid mixed source identities.
