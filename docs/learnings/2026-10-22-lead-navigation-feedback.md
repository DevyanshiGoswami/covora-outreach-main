# Lead navigation and research visibility

## Symptom

Changing a contact category left the previous category on screen without feedback. Research was available only after selecting a name and then scrolling below contact facts.

## Root cause

The dynamic route used default partial prefetching, and workspace lookup and lead loading each verified the same user in sequence. The directory had no navigation transition UI. The detail panel placed the research notes below several contact fields.

## Approach that worked

Share verified authentication only within one server render through React `cache`. Keep the membership query and the backend bearer authorization checks. Fully prefetch only the category destinations. Keep transition state above the query keyed directory so rapid category changes remain interruptible while form and selected profile state reset when results change.

Show the requested category immediately, label the previous results while loading, and make the old form, rows and paging controls inert until the new results arrive. Leave category navigation available so a later category choice can supersede an earlier request. Keep real summary excerpts and a View research button next to the person's name. Group the existing summary, research notes and personal opener before contact facts in the panel.

## Rule for next time

Treat response time and visible interaction feedback as separate requirements. Request scoped authentication reuse must never become a cross user result cache. Research should be discoverable without knowing that a name opens a hidden panel. Do not turn private review metadata or browser only drafts into public notes.

## Evidence

The installed Next.js Link documentation states that `prefetch={true}` fetches full dynamic routes and that automatic prefetching runs only in production. Its data fetching guide scopes React `cache` to one server request. Browser QA uses a temporary development fixture with delayed category responses so pending state, superseding navigation and research placement can be checked without touching real client data. Production timing is checked separately after deployment.
