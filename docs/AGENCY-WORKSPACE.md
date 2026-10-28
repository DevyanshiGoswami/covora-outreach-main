# Agency workspace

The production admin entry point is `/agency`. Anonymous visitors sign in and return to this exact path. The page verifies the current session and reads active product memberships through `client_outreach_workspaces`. Agency owners see their authorized companies; operators see only assigned companies. Client roles receive no admin portfolio.

The portfolio reads exact active campaign counts, all time received email counts (including automated responses), and the oldest active campaign metadata sync time through the current user's database session. Every query keeps an explicit company filter as well as database row policies. The timestamp is a metadata observation, not a claim about worker health or message completeness. Partial read failures remain unavailable and never become zero.

Workspace preview modes remain visible. Preview cards omit operational metrics and link to the existing client experience, where sample activity is labeled. The admin route does not create sample activity, expose local workflows, or call sync or sending endpoints.

Authorized operators can open existing client portals, inboxes, verified leads, account status, and account setup. Only roles that can manage a team see its link. Each destination and action independently rechecks current authorization. Refresh results only reloads saved observations.

Deployment uses the existing dedicated product auth configuration and backend origin. No schema migration or new backend endpoint is required. Creating an admin identity and granting owner authority is a separate privileged operation, never inferred from the email address.

Validation covers exact login returns, rejected alternate destinations, role and tenant scope, partial failures, preview separation, active counts beyond ordinary result pages, and conservative metadata timestamps. Production browser verification should check anonymous login, an authorized owner, an assigned operator, a denied client role, mobile layout, client links, and sign out.
