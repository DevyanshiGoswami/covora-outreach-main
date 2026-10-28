# Live channel results

## Symptom
An enabled campaign could have a real audience but no published activity report. The existing LinkedIn page displayed manually logged activity, while automatic result refresh was tied to one workspace's email visibility rule.

## Root cause
Campaign configuration, reported measurements, and manual logs are separate evidence. An empty analytics response does not establish a measured zero. A date-only render timestamp is also insufficient for evaluating minute-level freshness.

## Approach that worked
Read the tenant-guarded `client_outreach_network_campaigns` view through the current session, keeping explicit client filters. Preserve unavailable counters as null and show each campaign's last sync. Keep campaign totals separate from email metrics and manual logs. Refresh live result surfaces every minute independently of email filtering, with preview and inbox surfaces excluded. Use a full server timestamp for freshness.

## Rule for next time
Do not convert unavailable measurements into zeros or infer meetings from other outcomes. A successful configuration sync is not proof of delivered outreach. Keep failure of one channel isolated so another channel's verified results remain visible.

## Evidence
`tests/network-results.test.ts` covers null versus zero, stale data, source failure, exact tenant filters, and inbox isolation. Existing preview, result-policy, directory, and authorization tests remain intact. The neutral schema was regenerated from the dedicated backend, not edited by hand.
