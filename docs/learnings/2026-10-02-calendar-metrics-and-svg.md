# Preserve calendar time in charts and stable text in SVG titles

**Date:** 2026-10-02 · **Area:** results UI

## Symptom
Sparse daily records were equally spaced despite unequal calendar gaps. Initial browser verification also found a recoverable chart hydration error.

## Root cause
The chart used array index for horizontal position, and an SVG title contained several React text children rather than one composed string.

## Approach that worked
- Position chart points by elapsed UTC days and retain gaps without inventing zero-valued source records.
- Keep campaign lifetime rates separate from daily activity sums; the daily schema cannot reconstruct distinct contacted people across a selected period.
- Render each SVG title as one string and verify again in a fresh browser session.
- Provide keyboard-focusable data points and an accessible data table.

## Rule for next time
Plot actual dates on the time axis and compose SVG title text into one string before rendering.

## Evidence
`tests/chart.test.ts` verifies irregular-date geometry; `tests/results-metrics.test.ts` verifies UTC windows and automatic-reply handling. Browser verification after the title change showed no hydration errors.
