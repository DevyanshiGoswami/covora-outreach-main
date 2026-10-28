import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { callTeamApi } from "@/lib/team-api";
import { ownerList } from "@/lib/owners";
import { AgencyOwners } from "@/components/agency-owners";
import "@/components/agency-portfolio.css";
export const dynamic = "force-dynamic";
export const metadata = { title: "Agency owners · Covora" };
export default async function OwnersPage() {
  const client = await createClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) redirect("/login?next=/agency/owners");
  let data;
  try {
    data = ownerList(await callTeamApi({ kind: "owners", body: {} }));
  } catch {
    /* Fail closed when owner access cannot be checked. */
  }
  if (data) return <AgencyOwners data={data} />;
  return (
    <main className="agency-main">
      <h1>Agency owner access unavailable</h1>
      <p>
        Only active agency owners can manage owners. If you already have this
        role, refresh or check that the access service is available.
      </p>
      <Link href="/agency">Back to agency</Link>
    </main>
  );
}
