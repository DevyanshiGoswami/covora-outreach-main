# Missing campaign results

## Symptom
A draft with no reported analytics looked identical to a campaign with measured zero activity.

## Root cause
The numeric totals projection discarded the boolean availability flag, and the display converted absent counts to zero.

## Approach that worked
Preserve the explicit availability flag separately from numeric totals. For unavailable analytics, render missing measurements as dashes, keep previously reported values under a “Last reported” label, and retain the independently measured positive-reply count. Aggregate only known measurements and disclose drafts without reported results. Active campaigns also need explicit pending or last-reported aggregate notes; a note that totals include available measurements explains partial KPIs without hiding independently measured positive replies.

## Rule for next time
Keep measurement availability separate from numeric values and campaign status. Zero is a measurement; an absent result is not. Preserve existing behavior when older records have no explicit flag.

## Evidence
Availability tests cover missing, measured-zero, previous, mixed aggregate, partial reply counters, legacy data, and rendered campaign rows. Local browser verification with temporary synthetic data covered the overview, campaign list, pending detail, retained detail and 390-pixel mobile layout with no console warnings or errors. The temporary fixture was removed before handoff.

The active-campaign follow-up adds regressions for two measured campaigns plus three pending campaigns, retained historical values and measured zeroes, mixed availability notes, and active table rendering. It preserves existing draft note wording and does not change metric calculations.
