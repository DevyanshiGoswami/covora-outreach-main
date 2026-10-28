# Person location and contact profiles

## Symptom

A contact list mixed recorded location text with structured person geography. Company and list filters from one audience could conceal contacts in another audience. Research detail was difficult to discover within a wide table.

## Root cause

Legacy location text does not identify whether a value describes the person or a company. Page rows cannot provide full cohort location choices. Audience navigation reused constraints from the previous group.

## Approach that worked

Use server supplied person location facets and opaque country, region and city keys. Preserve unknown rows in the full list and explicitly identify unconfirmed legacy locations. Clear contact and company constraints when changing audience while retaining geography and sort. Present existing fit text and research notes in an accessible native dialog with a visible summary fallback.

## Rule for next time

Never infer person geography or verification from available text. Keep facets authorized and computed before pagination. A native dialog cleanup must not invoke the state closing callback during the development effect replay.

## Evidence

Directory and transport regressions cover tenant projection, location status, facet limits, URL encoding, audience transitions and unchanged contact verification. Local Safari review checked the drawer, Escape dismissal, state changes clearing city, an empty athlete category, and narrow responsive styles. The temporary synthetic route used for browser review was restored before release.
