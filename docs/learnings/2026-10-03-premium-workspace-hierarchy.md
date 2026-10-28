# Premium workspace hierarchy

## Symptom

The navigation was simple, but section interiors felt flat and visually crowded. Metrics, table rows, filters and message details competed for attention.

## Root cause

Most content relied on the same spacing and surface treatment. Dashboard totals were detached from chart labels, and four metric columns became too narrow on tablets after adding visual context.

## Approach that worked

Keep the existing navigation and interactions. Use shared neutral surface tokens, restrained borders and shadows, clear heading sizes, and consistent spacing. Give metrics distinct cards, place chart series labels beside their totals, align numeric table columns, and frame the inbox as one workspace with clear conversation selection and message cards. Apply the same surface treatment to account and team sections.

Switch metrics to two columns at tablet widths. Stack header actions on narrow screens. Preserve plain-text messages, measurement labels, unavailable states, server authorization and all existing actions.

## Rule for next time

Check dense dashboards at intermediate widths as well as phone and desktop sizes. Keep data labels and their scope adjacent, verify both themes, and review the compiled application because stylesheet ordering can differ between development and production.

## Evidence

- Browser review covered 320, 390, 820 and 1440px widths, dark mode, keyboard focus, filters, table scrolling and reduced motion.
- The tablet metric clipping found during review was fixed and independently rechecked.
- Authenticated client and staff account views preserved role-specific controls and disabled configuration states.
- Lint, TypeScript, source boundary checks, all 41 tests and the production build passed. Compiled Overview, Inbox and Accounts layouts matched development on desktop and mobile; development-only demo routes stayed unavailable in production.
- A local production run correctly rejects the development backend's HTTP loopback origin. Verify that unavailable presentation separately from the working authenticated development data; do not relax the origin guard for a visual check.
- No new dependencies, remote assets, network requests or backend changes were introduced.
