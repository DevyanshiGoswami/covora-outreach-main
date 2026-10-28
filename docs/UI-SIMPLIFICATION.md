# Workspace simplification — 2026-10-03

The user says the current UI is complicated and confusing. Replace the long form presentation with familiar outreach workspace patterns from their supplied references. This updates the existing screens and preserves their current authorization and capabilities.

- One persistent sidebar: Overview, Campaigns, Inbox, LinkedIn, Accounts, Team (managers), Agency queue (authorized staff). Company selector at the top; theme/account controls at the bottom.
- Plain 22–26px page titles. White main canvas, pale neutral sidebar, thin borders, small blue active accents, compact rows. Preserve dark mode and accessible mobile navigation.
- Overview: remove promotional hero, start with four clear metrics and recent activity/campaigns. Detailed metric caveats remain accessible through a small disclosure.
- Inbox: narrow status/filter rail, conversation list and reading pane. Preserve search, campaign/interest/unread filtering, plain-text content and read-state behavior. Do not add a fake reply composer.
- Accounts: Email and LinkedIn tabs with concise rows and one Add account action. Existing assisted setup stays honest; account requests are not connected senders. Put the method choice and full guidance inside the action dialog.
- Team: Members and Invitations tabs, searchable compact list, Invite teammate action, per-person Edit action opening a dialog. No role/state forms repeated down the page. Keep existing version checks, permissions and invitation-secret rules.
- Use native dialogs with focus return, Escape support and accessible titles. Confirm visible consequences before saving access changes.
- Demo remains synthetic and development-only; give the user a navigable preview of the new Team screen. Real mutations stay behind existing server actions.

Shared component contract: WorkspaceShell({ workspace, active, title, subtitle?, demo?, actions?, inboxBadge?, children }). active is overview|campaigns|inbox|linkedin|accounts|team|agency. The shell owns navigation and page framing; settings and inbox styles are scoped separately and imported once in the root layout. Dashboard data remains server-rendered, with client components for interactive controls. No backend/schema/auth contract changes required for the visual redesign.

Verification: current tests, lint/types, source boundary, production build, keyboard/dialog and mobile browser checks; real invitation/role/revoke and assisted setup action regression. Preserve tenant selection, no metadata before authority, and no provider identity in browser/source.


Completed validation: 33 tests, lint, typecheck, source boundary and production build pass. Browser coverage includes desktop, 320/390px mobile, 768/820/900/1024px layouts, keyboard dialogs, dark theme, real invitations/member changes/assisted setup, delayed invitation protection, and switching among 52 authorized companies. Production checks inspected 80 authenticated HTML/RSC responses and 19 static assets; all three demo routes return 404. Runtime dependency audit is clean; five existing development-tool advisories remain.
