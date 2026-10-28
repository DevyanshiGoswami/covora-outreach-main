import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { OwnerAcceptance } from "@/components/owner-acceptance";
import { CovoraLogo } from "@/components/covora-logo";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Agency owner invitation · Covora",
  referrer: "strict-origin-when-cross-origin" as const,
};
export default async function OwnerInvitePage() {
  const client = await createClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  return (
    <main className="login-page">
      <section className="login-card invitation-card">
        <Link href="/" className="brand">
          <CovoraLogo />
          Covora
        </Link>
        <OwnerAcceptance
          authenticated={!error && !!user}
          projectUrl={process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}
        />
      </section>
    </main>
  );
}
