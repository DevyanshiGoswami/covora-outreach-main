# Agency portfolio message count

## Symptom

A proposed admin unread count used an older message read marker that does not represent the current conversation inbox state.

## Root cause

The current inbox records reads per user and conversation. A legacy message marker cannot accurately report the current operator's unread conversations or cover every channel.

## Approach that worked

Use an exact aggregate of received emails, label it as all time including automated replies, and avoid loading message bodies to produce a portfolio count. Preserve independent failed reads as unavailable.

## Rule for next time

An aggregate label must match the authoritative data source and unit. Do not reuse a legacy unread marker for a current inbox. Add a dedicated authorized aggregate contract if the product needs cross channel per user unread counts.

## Evidence

`tests/agency-portfolio.test.ts` checks direction filtering, client isolation, counts beyond an ordinary result page, and partial failures. The page does not mark messages read or fetch correspondence.
