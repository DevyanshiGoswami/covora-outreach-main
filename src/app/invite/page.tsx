import Link from "next/link";
import { APP_NAME } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { isAuthConfigured } from "@/lib/supabase/config";
import { InvitationAcceptance } from "@/components/invitation-acceptance";
import { ThemeToggle } from "@/components/controls";
export const dynamic = "force-dynamic";
// Preserve the origin on same-site form submissions so switching accounts passes
// the sign-out route's CSRF check. Invitation secrets remain in URL fragments.
export const metadata = { title: `Invitation · ${APP_NAME}`, referrer: "strict-origin-when-cross-origin" as const };
export default async function InvitationPage() {
  let authenticated = false;
  if (isAuthConfigured()) {
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    authenticated = !error && Boolean(user);
  }
  return <main className="login-page">
    <section className="login-card invitation-card">
      <header className="invitation-header">
        <Link href="/" className="brand">
          <span className="mark">C</span>
          <span>
            {APP_NAME}
          </span>
        </Link>
        <ThemeToggle />
      </header>
      <InvitationAcceptance authenticated={authenticated} projectUrl={process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""} />
    </section>
  </main>;
}
