# Campaign navigation feedback and preloading

## Symptom

Campaign list, detail and inner-tab clicks offered little feedback while dynamic
server data loaded. Default partial prefetching did not preload those results.

## Root cause

The dashboard links were ordinary dynamic-route links. The campaign data readers
also performed expensive row-by-row authorization; the backend fixes that cost in
migration 0116. Frontend feedback alone cannot resolve the database bottleneck.

## Approach that worked

Use a shared navigation link for dashboard, campaign table and sidebar links.
Hover or keyboard focus opts the intended destination into full route prefetching;
links do not eagerly fetch every campaign in the table. A fixed-size indicator
uses the framework's link pending state, with accessible loading feedback and a
reduced-motion style. Normal URL navigation, modified clicks, server authorization
and the existing page content remain intact.

## Rule for next time

Measure backend work, preload on user intent and show pending feedback. Do not
hide real latency by changing permissions or serving unscoped cached data. Preserve
all loaded leads and search behavior when improving navigation.

## Evidence

- 162 unit tests, lint, types, source boundary, full dependency audit and build passed.
- A production-build browser test with deliberately delayed navigation checked
  sidebar Campaigns, campaign selection, all four inner tabs, loading indicators,
  hover-triggered prefetch before clicking, back/forward, keyboard and mobile fit.
- All 600 synthetic leads spanning two database pages remained available and
  searchable. A foreign campaign and anonymous access were denied.
- No provider calls or sending were used. The browser used an isolated local
  database; live signed-in end-to-end timing remains a separate measurement.
